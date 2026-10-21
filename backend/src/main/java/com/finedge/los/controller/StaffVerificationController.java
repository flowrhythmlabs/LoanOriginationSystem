package com.finedge.los.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** Manual review evidence ledger; never represents a live provider verification. */
@RestController
@RequestMapping("/api/staff/verification")
public class StaffVerificationController {
    private static final Set<String> CHECKS = Set.of("KYC", "BUREAU", "INCOME", "BANK_ACCOUNT", "FRAUD", "POLICY", "DOCUMENTS");
    private static final Set<String> OUTCOMES = Set.of("PASS", "FAIL", "PENDING");
    private final JdbcTemplate db;
    public StaffVerificationController(JdbcTemplate db) { this.db = db; }
    public record ReviewInput(String checkType, String outcome, String evidenceReference, String notes) {}

    @GetMapping("/{applicationId}")
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','COMPLIANCE_AUDIT')")
    public ResponseEntity<?> checks(@PathVariable long applicationId) {
        if (db.queryForObject("SELECT count(*) FROM loan_applications WHERE id=?",Integer.class,applicationId)==0)
            return ResponseEntity.notFound().build();
        return ResponseEntity.ok(db.queryForList("""
            SELECT v.check_type,v.outcome,v.evidence_reference,v.notes,v.reviewer_username,v.created_at
            FROM los_manual_verification v WHERE v.application_id=?
            ORDER BY v.created_at DESC,v.id DESC
            """, applicationId));
    }

    @PostMapping("/{applicationId}")
    @Transactional
    @PreAuthorize("hasAnyRole('APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER')")
    public ResponseEntity<?> record(@PathVariable long applicationId, @RequestBody ReviewInput input, Authentication auth) {
        if(input==null || !CHECKS.contains(input.checkType()) || !OUTCOMES.contains(input.outcome()))
            return ResponseEntity.badRequest().body(Map.of("message","Invalid check type or outcome"));
        if(input.evidenceReference()==null || input.evidenceReference().isBlank() || input.evidenceReference().length()>250)
            return ResponseEntity.badRequest().body(Map.of("message","Evidence reference is mandatory (max 250 characters)"));
        if(input.notes()!=null && input.notes().length()>2000)
            return ResponseEntity.badRequest().body(Map.of("message","Notes exceed 2000 characters"));
        if(db.queryForObject("SELECT count(*) FROM loan_applications WHERE id=?",Integer.class,applicationId)==0)
            return ResponseEntity.notFound().build();
        db.update("""
            INSERT INTO los_manual_verification(application_id,check_type,outcome,evidence_reference,notes,reviewer_username)
            VALUES(?,?,?,?,?,?)
            """,applicationId,input.checkType(),input.outcome(),input.evidenceReference().trim(),input.notes(),auth.getName());
        return ResponseEntity.ok(Map.of("message","Manual evidence recorded; provider verification not implied"));
    }
}
