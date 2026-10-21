package com.finedge.los.dto;

import com.finedge.los.entity.KycVerification;

public class KycRequest {
    private Long applicationId;
    private Long customerId;
    private String panNumber;
    private String verificationType;
    private String provider = "SIGNZY";
    private String mockMode;

    public KycRequest() {}

    public KycRequest(Long applicationId, Long customerId, String panNumber, String verificationType) {
        this.applicationId = applicationId;
        this.customerId = customerId;
        this.panNumber = panNumber;
        this.verificationType = verificationType;
    }

    public KycVerification.VerificationType getVerificationTypeEnum() {
        return verificationType == null ? KycVerification.VerificationType.PAN_VERIFICATION
                : KycVerification.VerificationType.valueOf(verificationType.trim().toUpperCase());
    }

    public Long getApplicationId() { return applicationId; }
    public void setApplicationId(Long applicationId) { this.applicationId = applicationId; }
    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }
    public String getPanNumber() { return panNumber; }
    public void setPanNumber(String panNumber) { this.panNumber = panNumber; }
    public String getVerificationType() { return verificationType; }
    public void setVerificationType(String verificationType) { this.verificationType = verificationType; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getMockMode() { return mockMode; }
    public void setMockMode(String mockMode) { this.mockMode = mockMode; }
}
