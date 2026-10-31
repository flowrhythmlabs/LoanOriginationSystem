package com.finedge.los.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** Super-admin user/role management. Does not expose passwords or TOTP secrets. */
@RestController
@RequestMapping("/api/staff/administration")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class StaffAdministrationController {
    private final JdbcTemplate db;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    @Value("${app.auth.staff-mfa-enabled:true}")
    private boolean staffMfaEnabled;

    private final com.finedge.los.service.StaffRuntimeSettings runtimeSettings;
    public StaffAdministrationController(JdbcTemplate db, com.finedge.los.service.StaffRuntimeSettings runtimeSettings) { this.db=db; this.runtimeSettings=runtimeSettings; }
    private Set<String> roles() {return new HashSet<>(db.queryForList("SELECT role_code FROM staff_role_catalog WHERE enabled=true",String.class));}
    @GetMapping("/users")
    public List<Map<String,Object>> users() {
        return db.queryForList("""
          SELECT a.id,a.username,a.display_name,a.enabled,a.failed_login_attempts,a.locked_until,
            COALESCE(string_agg(r.role_code, ',' ORDER BY r.role_code),'') AS roles
          FROM staff_account a LEFT JOIN staff_account_role r ON r.staff_id=a.id
          WHERE a.deleted_at IS NULL
          GROUP BY a.id ORDER BY a.username
        """);
    }
    @GetMapping("/settings")
    public Map<String,Object> settings() {
        return Map.of("availableRoles",roles(),"makerCheckerRequired",true,"staffMfaRequired",staffMfaEnabled,
          "settingsMode","DATABASE_MANAGED","environmentAllowsDemo",runtimeSettings.environmentAllowsDemo(),
          "runtimeSettings",db.queryForList("SELECT setting_key,setting_value,description,updated_at FROM staff_runtime_setting ORDER BY setting_key"),
          "message","Business workflow settings are stored in PostgreSQL. Deployment security gates cannot be overridden from the database.");
    }

    public record SettingUpdate(String value, String reason) {}
    @PatchMapping("/settings/{key}")
    @Transactional
    public ResponseEntity<?> changeSetting(@PathVariable String key,@RequestBody SettingUpdate input,Authentication auth) {
        if(input==null || input.reason()==null || input.reason().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message","Audit reason required"));
        if(!"DEMO_APPROVAL_ENABLED".equals(key) || !Set.of("true","false").contains(input.value()))
            return ResponseEntity.badRequest().body(Map.of("message","Setting is not editable or value invalid"));
        Long actor=db.query("SELECT id FROM staff_account WHERE username=? AND enabled=true",rs->rs.next()?rs.getLong(1):null,auth.getName());
        if(actor==null)return ResponseEntity.status(403).build();
        int count=db.update("UPDATE staff_runtime_setting SET setting_value=?,updated_by=?,updated_at=now() WHERE setting_key=?",
            input.value(),actor,key);
        if(count==0)return ResponseEntity.notFound().build();
        db.update("INSERT INTO staff_audit_event(staff_id,action,reason_code) VALUES(?,?,?)",actor,"RUNTIME_SETTING_CHANGE",input.reason().trim().substring(0,Math.min(80,input.reason().trim().length())));
        return ResponseEntity.ok(Map.of("key",key,"value",input.value(),"effectiveDemoApproval",runtimeSettings.demoApprovalEnabled()));
    }
    public record AccountUpdate(Boolean enabled, List<String> roles, String reason, String displayName, String password) {}
    public record AccountCreate(String username, String displayName, String password, List<String> roles, String reason) {}
    private String reason(String value) {return value.trim().substring(0,Math.min(80,value.trim().length()));}
    private Long actor(Authentication auth) {
        return db.query("SELECT id FROM staff_account WHERE username=? AND enabled=true AND deleted_at IS NULL",rs->rs.next()?rs.getLong(1):null,auth.getName());
    }
    private boolean validRoles(List<String> assigned) {
        return assigned!=null && !assigned.isEmpty() && roles().containsAll(assigned);
    }
    @PostMapping("/users")
    @Transactional
    public ResponseEntity<?> create(@RequestBody AccountCreate input, Authentication auth) {
        if(input==null || input.username()==null || !input.username().matches("[A-Za-z0-9._-]{3,100}")
          || input.displayName()==null || input.displayName().isBlank() || input.displayName().length()>150
          || input.password()==null || input.password().length()<12 || input.password().length()>128
          || !validRoles(input.roles()) || input.reason()==null || input.reason().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message","Valid username, display name, password (12-128 characters), role and audit reason are required"));
        Long admin=actor(auth); if(admin==null)return ResponseEntity.status(403).build();
        if(db.queryForObject("SELECT count(*) FROM staff_account WHERE lower(username)=lower(?)",Integer.class,input.username())>0)
            return ResponseEntity.badRequest().body(Map.of("message","Username already exists"));
        Long id=db.queryForObject("INSERT INTO staff_account(username,display_name,password_hash,enabled,failed_login_attempts) VALUES(?,?,?,true,0) RETURNING id",Long.class,
            input.username(),input.displayName().trim(),passwordEncoder.encode(input.password()));
        for(String role:new HashSet<>(input.roles()))db.update("INSERT INTO staff_account_role(staff_id,role_code) VALUES(?,?)",id,role);
        db.update("INSERT INTO staff_audit_event(staff_id,action,reason_code) VALUES(?,?,?)",admin,"STAFF_ACCOUNT_CREATE",reason(input.reason()));
        return ResponseEntity.ok(Map.of("message","Staff account created. MFA enrollment is required when enabled.","userId",id));
    }
    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable long id,@RequestBody Map<String,String> input,Authentication auth) {
        if(input==null || input.get("reason")==null || input.get("reason").isBlank())
            return ResponseEntity.badRequest().body(Map.of("message","Deletion reason is required"));
        Long admin=actor(auth);if(admin==null)return ResponseEntity.status(403).build();
        if(admin==id)return ResponseEntity.badRequest().body(Map.of("message","Cannot delete your own account"));
        var found=db.queryForList("SELECT id FROM staff_account WHERE id=? AND deleted_at IS NULL",id);
        if(found.isEmpty())return ResponseEntity.notFound().build();
        if(db.queryForObject("SELECT count(*) FROM staff_account_role WHERE staff_id=? AND role_code='SUPER_ADMIN'",Integer.class,id)>0)
            return ResponseEntity.badRequest().body(Map.of("message","Super-admin deletion requires an offline audited procedure"));
        db.update("UPDATE staff_account SET enabled=false,deleted_at=now() WHERE id=?",id);
        db.update("INSERT INTO staff_audit_event(staff_id,action,reason_code) VALUES(?,?,?)",admin,"STAFF_ACCOUNT_DELETE",reason(input.get("reason")));
        return ResponseEntity.ok(Map.of("message","Staff account deleted from active access; audit history retained"));
    }
    @PatchMapping("/users/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable long id,@RequestBody AccountUpdate input,Authentication auth) {
        if(input==null || input.reason()==null || input.reason().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message","Change reason is required"));
        Long actor=db.query("SELECT id FROM staff_account WHERE username=?",rs->rs.next()?rs.getLong(1):null,auth.getName());
        if(actor==null)return ResponseEntity.status(403).body(Map.of("message","Staff account not found"));
        if(actor==id)return ResponseEntity.badRequest().body(Map.of("message","You cannot change your own account or roles"));
        if(db.queryForObject("SELECT count(*) FROM staff_account WHERE id=? AND deleted_at IS NULL",Integer.class,id)==0)return ResponseEntity.notFound().build();
        if(input.displayName()!=null) {
            if(input.displayName().isBlank() || input.displayName().length()>150)return ResponseEntity.badRequest().body(Map.of("message","Invalid display name"));
            db.update("UPDATE staff_account SET display_name=? WHERE id=?",input.displayName().trim(),id);
        }
        if(input.password()!=null && !input.password().isBlank()) {
            if(input.password().length()<12 || input.password().length()>128)return ResponseEntity.badRequest().body(Map.of("message","Password must contain 12-128 characters"));
            db.update("UPDATE staff_account SET password_hash=?,failed_login_attempts=0,locked_until=NULL WHERE id=?",passwordEncoder.encode(input.password()),id);
        }
        if(input.roles()!=null) {
            if(input.roles().isEmpty() || !roles().containsAll(input.roles()))return ResponseEntity.badRequest().body(Map.of("message","Select valid roles"));
            // Prevent changing the last enabled super admin's role via the management screen.
            int hasSuper=db.queryForObject("SELECT count(*) FROM staff_account_role WHERE staff_id=? AND role_code='SUPER_ADMIN'",Integer.class,id);
            if(hasSuper>0 && !input.roles().contains("SUPER_ADMIN"))return ResponseEntity.badRequest().body(Map.of("message","Super-admin role changes require an offline audited procedure"));
            db.update("DELETE FROM staff_account_role WHERE staff_id=?",id);
            for(String role:new HashSet<>(input.roles()))db.update("INSERT INTO staff_account_role(staff_id,role_code) VALUES(?,?)",id,role);
        }
        if(input.enabled()!=null) {
            int isSuper=db.queryForObject("SELECT count(*) FROM staff_account_role WHERE staff_id=? AND role_code='SUPER_ADMIN'",Integer.class,id);
            if(isSuper>0 && !input.enabled())return ResponseEntity.badRequest().body(Map.of("message","Super-admin disabling requires an offline audited procedure"));
            db.update("UPDATE staff_account SET enabled=? WHERE id=?",input.enabled(),id);
        }
        db.update("INSERT INTO staff_audit_event(staff_id,action,reason_code) VALUES(?,?,?)",actor,"STAFF_ACCOUNT_UPDATE",input.reason().trim().substring(0,Math.min(80,input.reason().trim().length())));
        return ResponseEntity.ok(Map.of("message","Staff account updated","userId",id));
    }
}
