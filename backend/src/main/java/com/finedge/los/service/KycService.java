package com.finedge.los.service;

import com.finedge.los.dto.KycRequest;
import com.finedge.los.dto.KycResponse;
import com.finedge.los.entity.KycVerification;
import com.finedge.los.entity.LoanApplication;
import com.finedge.los.exception.ResourceNotFoundException;
import com.finedge.los.repository.KycVerificationRepository;
import com.finedge.los.repository.LoanApplicationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class KycService {
    private static final Logger log = LoggerFactory.getLogger(KycService.class);

    private final KycVerificationRepository kycVerificationRepository;
    private final LoanApplicationRepository loanApplicationRepository;
    private final KycProvider kycProvider;
    private final KycAuditService kycAuditService;

    public KycService(KycVerificationRepository kycVerificationRepository,
                      LoanApplicationRepository loanApplicationRepository,
                      KycProvider kycProvider,
                      KycAuditService kycAuditService) {
        this.kycVerificationRepository = kycVerificationRepository;
        this.loanApplicationRepository = loanApplicationRepository;
        this.kycProvider = kycProvider;
        this.kycAuditService = kycAuditService;
    }

    @Transactional
    public KycVerification initiateKyc(Long applicationId, String verificationType) {
        LoanApplication application = loanApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found with id: " + applicationId));

        if (application.getApplicant() == null) {
            throw new IllegalArgumentException("Applicant details are required before starting KYC");
        }

        Optional<KycVerification> existing = kycVerificationRepository.findByLoanApplicationId(applicationId);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("KYC verification already exists for this application");
        }

        KycVerification.VerificationType type = parseVerificationType(verificationType);
        KycRequest request = new KycRequest(
                application.getId(),
                application.getApplicant().getId(),
                application.getApplicant().getPanNumber(),
                type.name());

        KycVerification verification = new KycVerification();
        verification.setLoanApplication(application);
        verification.setCustomerId(application.getApplicant().getId());
        verification.setVerificationType(type);
        verification.setStatus(KycVerification.KycStatus.INITIATED);
        verification.setProvider("SIGNZY");
        verification.setRequestReferenceId(UUID.randomUUID().toString());
        verification.setRetryCount(0);

        kycAuditService.audit("KYC_INITIATED", applicationId, null, "SIGNZY", KycVerification.KycStatus.INITIATED,
                "KYC initiated for application " + applicationId);

        KycVerification providerResult = kycProvider.submitKyc(request);
        verification.setStatus(providerResult.getStatus() != null ? providerResult.getStatus() : KycVerification.KycStatus.PENDING);
        verification.setProviderReferenceId(providerResult.getProviderReferenceId());
        verification.setFailureReason(providerResult.getFailureReason());
        verification.setRetryCount(providerResult.getRetryCount());

        KycVerification saved = kycVerificationRepository.save(verification);

        if (saved.getStatus() == KycVerification.KycStatus.VERIFIED) {
            log.info("KYC verification succeeded for applicationId={}, provider={}, status={}", applicationId, saved.getProvider(), saved.getStatus());
            kycAuditService.audit("KYC_VERIFIED", applicationId, saved.getId(), saved.getProvider(), saved.getStatus(), "Verification completed successfully");
        } else if (saved.getStatus() == KycVerification.KycStatus.MANUAL_REVIEW) {
            log.info("KYC verification requires manual review for applicationId={}, provider={}, status={}", applicationId, saved.getProvider(), saved.getStatus());
            kycAuditService.audit("KYC_MANUAL_REVIEW", applicationId, saved.getId(), saved.getProvider(), saved.getStatus(), "Manual review required");
        } else if (saved.getStatus() == KycVerification.KycStatus.FAILED) {
            log.warn("KYC verification failed for applicationId={}, provider={}, failureReason={}", applicationId, saved.getProvider(), saved.getFailureReason());
            kycAuditService.audit("KYC_FAILED", applicationId, saved.getId(), saved.getProvider(), saved.getStatus(), saved.getFailureReason());
        } else {
            kycAuditService.audit("KYC_PENDING", applicationId, saved.getId(), saved.getProvider(), saved.getStatus(), "KYC request submitted to provider");
        }

        return saved;
    }

    public KycResponse getKycForApplication(Long applicationId) {
        loanApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found with id: " + applicationId));

        KycVerification verification = kycVerificationRepository.findByLoanApplicationId(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("KYC verification does not exist for this application"));

        return KycResponse.fromEntity(verification);
    }

    public KycVerification retryKyc(Long applicationId) {
        KycVerification verification = kycVerificationRepository.findByLoanApplicationId(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("KYC verification not found for application id: " + applicationId));

        if (verification.getStatus() == KycVerification.KycStatus.VERIFIED) {
            return verification;
        }

        int retryCount = verification.getRetryCount() + 1;
        verification.setRetryCount(retryCount);
        KycRequest request = new KycRequest(
                verification.getLoanApplication().getId(),
                verification.getCustomerId(),
                verification.getLoanApplication().getApplicant() != null ? verification.getLoanApplication().getApplicant().getPanNumber() : null,
                verification.getVerificationType().name());

        kycAuditService.audit("KYC_RETRY", applicationId, verification.getId(), verification.getProvider(), verification.getStatus(), "Retry attempt=" + retryCount);

        KycVerification providerResult = kycProvider.submitKyc(request);
        verification.setStatus(providerResult.getStatus() != null ? providerResult.getStatus() : KycVerification.KycStatus.PENDING);
        verification.setProviderReferenceId(providerResult.getProviderReferenceId());
        verification.setFailureReason(providerResult.getFailureReason());
        verification.setRetryCount(Math.max(retryCount, providerResult.getRetryCount()));

        KycVerification saved = kycVerificationRepository.save(verification);
        kycAuditService.audit("KYC_RETRY_RESULT", applicationId, saved.getId(), saved.getProvider(), saved.getStatus(), saved.getFailureReason());
        return saved;
    }

    private KycVerification.VerificationType parseVerificationType(String verificationType) {
        if (verificationType == null || verificationType.isBlank()) {
            return KycVerification.VerificationType.PAN_VERIFICATION;
        }
        try {
            return KycVerification.VerificationType.valueOf(verificationType.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported KYC verification type: " + verificationType);
        }
    }
}
