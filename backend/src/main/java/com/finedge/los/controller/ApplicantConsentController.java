package com.finedge.los.controller;

import com.finedge.los.entity.LoanApplication;
import com.finedge.los.repository.LoanApplicationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

/** Consent ledger: explicit applicant action only. No bureau call is made by this controller. */
@RestController
@RequestMapping("/api/applications/{applicationId}/consents")
public class ApplicantConsentController {
    private static final Set<String> PURPOSES = Set.of("KYC", "BUREAU_SOFT", "BUREAU_HARD", "BANK_STATEMENT");
    private final LoanApplicationRepository applications;
    private final JdbcTemplate jdbc;
    public ApplicantConsentController(LoanApplicationRepository applications, JdbcTemplate jdbc) {
        this.applications = applications; this.jdbc = jdbc;
    }
    public record ConsentInput(String purpose, String consentVersion, String consentTextHash, boolean granted) {}
    private LoanApplication owned(Long id, Authentication authentication) {
        if (authentication == null || authentication.getName() == null ||
            authentication.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_APPLICANT")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Applicant authentication required");
        LoanApplication app = applications.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        if (!authentication.getName().equals(app.getApplicant().getMobileNumber()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");
        return app;
    }
    @PostMapping
    @org.springframework.transaction.annotation.Transactional
    public Map<String,Object> record(@PathVariable Long applicationId, @RequestBody ConsentInput input,
                                     Authentication authentication) {
        LoanApplication app = owned(applicationId, authentication);
        if (input == null || !PURPOSES.contains(input.purpose()) ||
            input.consentVersion() == null || !input.consentVersion().matches("[A-Za-z0-9._-]{1,60}") ||
            input.consentTextHash() == null || !input.consentTextHash().matches("[a-fA-F0-9]{64}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid purpose, consent version and SHA-256 text hash required");
        // Both grant and refusal are audit events. Never infer consent from login or a prior checkbox.
        jdbc.update("INSERT INTO los_consent_record (application_id, applicant_id, purpose, consent_version, consent_text_hash, granted, actor_reference, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            app.getId(), app.getApplicant().getId(), input.purpose(), input.consentVersion(),
            input.consentTextHash().toLowerCase(java.util.Locale.ROOT), input.granted(), authentication.getName(), "SELF_SERVICE");
        return Map.of("purpose", input.purpose(), "granted", input.granted(), "recordedAt", Instant.now().toString());
    }
    @GetMapping("/{purpose}/status")
    public Map<String,Object> status(@PathVariable Long applicationId, @PathVariable String purpose,
                                     Authentication authentication) {
        owned(applicationId, authentication);
        if (!PURPOSES.contains(purpose)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown purpose");
        var records = jdbc.queryForList("SELECT granted, consent_version, captured_at, expires_at FROM los_consent_record WHERE application_id = ? AND purpose = ? ORDER BY captured_at DESC, id DESC LIMIT 1", applicationId, purpose);
        if (records.isEmpty()) return Map.of("purpose", purpose, "valid", false, "state", "NOT_CAPTURED");
        var record = records.get(0);
        boolean valid = Boolean.TRUE.equals(record.get("granted")) &&
            (record.get("expires_at") == null || ((java.sql.Timestamp)record.get("expires_at")).toInstant().isAfter(Instant.now()));
        return Map.of("purpose", purpose, "valid", valid, "state", valid ? "GRANTED" : "DECLINED_OR_EXPIRED",
            "version", String.valueOf(record.get("consent_version")));
    }
}
