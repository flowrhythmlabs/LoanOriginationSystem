package com.finedge.los.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.*;

@RestController
@RequestMapping("/api/staff/policy")
public class StaffPolicyController {
    private final JdbcTemplate db;
    public StaffPolicyController(JdbcTemplate db) {this.db=db;}
    @PostMapping("/changes")
    @PreAuthorize("hasRole('PRODUCT_POLICY_ADMIN')")
    public ResponseEntity<?> propose(@RequestBody Map<String,Object> input, Authentication auth) {
        String type=String.valueOf(input.getOrDefault("changeType", ""));
        if (!List.of("RATE_CARD", "PRODUCT_LIMITS", "FEES", "DOCUMENT_CHECKLIST").contains(type)) return ResponseEntity.badRequest().body(Map.of("message","Unsupported change type"));
        Object proposed=input.get("proposedValue");
        if (!(proposed instanceof Map)) return ResponseEntity.badRequest().body(Map.of("message","proposedValue must be an object"));
        Long staffId=db.query("SELECT id FROM staff_account WHERE username=?", rs -> rs.next()?rs.getLong(1):null,auth.getName());
        if(staffId==null)return ResponseEntity.status(403).build();
        String json;
        try {json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(proposed);}catch(Exception e){return ResponseEntity.badRequest().build();}
        Long id=db.query("INSERT INTO staff_change_request(requested_by,change_type,proposed_value) VALUES (?, ?, CAST(? AS jsonb)) RETURNING id",rs -> rs.next()?rs.getLong(1):null,staffId,type,json);
        return ResponseEntity.ok(Map.of("changeRequestId",id,"status","PENDING"));
    }
    @PostMapping("/changes/{id}/review")
    @PreAuthorize("hasAnyRole('CREDIT_MANAGER','SUPER_ADMIN')")
    public ResponseEntity<?> review(@PathVariable long id,@RequestBody Map<String,String> input,Authentication auth) {
        String decision=input.get("decision");
        if(!List.of("APPROVED","REJECTED").contains(decision))return ResponseEntity.badRequest().body(Map.of("message","Invalid decision"));
        String reason=input.get("reason");
        if(reason==null || reason.isBlank())return ResponseEntity.badRequest().body(Map.of("message","Reason is mandatory"));
        int updated=db.update("UPDATE staff_change_request SET status=?, reason=?, reviewed_at=now(), reviewed_by=(SELECT id FROM staff_account WHERE username=?) WHERE id=? AND status='PENDING' AND requested_by<>(SELECT id FROM staff_account WHERE username=?)",decision,reason,auth.getName(),id,auth.getName());
        if(updated==0)return ResponseEntity.status(409).body(Map.of("message","Change not pending or maker cannot check own change"));
        // Approval does not publish automatically: a separate validated product-config apply step is required.
        return ResponseEntity.ok(Map.of("status",decision,"published",false));
    }
}
