package com.finedge.los.controller;

import com.finedge.los.entity.LoanApplication;
import com.finedge.los.service.LoanApplicationService;
import com.finedge.los.service.DocumentStorageService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.nio.file.Files;
import java.nio.file.Path;
import java.io.IOException;
import com.finedge.los.repository.LoanApplicationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/staff/underwriting")
public class StaffUnderwritingController {
    private final JdbcTemplate db;
    private final LoanApplicationService loanService;
    private final DocumentStorageService documentStorage;
    private final LoanApplicationRepository applications;
    private final com.finedge.los.service.StaffRuntimeSettings runtimeSettings;
    public StaffUnderwritingController(JdbcTemplate db, LoanApplicationRepository applications, LoanApplicationService loanService, DocumentStorageService documentStorage,
            com.finedge.los.service.StaffRuntimeSettings runtimeSettings) {
        this.db = db; this.applications = applications; this.loanService = loanService; this.documentStorage = documentStorage;
        this.runtimeSettings = runtimeSettings;
    }
    public record DecisionInput(String action, String reasonCode, String notes) {}

    @GetMapping("/context")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','OPERATIONS','SUPER_ADMIN','COMPLIANCE_AUDIT')")
    public Map<String,Object> context(Authentication auth) {
        List<String> roles=auth.getAuthorities().stream().map(a->a.getAuthority()).toList();
        String stage=roles.contains("ROLE_SUPER_ADMIN")?"ALL":roles.contains("ROLE_OPERATIONS")?"OPERATIONS":
                roles.contains("ROLE_CREDIT_MANAGER")?"CREDIT_MANAGER":roles.contains("ROLE_CREDIT_UNDERWRITER")?"CREDIT_UNDERWRITER":
                roles.contains("ROLE_APPLICATION_PROCESSOR")?"APPLICATION_PROCESSOR":"AUDIT";
        return Map.of("stage",stage,"roles",roles);
    }
    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','OPERATIONS','SUPER_ADMIN','COMPLIANCE_AUDIT')")
    public List<Map<String,Object>> queue(@RequestParam(defaultValue="0") int page,
                                          @RequestParam(defaultValue="20") int size, Authentication auth) {
        int limit=Math.max(1,Math.min(size,100)), offset=Math.max(0,page)*limit;
        boolean all=auth.getAuthorities().stream().anyMatch(a->Set.of("ROLE_SUPER_ADMIN","ROLE_COMPLIANCE_AUDIT").contains(a.getAuthority()));
        boolean processor=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_APPLICATION_PROCESSOR"));
        boolean underwriter=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_CREDIT_UNDERWRITER"));
        boolean manager=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_CREDIT_MANAGER"));
        boolean operations=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_OPERATIONS"));
        String stageFilter=all?"":processor?" AND (last_action.action IS NULL OR last_action.action='SEND_BACK') ":
            underwriter?" AND last_action.action='PROCESS_FORWARD' ":
            manager?" AND last_action.action IN ('RECOMMEND_APPROVE','RECOMMEND_DECLINE','HOLD') ":
            operations?" AND a.status='APPROVED' ":" AND 1=0 ";
        return db.queryForList("""
            SELECT a.id, a.los_number AS application_number, a.status, a.updated_at,
                   l.loan_type, l.requested_loan_amount, ap.full_name AS applicant_name,
                   last_action.action AS last_action
            FROM loan_applications a
            LEFT JOIN loan_details l ON l.id=a.loan_details_id
            LEFT JOIN applicants ap ON ap.id=a.applicant_id
            LEFT JOIN LATERAL (SELECT action FROM los_underwriting_action WHERE application_id=a.id ORDER BY created_at DESC,id DESC LIMIT 1) last_action ON true
            WHERE a.status <> 'DRAFT' 
            """ + stageFilter + " ORDER BY a.updated_at DESC, a.id DESC LIMIT ? OFFSET ?", limit, offset);
    }
    @GetMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','OPERATIONS','SUPER_ADMIN','COMPLIANCE_AUDIT')")
    public ResponseEntity<?> review(@PathVariable long id) {
        if (!applications.existsById(id)) return ResponseEntity.notFound().build();
        var detail=applications.findById(id).orElseThrow();
        var applicant=detail.getApplicant();
        var employment=detail.getEmploymentDetails();
        var loan=detail.getLoanDetails();
        Map<String,Object> response=new LinkedHashMap<>();
        response.put("application",com.finedge.los.dto.ApplicationDetailResponse.fromEntity(detail));
        response.put("documents",db.queryForList("SELECT id,document_type,document_name,status,verification_remarks,uploaded_at FROM documents WHERE loan_application_id=? ORDER BY id",id));
        response.put("verifications",db.queryForList("SELECT check_type,outcome,evidence_reference,notes,reviewer_username,created_at FROM los_manual_verification WHERE application_id=? ORDER BY created_at DESC,id DESC",id));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/documents/{documentId}/preview")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','OPERATIONS','SUPER_ADMIN','COMPLIANCE_AUDIT')")
    public ResponseEntity<InputStreamResource> previewDocument(@PathVariable long id, @PathVariable long documentId) throws IOException {
        var matches=db.queryForList("SELECT file_path,file_name,content_type FROM documents WHERE id=? AND loan_application_id=?",documentId,id);
        if(matches.isEmpty())return ResponseEntity.notFound().build();
        var document=matches.get(0);
        Path path=documentStorage.resolve((String)document.get("file_path"));
        if(!Files.isRegularFile(path))return ResponseEntity.notFound().build();
        String type=(String)document.get("content_type");
        if(!Set.of("application/pdf","image/jpeg","image/png").contains(type))
            return ResponseEntity.status(415).build();
        String safeName=(document.get("file_name")==null?"document":String.valueOf(document.get("file_name"))).replaceAll("[\\r\\n\"]","_");
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,"inline; filename=\""+safeName+"\"")
            .header("X-Content-Type-Options","nosniff")
            .header("Cache-Control","no-store")
            .contentLength(Files.size(path))
            .contentType(MediaType.parseMediaType(type))
            .body(new InputStreamResource(Files.newInputStream(path)));
    }
    @GetMapping("/{id}/timeline")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','OPERATIONS','SUPER_ADMIN','COMPLIANCE_AUDIT')")
    public List<Map<String,Object>> timeline(@PathVariable long id) {
        if (!applications.existsById(id)) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
        return db.queryForList("""
            SELECT u.action, u.reason_code, u.notes, s.username AS actor, u.created_at
            FROM los_underwriting_action u JOIN staff_account s ON s.id=u.staff_id
            WHERE u.application_id=? ORDER BY u.created_at DESC, u.id DESC
            """,id);
    }

    @PostMapping("/{id}/decision")
    @Transactional
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER')")
    public ResponseEntity<?> decision(@PathVariable long id,@RequestBody DecisionInput input,Authentication auth) {
        if(input==null || input.action()==null || !Set.of("RECOMMEND_APPROVE","RECOMMEND_DECLINE","APPROVE","DECLINE","HOLD","SEND_BACK","PROCESS_FORWARD").contains(input.action()))
            return ResponseEntity.badRequest().body(Map.of("message","Unsupported action"));
        if(input.reasonCode()==null || !input.reasonCode().matches("[A-Z0-9_]{3,80}"))
            return ResponseEntity.badRequest().body(Map.of("message","Mandatory reason code (uppercase letters, numbers, underscore)"));
        if(input.notes()!=null && input.notes().length()>4000)
            return ResponseEntity.badRequest().body(Map.of("message","Notes too long"));
        boolean manager=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_CREDIT_MANAGER"));
        boolean processor=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_APPLICATION_PROCESSOR"));
        boolean recommendation=input.action().startsWith("RECOMMEND_");
        if ((processor && !input.action().equals("PROCESS_FORWARD")) ||
            (!processor && input.action().equals("PROCESS_FORWARD")) ||
            (recommendation && manager) || (!recommendation && !manager && !processor))
            return ResponseEntity.status(403).body(Map.of("message","Action is not allowed for this role"));
        Long staffId=db.query("SELECT id FROM staff_account WHERE username=? AND enabled=true",rs->rs.next()?rs.getLong(1):null,auth.getName());
        if(staffId==null)return ResponseEntity.status(403).build();
        // Row lock serializes concurrent decisions for this application.
        var locked=db.queryForList("SELECT id, status, loan_details_id FROM loan_applications WHERE id=? FOR UPDATE",id);
        if(locked.isEmpty())return ResponseEntity.notFound().build();
        String status=String.valueOf(locked.get(0).get("status"));
        if(!Set.of("SUBMITTED","UNDER_REVIEW","DOCUMENTS_PENDING","CREDIT_CHECK_COMPLETED").contains(status))
            return ResponseEntity.status(409).body(Map.of("message","Application is not in a reviewable state"));
        var details=db.queryForList("SELECT loan_type,requested_loan_amount FROM loan_details WHERE id=?",locked.get(0).get("loan_details_id"));
        if(details.isEmpty() || details.get(0).get("requested_loan_amount")==null)
            return ResponseEntity.status(409).body(Map.of("message","Loan details are incomplete"));
        BigDecimal amount=(BigDecimal)details.get(0).get("requested_loan_amount");
        String loanType=String.valueOf(details.get(0).get("loan_type"));
        List<Map<String,Object>> last=db.queryForList(
            "SELECT action FROM los_underwriting_action WHERE application_id=? ORDER BY created_at DESC,id DESC LIMIT 1",id);
        String lastAction=last.isEmpty()?"":String.valueOf(last.get(0).get("action"));
        if(processor && !(lastAction.isEmpty() || "SEND_BACK".equals(lastAction)))
            return ResponseEntity.status(409).body(Map.of("message","Application is not assigned to the processor queue"));
        if(recommendation && !"PROCESS_FORWARD".equals(lastAction))
            return ResponseEntity.status(409).body(Map.of("message","Processor must forward before underwriting recommendation"));
        if(manager && !Set.of("RECOMMEND_APPROVE","RECOMMEND_DECLINE","HOLD").contains(lastAction))
            return ResponseEntity.status(409).body(Map.of("message","Underwriter recommendation required before manager decision"));
        if(input.action().equals("APPROVE")) {
            var authority=db.queryForList("SELECT maximum_amount FROM los_approval_authority WHERE role_code='CREDIT_MANAGER' AND loan_type=? AND enabled=true",loanType);
            if(authority.isEmpty() || amount.compareTo((BigDecimal)authority.get(0).get("maximum_amount"))>0)
                return ResponseEntity.status(403).body(Map.of("message","No approved authority for this product and amount"));
            // Do not approve until KYC, bureau, consent, policy, fraud and income verification gates are implemented.
            if (!runtimeSettings.demoApprovalEnabled()) return ResponseEntity.status(409).body(Map.of("message",
                    "Live approval disabled: regulated verification integrations and policy gates are not configured"));
            var prior=db.queryForList("""
                SELECT u.action, s.username FROM los_underwriting_action u JOIN staff_account s ON s.id=u.staff_id
                WHERE u.application_id=? ORDER BY u.created_at DESC,u.id DESC LIMIT 1
                """,id);
            if(prior.isEmpty() || !"RECOMMEND_APPROVE".equals(prior.get(0).get("action")))
                return ResponseEntity.status(409).body(Map.of("message","Underwriter approval recommendation is required"));
            if(auth.getName().equals(prior.get(0).get("username")))
                return ResponseEntity.status(409).body(Map.of("message","Maker and checker must be different staff accounts"));
            var reviews=db.queryForList("""
                SELECT check_type,outcome FROM los_manual_verification
                WHERE application_id=? ORDER BY created_at DESC,id DESC
                """,id);
            Map<String,String> latest=new HashMap<>();
            for(var r:reviews) latest.putIfAbsent(String.valueOf(r.get("check_type")),String.valueOf(r.get("outcome")));
            for(String required:List.of("KYC","BUREAU","INCOME","BANK_ACCOUNT","FRAUD","POLICY","DOCUMENTS"))
                if(!"PASS".equals(latest.get(required)))
                    return ResponseEntity.status(409).body(Map.of("message","Approval requires latest PASS review: "+required));
            var scoreRows=db.queryForList("""
                SELECT cc.score_source,cc.status FROM loan_applications a
                LEFT JOIN credit_checks cc ON cc.id=a.credit_check_id
                WHERE a.id=?
                """,id);
            String scoreSource=scoreRows.isEmpty() || scoreRows.get(0).get("score_source")==null
                    ? "" : String.valueOf(scoreRows.get(0).get("score_source"));
            if(scoreSource.isBlank())
                return ResponseEntity.status(409).body(Map.of("message","Credit score source is missing; save the credit score again"));
            if("MANUAL".equals(scoreSource)) {
            } else if("BUREAU_API".equals(scoreSource)) {
                var consent=db.queryForList("""
                    SELECT granted,(expires_at IS NOT NULL AND expires_at > now()) AS current_consent FROM los_consent_record
                    WHERE application_id=? AND purpose='BUREAU_HARD'
                    ORDER BY captured_at DESC,id DESC LIMIT 1
                    """,id);
                if(consent.isEmpty() || !Boolean.TRUE.equals(consent.get(0).get("granted"))
                        || !Boolean.TRUE.equals(consent.get(0).get("current_consent")))
                    return ResponseEntity.status(409).body(Map.of("message","Current hard bureau consent is required for an online hard enquiry"));
            } else {
                return ResponseEntity.status(409).body(Map.of("message","Unsupported credit score source"));
            }
        }
        if(input.action().equals("PROCESS_FORWARD")) {
            Integer passed=db.queryForObject("SELECT count(DISTINCT check_type) FROM los_manual_verification WHERE application_id=? AND outcome='PASS'",Integer.class,id);
            if(passed==null || passed==0) return ResponseEntity.status(409).body(Map.of("message","Record at least one documented manual review before forwarding"));
        }
        db.update("INSERT INTO los_underwriting_action(application_id,staff_id,action,reason_code,notes,requested_amount) VALUES (?,?,?,?,?,?)",
                id,staffId,input.action(),input.reasonCode(),input.notes(),amount);
        String next=input.action().equals("APPROVE")?"APPROVED":
                input.action().equals("DECLINE")?"REJECTED":input.action().equals("SEND_BACK")?"DOCUMENTS_PENDING":"UNDER_REVIEW";
        db.update("UPDATE loan_applications SET status=?,updated_at=now() WHERE id=?",next,id);
        db.update("INSERT INTO staff_audit_event(staff_id,application_id,action,reason_code) VALUES (?,?,?,?)",staffId,id,input.action(),input.reasonCode());
        return ResponseEntity.ok(Map.of("applicationId",id,"action",input.action(),"status",next,
                "demoOnly",input.action().equals("APPROVE")));
    }
}
