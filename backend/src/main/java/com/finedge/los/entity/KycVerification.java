package com.finedge.los.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "kyc_verifications")
public class KycVerification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_application_id", nullable = false, unique = true)
    private LoanApplication loanApplication;

    @Column(name = "customer_id")
    private Long customerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VerificationType verificationType = VerificationType.PAN_VERIFICATION;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private KycStatus status = KycStatus.INITIATED;

    @Column(nullable = false, length = 64)
    private String provider = "SIGNZY";

    @Column(length = 128)
    private String requestReferenceId;

    @Column(length = 128)
    private String providerReferenceId;

    @Column(length = 512)
    private String failureReason;

    @Column(nullable = false)
    private int retryCount;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum VerificationType {
        PAN_VERIFICATION,
        AADHAAR_VERIFICATION
    }

    public enum KycStatus {
        INITIATED,
        PENDING,
        VERIFIED,
        FAILED,
        MANUAL_REVIEW
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public LoanApplication getLoanApplication() { return loanApplication; }
    public void setLoanApplication(LoanApplication loanApplication) { this.loanApplication = loanApplication; }
    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }
    public VerificationType getVerificationType() { return verificationType; }
    public void setVerificationType(VerificationType verificationType) { this.verificationType = verificationType; }
    public KycStatus getStatus() { return status; }
    public void setStatus(KycStatus status) { this.status = status; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
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
