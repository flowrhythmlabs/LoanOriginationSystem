package com.finedge.los.controller;

import com.finedge.los.dto.KycRequest;
import com.finedge.los.dto.KycResponse;
import com.finedge.los.service.KycService;
import com.finedge.los.service.KycProvider;
import com.finedge.los.service.DocumentUploadValidator;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class KycController {
    private static final Logger log = LoggerFactory.getLogger(KycController.class);

    private final KycService kycService;
    private final KycProvider kycProvider;

    public KycController(KycService kycService, KycProvider kycProvider) {
        this.kycService = kycService;
        this.kycProvider = kycProvider;
    }
    @PostMapping("/kyc/identity")
    public ResponseEntity<?> fetchIdentity(@RequestParam String documentType,
                                          @RequestParam(defaultValue = "") String number,
                                          @RequestParam(defaultValue = "false") boolean consent,
                                          @RequestParam(required = false) MultipartFile file) {
        if (!consent) throw new IllegalArgumentException("Explicit consent is required to fetch identity details.");
        if (!Set.of("AADHAAR", "PAN").contains(documentType)) {
            throw new IllegalArgumentException("Select Aadhaar or PAN.");
        }
        if (file != null) {
            DocumentUploadValidator.validate(file);
        } else if (!number.matches("AADHAAR".equals(documentType) ? "[2-9][0-9]{11}" : "[A-Z]{5}[0-9]{4}[A-Z]")) {
            throw new IllegalArgumentException("Enter a valid Aadhaar/PAN number or upload a document.");
        }
        try {
            Map<String, String> fields = kycProvider.fetchIdentityDetails(documentType, file == null ? number : "", file);
            if (fields == null || fields.values().stream().noneMatch(value -> value != null && !value.isBlank())) {
                log.warn("Identity provider returned no applicant details for document type {}", documentType);
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message",
                        "No identity details were returned. Please enter your details manually."));
            }
            var safeFields = new java.util.HashMap<>(fields);
            safeFields.computeIfPresent("aadhaarNumber", (key, value) ->
                    value.length() > 4 ? "XXXXXXXX" + value.substring(value.length() - 4) : value);
            return ResponseEntity.ok(Map.of("fields", safeFields));
        } catch (UnsupportedOperationException ex) {
            log.warn("Live identity extraction is not configured for document type {}", documentType);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message",
                    "Aadhaar/PAN identity fetching is not configured. Please enter your details manually."));
        }
    }

    @PostMapping("/applications/{applicationId}/kyc")
    public ResponseEntity<KycResponse> initiateKyc(@PathVariable Long applicationId,
                                                     @Valid @RequestBody KycRequest request) {
        request.setApplicationId(applicationId);
        return ResponseEntity.ok(KycResponse.fromEntity(kycService.initiateKyc(applicationId, request.getVerificationType())));
    }

    @GetMapping("/applications/{applicationId}/kyc")
    public ResponseEntity<KycResponse> getKyc(@PathVariable Long applicationId) {
        return ResponseEntity.ok(kycService.getKycForApplication(applicationId));
    }

    @PostMapping("/applications/{applicationId}/kyc/retry")
    public ResponseEntity<KycResponse> retryKyc(@PathVariable Long applicationId) {
        return ResponseEntity.ok(KycResponse.fromEntity(kycService.retryKyc(applicationId)));
    }
}
