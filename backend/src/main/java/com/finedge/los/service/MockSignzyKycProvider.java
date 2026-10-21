package com.finedge.los.service;

import com.finedge.los.dto.KycRequest;
import com.finedge.los.entity.KycVerification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class MockSignzyKycProvider implements KycProvider {
    private static final Logger log = LoggerFactory.getLogger(MockSignzyKycProvider.class);

    @Value("${mock.kyc.mode:SUCCESS}")
    private String defaultMode;

    @Override
    public KycVerification submitKyc(KycRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("KYC request payload is required");
        }

        String effectiveMode = request.getMockMode() != null && !request.getMockMode().isBlank()
                ? request.getMockMode()
                : defaultMode;

        KycVerification verification = new KycVerification();
        verification.setProvider("SIGNZY");
        verification.setRequestReferenceId(UUID.randomUUID().toString());
        verification.setProviderReferenceId(UUID.randomUUID().toString());
        verification.setRetryCount(0);

        String pan = request.getPanNumber() == null ? "" : request.getPanNumber().trim().toUpperCase();
        if (pan.isBlank()) {
            verification.setStatus(KycVerification.KycStatus.FAILED);
            verification.setFailureReason("Invalid PAN supplied for KYC verification");
            log.warn("Mock KYC rejected due to missing PAN for applicationId={}", request.getApplicationId());
            return verification;
        }

        if ("FAIL".equalsIgnoreCase(effectiveMode) || pan.contains("FAIL")) {
            verification.setStatus(KycVerification.KycStatus.FAILED);
            verification.setFailureReason("Provider declined the verification for the supplied customer record");
            log.warn("Mock KYC failed for applicationId={}, providerReferenceId={}", request.getApplicationId(), verification.getProviderReferenceId());
            return verification;
        }

        if ("MANUAL".equalsIgnoreCase(effectiveMode) || "MANUAL_REVIEW".equalsIgnoreCase(effectiveMode) || pan.contains("REVIEW")) {
            verification.setStatus(KycVerification.KycStatus.MANUAL_REVIEW);
            verification.setFailureReason("Manual review required by the KYC provider");
            log.info("Mock KYC requires manual review for applicationId={}, providerReferenceId={}", request.getApplicationId(), verification.getProviderReferenceId());
            return verification;
        }

        verification.setStatus(KycVerification.KycStatus.PENDING);
        verification.setFailureReason(null);

        if (request.getApplicationId() != null && request.getApplicationId() % 2 == 0) {
            verification.setStatus(KycVerification.KycStatus.VERIFIED);
        }

        if ("VERIFIED".equalsIgnoreCase(effectiveMode) || "SUCCESS".equalsIgnoreCase(effectiveMode) || pan.endsWith("A") || pan.endsWith("0")) {
            verification.setStatus(KycVerification.KycStatus.VERIFIED);
        }

        log.info("Mock KYC completed for applicationId={} with status={}", request.getApplicationId(), verification.getStatus());
        return verification;
    }

    @Override
    public Map<String, String> fetchIdentityDetails(String documentType, String number, MultipartFile file) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("fullName", "Rahul Sharma");
        fields.put("dateOfBirth", "1995-05-15");
        fields.put("gender", "Male");
        fields.put("fatherName", "Suresh Sharma");
        fields.put("residentialAddress", "123 Main Street, Varanasi, UP, 221006");
        fields.put("panNumber", "ABCDE1234F");
        if ("AADHAAR".equals(documentType)) {
            fields.put("aadhaarNumber", number != null && number.matches("[2-9][0-9]{11}")
                    ? "XXXXXXXX" + number.substring(8) : "XXXXXXXX9012");
        }
        log.info("Mock identity extraction returned demo details for documentType={}", documentType);
        return fields;
    }
}
