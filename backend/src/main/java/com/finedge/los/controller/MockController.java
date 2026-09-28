package com.finedge.los.controller;

import com.finedge.los.dto.ApplicantRequest;
import com.finedge.los.service.MockCreditBureauService;
import com.finedge.los.service.MockPanVerificationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mock")
public class MockController {

    private final MockPanVerificationService mockPanVerificationService;
    private final MockCreditBureauService mockCreditBureauService;

    public MockController(MockPanVerificationService mockPanVerificationService, MockCreditBureauService mockCreditBureauService) {
        this.mockPanVerificationService = mockPanVerificationService;
        this.mockCreditBureauService = mockCreditBureauService;
    }

    @PostMapping("/pan/verify")
    public ResponseEntity<?> verifyPan(@Valid @RequestBody ApplicantRequest request) {
        return ResponseEntity.ok(mockPanVerificationService.verify(request));
    }

    @GetMapping("/credit-score/{pan}")
    public ResponseEntity<?> getCreditScore(@PathVariable String pan) {
        return ResponseEntity.ok(mockCreditBureauService.evaluate(pan));
    }
}
