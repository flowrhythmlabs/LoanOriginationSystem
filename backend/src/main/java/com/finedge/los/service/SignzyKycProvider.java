package com.finedge.los.service;

import com.finedge.los.dto.KycRequest;
import com.finedge.los.entity.KycVerification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SignzyKycProvider implements KycProvider {
    private static final Logger log = LoggerFactory.getLogger(SignzyKycProvider.class);

    @Value("${signzy.base-url:}")
    private String baseUrl;

    @Value("${signzy.api-key:}")
    private String apiKey;

    @Value("${signzy.auth-token:}")
    private String authToken;

    @Value("${signzy.client-id:}")
    private String clientId;

    @Value("${signzy.client-secret:}")
    private String clientSecret;

    @Value("${mock.kyc.mode:SUCCESS}")
    private String mockMode;

    @Override
    public KycVerification submitKyc(KycRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("KYC request payload is required");
        }

        if (request.getPanNumber() == null || request.getPanNumber().isBlank()) {
            KycVerification verification = new KycVerification();
            verification.setStatus(KycVerification.KycStatus.FAILED);
            verification.setProvider("SIGNZY");
            verification.setFailureReason("Invalid PAN supplied for KYC verification");
            verification.setRequestReferenceId(UUID.randomUUID().toString());
            verification.setProviderReferenceId(UUID.randomUUID().toString());
            verification.setRetryCount(0);
            return verification;
        }

        if (baseUrl == null || baseUrl.isBlank()) {
            log.info("Signzy base-url not configured; using mock provider flow for local demo. mode={}", mockMode);
            return simulateProviderResponse(request);
        }

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Signzy API key is not configured; falling back to mock provider response");
            return simulateProviderResponse(request);
        }

        return simulateProviderResponse(request);
    }

    private KycVerification simulateProviderResponse(KycRequest request) {
        KycVerification verification = new KycVerification();
        verification.setProvider("SIGNZY");
        verification.setRequestReferenceId(UUID.randomUUID().toString());
        verification.setProviderReferenceId(UUID.randomUUID().toString());
        verification.setRetryCount(0);

        String normalized = (request.getPanNumber() == null ? "" : request.getPanNumber().trim()).toUpperCase();
        boolean isFailureScenario = "FAIL".equalsIgnoreCase(mockMode) || normalized.contains("FAIL");
        boolean isManualReviewScenario = "MANUAL".equalsIgnoreCase(mockMode) || normalized.contains("REVIEW");

        if (isFailureScenario) {
            verification.setStatus(KycVerification.KycStatus.FAILED);
            verification.setFailureReason("Provider declined the verification for the supplied customer record");
            return verification;
        }

        if (isManualReviewScenario) {
            verification.setStatus(KycVerification.KycStatus.MANUAL_REVIEW);
            verification.setFailureReason("Manual review required by the KYC provider");
            return verification;
        }

        verification.setStatus(KycVerification.KycStatus.PENDING);
        verification.setFailureReason(null);

        int lastDigit = normalized.isEmpty() ? 0 : normalized.charAt(normalized.length() - 1);
        if (lastDigit % 2 == 0) {
            verification.setStatus(KycVerification.KycStatus.VERIFIED);
        }

        return verification;
    }
}
