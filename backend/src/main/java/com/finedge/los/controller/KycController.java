package com.finedge.los.controller;

import com.finedge.los.dto.KycRequest;
import com.finedge.los.dto.KycResponse;
import com.finedge.los.entity.KycVerification;
import com.finedge.los.service.KycService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class KycController {

    private final KycService kycService;

    public KycController(KycService kycService) {
        this.kycService = kycService;
    }

    @PostMapping("/applications/{applicationId}/kyc")
    public ResponseEntity<KycVerification> initiateKyc(@PathVariable Long applicationId,
                                                     @Valid @RequestBody KycRequest request) {
        request.setApplicationId(applicationId);
        return ResponseEntity.ok(kycService.initiateKyc(applicationId, request.getVerificationType()));
    }

    @GetMapping("/applications/{applicationId}/kyc")
    public ResponseEntity<KycResponse> getKyc(@PathVariable Long applicationId) {
        return ResponseEntity.ok(kycService.getKycForApplication(applicationId));
    }

    @PostMapping("/applications/{applicationId}/kyc/retry")
    public ResponseEntity<KycVerification> retryKyc(@PathVariable Long applicationId) {
        return ResponseEntity.ok(kycService.retryKyc(applicationId));
    }
}
