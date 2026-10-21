package com.finedge.los.controller;

import com.finedge.los.entity.LoanApplication;
import com.finedge.los.repository.LoanApplicationRepository;
import org.springframework.http.ResponseEntity;
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
    private final LoanApplicationRepository applications;
    public StaffUnderwritingController(JdbcTemplate db, LoanApplicationRepository applications) {
        this.db = db; this.applications = applications;
    }
    public record DecisionInput(String action, String reasonCode, String notes) {}

    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','COMPLIANCE_AUDIT')")
    public List<Map<String,Object>> queue(@RequestParam(defaultValue="0") int page,
                                          @RequestParam(defaultValue="20") int size) {
        int limit=Math.max(1,Math.min(size,100)), offset=Math.max(0,page)*limit;
        return db.queryForList("""
            SELECT a.id, a.los_number AS application_number, a.status, a.updated_at,
                   l.loan_type, l.requested_loan_amount
            FROM loan_applications a LEFT JOIN loan_details l ON l.id=a.loan_details_id
            WHERE a.status <> 'DRAFT' ORDER BY a.updated_at DESC, a.id DESC LIMIT ? OFFSET ?
            """, limit, offset);
    }

    @GetMapping("/{id}/timeline")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','COMPLIANCE_AUDIT')")
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
    @PreAuthorize("hasAnyRole('CREDIT_UNDERWRITER','CREDIT_MANAGER')")
    public ResponseEntity<?> decision(@PathVariable long id,@RequestBody DecisionInput input,Authentication auth) {
        if(input==null || input.action()==null || !Set.of("RECOMMEND_APPROVE","RECOMMEND_DECLINE","APPROVE","DECLINE","HOLD","SEND_BACK").contains(input.action()))
            return ResponseEntity.badRequest().body(Map.of("message","Unsupported action"));
        if(input.reasonCode()==null || !input.reasonCode().matches("[A-Z0-9_]{3,80}"))
            return ResponseEntity.badRequest().body(Map.of("message","Mandatory reason code (uppercase letters, numbers, underscore)"));
        if(input.notes()!=null && input.notes().length()>4000)
            return ResponseEntity.badRequest().body(Map.of("message","Notes too long"));
        boolean manager=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_CREDIT_MANAGER"));
        boolean recommendation=input.action().startsWith("RECOMMEND_");
        if(recommendation && manager || !recommendation && !manager)
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
        if(input.action().equals("APPROVE")) {
            var authority=db.queryForList("SELECT maximum_amount FROM los_approval_authority WHERE role_code='CREDIT_MANAGER' AND loan_type=? AND enabled=true",loanType);
            if(authority.isEmpty() || amount.compareTo((BigDecimal)authority.get(0).get("maximum_amount"))>0)
                return ResponseEntity.status(403).body(Map.of("message","No approved authority for this product and amount"));
            // Do not approve until KYC, bureau, consent, policy, fraud and income verification gates are implemented.
            return ResponseEntity.status(409).body(Map.of("message","Approval blocked: mandatory verification and policy gates are not integrated"));
        }
        db.update("INSERT INTO los_underwriting_action(application_id,staff_id,action,reason_code,notes,requested_amount) VALUES (?,?,?,?,?,?)",
                id,staffId,input.action(),input.reasonCode(),input.notes(),amount);
        String next=input.action().equals("DECLINE")?"REJECTED":input.action().equals("SEND_BACK")?"DOCUMENTS_PENDING":"UNDER_REVIEW";
        db.update("UPDATE loan_applications SET status=?,updated_at=now() WHERE id=?",next,id);
        db.update("INSERT INTO staff_audit_event(staff_id,application_id,action,reason_code) VALUES (?,?,?,?)",staffId,id,input.action(),input.reasonCode());
        return ResponseEntity.ok(Map.of("applicationId",id,"action",input.action(),"status",next));
    }
}
