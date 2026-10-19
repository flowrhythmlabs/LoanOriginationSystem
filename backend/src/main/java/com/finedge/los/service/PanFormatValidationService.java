package com.finedge.los.service;

import com.finedge.los.dto.ApplicantRequest;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
public class PanFormatValidationService {
    private static final Pattern PAN_PATTERN = Pattern.compile("^[A-Z]{5}[0-9]{4}[A-Z]$");

    public PanFormatValidationResult validate(ApplicantRequest request) {
        if (request == null || request.getPanNumber() == null || !PAN_PATTERN.matcher(request.getPanNumber()).matches()) {
            return new PanFormatValidationResult(false, "Enter a valid PAN in the format ABCDE1234F.");
        }
        return new PanFormatValidationResult(true, "PAN format is valid.");
    }

    public static class PanFormatValidationResult {
        private final boolean valid;
        private final String message;

        public PanFormatValidationResult(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }

        public boolean isValid() { return valid; }
        public String getMessage() { return message; }
    }
}