package com.finedge.los.controller;

import com.finedge.los.dto.ApplicantRequest;
import com.finedge.los.service.MockPanVerificationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mock")
public class MockController {

    private final MockPanVerificationService mockPanVerificationService;

    public MockController(MockPanVerificationService mockPanVerificationService) {
        this.mockPanVerificationService = mockPanVerificationService;
    }

    @PostMapping("/pan/verify")
    public ResponseEntity<?> verifyPan(@Valid @RequestBody ApplicantRequest request) {
        return ResponseEntity.ok(mockPanVerificationService.verify(request));
    }

}
