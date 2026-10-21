package com.finedge.los.service;

import com.finedge.los.dto.ApplicantRequest;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
public class MockPanVerificationService {
    private static final Pattern PAN_PATTERN = Pattern.compile("^[A-Z]{5}[0-9]{4}[A-Z]$");

    public PanVerificationResponse verify(ApplicantRequest request) {
        if (request == null || request.getPanNumber() == null || !PAN_PATTERN.matcher(request.getPanNumber()).matches()) {
            return new PanVerificationResponse(false, "Invalid PAN format");
        }
        return new PanVerificationResponse(true, "PAN verification successful");
    }

    public static class PanVerificationResponse {
        private boolean verified;
        private String message;

        public PanVerificationResponse(boolean verified, String message) {
            this.verified = verified;
            this.message = message;
        }

        public boolean isVerified() { return verified; }
        public void setVerified(boolean verified) { this.verified = verified; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
