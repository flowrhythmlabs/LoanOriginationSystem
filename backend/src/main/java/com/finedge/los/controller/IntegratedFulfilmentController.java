package com.finedge.los.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Controlled demo fulfilment workflow. Never moves funds, signs legal agreements, or calls a lender. */
@RestController
@RequestMapping("/api/fulfilment")
public class IntegratedFulfilmentController {
    private final JdbcTemplate db;
    private final boolean demo;
    public IntegratedFulfilmentController(JdbcTemplate db,
       @Value("${finedge.demo.enabled:false}") boolean demo,
       org.springframework.core.env.Environment environment) {
       this.db=db; this.demo=demo && java.util.Arrays.asList(environment.getActiveProfiles()).contains("demo"); }
    public record OfferInput(BigDecimal sanctionedAmount, BigDecimal annualRate, int tenureMonths,
                             int validDays, String agreementVersion, String reasonCode) {}
    public record ActionInput(String reasonCode, String reference) {}
    private void requireDemo() {
        if(!demo) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "Provider integration not configured. Simulated fulfilment is disabled.");
    }
    private void applicantOwner(long id, Authentication auth) {
        if(auth==null || auth.getAuthorities().stream().noneMatch(a->a.getAuthority().equals("ROLE_APPLICANT")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        Integer count=db.queryForObject("SELECT count(*) FROM loan_applications a JOIN applicants p ON a.applicant_id=p.id WHERE a.id=? AND p.mobile_number=?",Integer.class,id,auth.getName());
        if(count==null || count==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    private void checkApplication(long id) {
        Integer n=db.queryForObject("SELECT count(*) FROM loan_applications WHERE id=?",Integer.class,id);
        if(n==null || n==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    private Map<String,Object> latest(long id) {
        var rows=db.queryForList("SELECT id, status, sanctioned_amount, annual_rate, tenure_months, valid_until, agreement_version, created_by FROM los_offer WHERE application_id=? ORDER BY id DESC LIMIT 1",id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No offer exists");
        return rows.get(0);
    }
    private String status(Map<String,Object> row) { return String.valueOf(row.get("status")); }
    private long offerId(Map<String,Object> row) { return ((Number)row.get("id")).longValue(); }
    @GetMapping("/{applicationId}/offer")
    @PreAuthorize("hasAnyRole('APPLICANT','APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER','OPERATIONS','COMPLIANCE_AUDIT')")
    public Map<String,Object> offer(@PathVariable long applicationId, Authentication auth) {
        if(auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_APPLICANT"))) applicantOwner(applicationId,auth);
        else checkApplication(applicationId);
        return latest(applicationId);
    }
    @PostMapping("/{applicationId}/offer")
    @Transactional
    @PreAuthorize("hasRole('CREDIT_MANAGER')")
    public Map<String,Object> createOffer(@PathVariable long applicationId,@RequestBody OfferInput input,Authentication auth) {
        requireDemo(); checkApplication(applicationId);
        if(input==null || input.sanctionedAmount()==null || input.sanctionedAmount().signum()<=0 ||
           input.annualRate()==null || input.annualRate().signum()<0 || input.annualRate().compareTo(new BigDecimal("40"))>0 ||
           input.tenureMonths()<1 || input.tenureMonths()>360 || input.validDays()<1 || input.validDays()>30 ||
           input.agreementVersion()==null || !input.agreementVersion().matches("[A-Za-z0-9._-]{1,40}") ||
           input.reasonCode()==null || !input.reasonCode().matches("[A-Z0-9_]{3,80}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid offer inputs");
        // Only manual evidence is available in this demo. No final loan approval is inferred.
        var reviews=db.queryForList("SELECT check_type,outcome FROM los_manual_verification WHERE application_id=? ORDER BY created_at DESC,id DESC",applicationId);
        Map<String,String> newest=new HashMap<>();
        for(var r:reviews) newest.putIfAbsent(String.valueOf(r.get("check_type")),String.valueOf(r.get("outcome")));
        for(String required:List.of("KYC","BUREAU","INCOME","BANK_ACCOUNT","FRAUD","POLICY","DOCUMENTS"))
            if(!"PASS".equals(newest.get(required)))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Missing manual review PASS: "+required);
        var consent=db.queryForList("SELECT granted FROM los_consent_record WHERE application_id=? AND purpose='BUREAU_HARD' ORDER BY captured_at DESC,id DESC LIMIT 1",applicationId);
        if(consent.isEmpty() || !Boolean.TRUE.equals(consent.get(0).get("granted")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Current hard bureau consent required");
        // Offer is DEMO_DRAFT, not a sanction; actual verification/provider and credit authority are not proven.
        db.update("INSERT INTO los_offer(application_id,status,sanctioned_amount,annual_rate,tenure_months,valid_until,agreement_version,created_by) VALUES (?,'DEMO_DRAFT',?,?,?,now()+(? * interval '1 day'),?,?)",
            applicationId,input.sanctionedAmount(),input.annualRate(),input.tenureMonths(),input.validDays(),input.agreementVersion(),auth.getName());
        audit(applicationId,auth.getName(),"DEMO_OFFER_DRAFT",input.reasonCode());
        return latest(applicationId);
    }
    @PostMapping("/{applicationId}/accept")
    @Transactional
    @PreAuthorize("hasRole('APPLICANT')")
    public Map<String,Object> accept(@PathVariable long applicationId,Authentication auth) {
        requireDemo(); applicantOwner(applicationId,auth);
        var offer=latest(applicationId);
        if(!"DEMO_DRAFT".equals(status(offer)) || ((java.sql.Timestamp)offer.get("valid_until")).toInstant().isBefore(Instant.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Offer unavailable or expired");
        db.update("UPDATE los_offer SET status='DEMO_ACCEPTED',accepted_at=now() WHERE id=? AND status='DEMO_DRAFT'",offerId(offer));
        audit(applicationId,auth.getName(),"DEMO_OFFER_ACCEPTED","APPLICANT_ACCEPTED");
        return latest(applicationId);
    }
    @PostMapping("/{applicationId}/simulate/{step}")
    @Transactional
    @PreAuthorize("hasRole('OPERATIONS')")
    public Map<String,Object> simulate(@PathVariable long applicationId,@PathVariable String step,
                                     @RequestBody ActionInput input,Authentication auth) {
        requireDemo(); checkApplication(applicationId);
        if(input==null || input.reasonCode()==null || !input.reasonCode().matches("[A-Z0-9_]{3,80}") ||
            input.reference()==null || !input.reference().matches("[A-Za-z0-9._/-]{3,100}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Reason and test reference required");
        String from,to;
        switch(step) {
            case "esign" -> {from="DEMO_ACCEPTED";to="DEMO_ESIGNED";}
            case "mandate" -> {from="DEMO_ESIGNED";to="DEMO_MANDATE_READY";}
            case "disbursement" -> {from="DEMO_MANDATE_READY";to="DEMO_DISBURSED";}
            case "lms" -> {from="DEMO_DISBURSED";to="DEMO_LMS_SYNCED";}
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown step");
        }
        var offer=latest(applicationId);
        if(!from.equals(status(offer))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Required state: "+from);
        db.update("UPDATE los_offer SET status=? WHERE id=? AND status=?",to,offerId(offer),from);
        db.update("INSERT INTO los_demo_fulfilment_event(offer_id,step,reference,actor,reason_code) VALUES(?,?,?,?,?)",
           offerId(offer),step,input.reference(),auth.getName(),input.reasonCode());
        audit(applicationId,auth.getName(),to,input.reasonCode());
        return latest(applicationId);
    }
    private void audit(long app,String actor,String action,String reason) {
        db.update("INSERT INTO los_demo_audit(application_id,actor,action,reason_code) VALUES(?,?,?,?)",app,actor,action,reason);
    }
}
