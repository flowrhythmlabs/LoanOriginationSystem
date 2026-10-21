package com.finedge.los.dto;

import com.finedge.los.entity.KycVerification;

import java.time.LocalDateTime;

public class KycResponse {
    private Long id;
    private Long applicationId;
    private Long customerId;
    private String provider;
    private String verificationType;
    private String status;
    private String requestReferenceId;
    private String providerReferenceId;
    private String failureReason;
    private int retryCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static KycResponse fromEntity(KycVerification verification) {
        KycResponse response = new KycResponse();
        if (verification == null) {
            return response;
        }
        response.id = verification.getId();
        response.applicationId = verification.getLoanApplication() != null ? verification.getLoanApplication().getId() : null;
        response.customerId = verification.getCustomerId();
        response.provider = verification.getProvider();
        response.verificationType = verification.getVerificationType() != null ? verification.getVerificationType().name() : null;
        response.status = verification.getStatus() != null ? verification.getStatus().name() : null;
        response.requestReferenceId = verification.getRequestReferenceId();
        response.providerReferenceId = verification.getProviderReferenceId();
        response.failureReason = verification.getFailureReason();
        response.retryCount = verification.getRetryCount();
        response.createdAt = verification.getCreatedAt();
        response.updatedAt = verification.getUpdatedAt();
        return response;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getApplicationId() { return applicationId; }
    public void setApplicationId(Long applicationId) { this.applicationId = applicationId; }
    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getVerificationType() { return verificationType; }
    public void setVerificationType(String verificationType) { this.verificationType = verificationType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRequestReferenceId() { return requestReferenceId; }
    public void setRequestReferenceId(String requestReferenceId) { this.requestReferenceId = requestReferenceId; }
    public String getProviderReferenceId() { return providerReferenceId; }
    public void setProviderReferenceId(String providerReferenceId) { this.providerReferenceId = providerReferenceId; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public int getRetryCount() { return retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
