package com.finedge.los.service;

import com.finedge.los.dto.ApplicationResponse;
import com.finedge.los.dto.ApplicationDetailResponse;
import com.finedge.los.dto.CreateApplicationRequest;
import com.finedge.los.dto.LoanDetailsRequest;
import com.finedge.los.dto.SubmitApplicationRequest;
import com.finedge.los.entity.*;
import com.finedge.los.entity.LoanApplication.ApplicationStatus;
import com.finedge.los.exception.ResourceNotFoundException;
import com.finedge.los.repository.ApplicantRepository;
import com.finedge.los.repository.KycVerificationRepository;
import com.finedge.los.repository.LoanApplicationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class LoanApplicationService {
    private static final Logger logger = LoggerFactory.getLogger(LoanApplicationService.class);
    private final LoanApplicationRepository repository;
    private final ApplicantRepository applicantRepository;
    private final KycVerificationRepository kycVerificationRepository;
    private final KycProvider kycProvider;
    private final PanFormatValidationService panFormatValidationService;
    private final LosNumberGenerator losNumberGenerator;

    @Value("${app.loan.max-interest-rate:30}")
    private BigDecimal maxInterestRate;

    public LoanApplicationService(
            LoanApplicationRepository repository,
            ApplicantRepository applicantRepository,
            KycVerificationRepository kycVerificationRepository,
            KycProvider kycProvider,
            PanFormatValidationService panFormatValidationService,
            LosNumberGenerator losNumberGenerator) {
        this.repository = repository;
        this.applicantRepository = applicantRepository;
        this.kycVerificationRepository = kycVerificationRepository;
        this.kycProvider = kycProvider;
        this.panFormatValidationService = panFormatValidationService;
        this.losNumberGenerator = losNumberGenerator;
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> getAllApplications() {
        if (!hasAuthenticationContext()) {
            return repository.findAll().stream().map(ApplicationResponse::fromEntity).collect(Collectors.toList());
        }
        if (!isAdmin()) {
            throw new AccessDeniedException("Only admins can list applications");
        }
        return repository.findAll().stream().map(ApplicationResponse::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> getAdminApplications(String search, String status) {
        if (!hasAuthenticationContext()) {
            return repository.findAll().stream().map(ApplicationResponse::fromEntity).collect(Collectors.toList());
        }
        if (!isAdmin()) {
            throw new AccessDeniedException("Only admins can access the admin dashboard");
        }

            String normalizedSearch = search == null ? "" : search.trim().toLowerCase();
            if (normalizedSearch.length() > 100) {
                throw new IllegalArgumentException("Search value is too long");
            }
            ApplicationStatus normalizedStatus = status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)
                ? null
                : ApplicationStatus.valueOf(status.trim().toUpperCase());

            return repository.searchApplications(normalizedSearch, normalizedStatus).stream()
                .map(ApplicationResponse::fromEntity)
                .collect(Collectors.toList());
    }

            @Transactional(readOnly = true)
            public Map<String, Long> getApplicationCounts() {
            if (hasAuthenticationContext() && !isAdmin()) {
                throw new AccessDeniedException("Only admins can access the admin dashboard");
            }
            return Map.of(
                "total", repository.count(),
                "draft", repository.countByStatus(ApplicationStatus.DRAFT),
                "underReview", repository.countByStatus(ApplicationStatus.UNDER_REVIEW),
                "submitted", repository.countByStatus(ApplicationStatus.SUBMITTED));
            }

    @Transactional(readOnly = true)
    public LoanApplication getById(Long id) {
        LoanApplication application = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found with id: " + id));
        ensureApplicationAccess(application);
        return application;
    }

    @Transactional(readOnly = true)
    public ApplicationDetailResponse getApplicationDetails(Long id) {
        return ApplicationDetailResponse.fromEntity(getById(id));
    }

    @Transactional
    public ApplicationDetailResponse createApplicationDetails(CreateApplicationRequest request) {
        return ApplicationDetailResponse.fromEntity(createApplication(request));
    }

    @Transactional
    public ApplicationDetailResponse updateApplicationDetails(Long applicationId, CreateApplicationRequest request) {
        return ApplicationDetailResponse.fromEntity(updateApplication(applicationId, request));
    }

    @Transactional
    public ApplicationDetailResponse runCreditCheckDetails(Long applicationId, String creditScore) {
        return ApplicationDetailResponse.fromEntity(runCreditCheck(applicationId, creditScore));
    }

    @Transactional
    public ApplicationDetailResponse submitApplicationDetails(Long applicationId, SubmitApplicationRequest request) {
        return ApplicationDetailResponse.fromEntity(submitApplication(applicationId, request));
    }

    @Transactional
    public LoanApplication createApplication(CreateApplicationRequest request) {
        validateApplicationRequest(request);
        ensureCurrentUserOwnsApplicant(request.getApplicant());

        String normalizedPan = request.getApplicant().getPanNumber().toUpperCase();
        Applicant applicant = applicantRepository.findAllByPanNumber(normalizedPan)
                .stream()
                .findFirst()
                .orElseGet(Applicant::new);
        updateApplicant(applicant, request);

        LoanApplication application = new LoanApplication();
        application.setApplicant(applicant);
        application.setEmploymentDetails(createEmployment(request));
        application.setLoanDetails(createLoanDetails(request));
        application.setStatus(LoanApplication.ApplicationStatus.DRAFT);

        applicantRepository.save(applicant);
        return repository.save(application);
    }

    @Transactional
    public LoanApplication updateApplication(Long applicationId, CreateApplicationRequest request) {
        validateApplicationRequest(request);
        LoanApplication application = getById(applicationId);
        ensureCurrentUserOwnsApplicant(request.getApplicant());
        String priorPan = application.getApplicant().getPanNumber();
        String updatedPan = request.getApplicant().getPanNumber().toUpperCase();
        if (!priorPan.equals(updatedPan)) {
            kycVerificationRepository.findByLoanApplicationId(applicationId).ifPresent(verification -> {
                verification.setStatus(KycVerification.KycStatus.FAILED);
                verification.setFailureReason("Applicant PAN changed; rerun PAN format validation");
                kycVerificationRepository.save(verification);
            });
        }
        updateApplicant(application.getApplicant(), request);
        updateEmployment(application, request);
        updateLoanDetails(application, request);
        return repository.save(application);
    }

    private boolean hasAuthenticationContext() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getName());
    }

    private boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
    }

    private String getCurrentUserMobile() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            return null;
        }
        String principal = authentication.getName();
        if (principal == null || "admin".equals(principal)) {
            return null;
        }
        return principal.replaceAll("\\D+", "");
    }

    private void ensureApplicationAccess(LoanApplication application) {
        if (application == null) {
            return;
        }
        if (!hasAuthenticationContext()) {
            return;
        }
        if (isAdmin()) {
            return;
        }
        String currentMobile = getCurrentUserMobile();
        if (currentMobile == null || application.getApplicant() == null || application.getApplicant().getMobileNumber() == null) {
            throw new AccessDeniedException("User access denied");
        }
        if (!currentMobile.equals(application.getApplicant().getMobileNumber().replaceAll("\\D+", ""))) {
            throw new AccessDeniedException("User cannot access another user's application");
        }
    }

    private void ensureCurrentUserOwnsApplicant(com.finedge.los.dto.ApplicantRequest applicantRequest) {
        if (!hasAuthenticationContext()) {
            return;
        }
        if (isAdmin()) {
            return;
        }
        String currentMobile = getCurrentUserMobile();
        if (currentMobile == null || applicantRequest == null || applicantRequest.getMobileNumber() == null) {
            throw new AccessDeniedException("User must be authenticated to create or update applications");
        }
        if (!currentMobile.equals(applicantRequest.getMobileNumber().replaceAll("\\D+", ""))) {
            throw new AccessDeniedException("User cannot create or modify another user's application");
        }
    }

    private void validateApplicationRequest(CreateApplicationRequest request) {
        if (request == null || request.getApplicant() == null || request.getEmployment() == null || request.getLoanDetails() == null) {
            throw new IllegalArgumentException("Applicant, employment and loan details are required");
        }
        String mobileNumber = request.getApplicant().getMobileNumber();
        if (mobileNumber == null || !mobileNumber.matches("^[0-9]{10}$")) {
            throw new IllegalArgumentException("Please enter a valid 10-digit mobile number.");
        }

        var panResult = panFormatValidationService.validate(request.getApplicant());
        if (!panResult.isValid()) {
            throw new IllegalArgumentException(panResult.getMessage());
        }

        if (request.getEmployment().getMonthlyInHandSalary() == null
                || request.getEmployment().getMonthlyInHandSalary().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Monthly in-hand salary must be greater than zero");
        }

        validateLoanDetails(request.getLoanDetails());
    }

    private void validateLoanDetails(LoanDetailsRequest loanDetailsRequest) {
        if (loanDetailsRequest == null) {
            throw new IllegalArgumentException("Loan details are required");
        }
        if (loanDetailsRequest.getRequestedLoanAmount() == null || loanDetailsRequest.getRequestedLoanAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Loan amount must be greater than zero");
        }
        if (loanDetailsRequest.getInterestRate() == null) {
            throw new IllegalArgumentException("Interest rate is required");
        }
        if (loanDetailsRequest.getInterestRate().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Interest rate must be greater than or equal to 0%");
        }
        if (loanDetailsRequest.getInterestRate().compareTo(maxInterestRate) > 0) {
            throw new IllegalArgumentException("Interest rate must be less than or equal to " + maxInterestRate.stripTrailingZeros().toPlainString() + "%");
        }
        if (loanDetailsRequest.getPreferredTenure() == null || loanDetailsRequest.getPreferredTenure() <= 0) {
            throw new IllegalArgumentException("Preferred tenure must be greater than zero");
        }
        if (loanDetailsRequest.getPreferredTenure() < 1) {
            throw new IllegalArgumentException("Preferred tenure must be in months and greater than zero");
        }

        LoanEmiCalculator.calculateEmi(
                loanDetailsRequest.getRequestedLoanAmount(),
                loanDetailsRequest.getInterestRate(),
                loanDetailsRequest.getPreferredTenure()
        );
    }

    private void updateApplicant(Applicant applicant, CreateApplicationRequest request) {
        String normalizedPan = request.getApplicant().getPanNumber().toUpperCase();
        applicant.setFullName(request.getApplicant().getFullName());
        applicant.setDateOfBirth(request.getApplicant().getDateOfBirth());
        applicant.setPanNumber(normalizedPan);
        applicant.setMobileNumber(request.getApplicant().getMobileNumber());
        applicant.setEmail(request.getApplicant().getEmail());
        applicant.setWorkEmail(request.getApplicant().getWorkEmail());
        applicant.setResidentialAddress(request.getApplicant().getResidentialAddress());
        applicant.setCity(request.getApplicant().getCity());
        applicant.setState(request.getApplicant().getState());
        applicant.setPincode(request.getApplicant().getPincode());
    }

    private EmploymentDetails createEmployment(CreateApplicationRequest request) {
        EmploymentDetails employment = new EmploymentDetails();
        updateEmploymentDetails(employment, request);
        return employment;
    }

    private void updateEmployment(LoanApplication application, CreateApplicationRequest request) {
        EmploymentDetails employment = application.getEmploymentDetails();
        if (employment == null) {
            employment = new EmploymentDetails();
            application.setEmploymentDetails(employment);
        }
        updateEmploymentDetails(employment, request);
    }

    private void updateEmploymentDetails(EmploymentDetails employment, CreateApplicationRequest request) {
        employment.setEmploymentType(EmploymentDetails.EmploymentType.valueOf(request.getEmployment().getEmploymentType().toUpperCase()));
        employment.setEmployerName(request.getEmployment().getEmployerName());
        employment.setDesignation(request.getEmployment().getDesignation());
        employment.setTotalWorkExperienceYears(request.getEmployment().getTotalWorkExperienceYears());
        employment.setCurrentEmployerExperienceYears(request.getEmployment().getCurrentEmployerExperienceYears());
        employment.setMonthlyInHandSalary(request.getEmployment().getMonthlyInHandSalary());
        employment.setMonthlyGrossSalary(request.getEmployment().getMonthlyGrossSalary());
    }

    private LoanDetails createLoanDetails(CreateApplicationRequest request) {
        LoanDetails loanDetails = new LoanDetails();
        updateLoanDetails(loanDetails, request);
        return loanDetails;
    }

    private void updateLoanDetails(LoanApplication application, CreateApplicationRequest request) {
        LoanDetails loanDetails = application.getLoanDetails();
        if (loanDetails == null) {
            loanDetails = new LoanDetails();
            application.setLoanDetails(loanDetails);
        }
        updateLoanDetails(loanDetails, request);
    }

    private void updateLoanDetails(LoanDetails loanDetails, CreateApplicationRequest request) {
        loanDetails.setLoanType(LoanDetails.LoanType.valueOf(request.getLoanDetails().getLoanType().toUpperCase().replace("-", "_")));
        loanDetails.setRequestedLoanAmount(request.getLoanDetails().getRequestedLoanAmount());
        loanDetails.setInterestRate(request.getLoanDetails().getInterestRate());
        loanDetails.setPreferredTenure(request.getLoanDetails().getPreferredTenure());
        loanDetails.setPurposeOfLoan(request.getLoanDetails().getPurposeOfLoan());
    }

    @Transactional
    public LoanApplication runCreditCheck(Long applicationId, String scoreInput) {
        LoanApplication application = getById(applicationId);
        if (scoreInput == null || !scoreInput.matches("[0-9]+")) {
            throw new IllegalArgumentException("Credit score must be a whole number between 300 and 900");
        }
        int creditScore;
        try {
            creditScore = Integer.parseInt(scoreInput);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Credit score must be between 300 and 900");
        }
        if (creditScore < 300 || creditScore > 900) {
            throw new IllegalArgumentException("Credit score must be between 300 and 900");
        }

        CreditCheck creditCheck = application.getCreditCheck() == null ? new CreditCheck() : application.getCreditCheck();
        creditCheck.setCreditScore(creditScore);
        creditCheck.setBureau("MANUAL");
        creditCheck.setStatus(creditScore <= 649 ? "POOR" : creditScore <= 749 ? "FAIR" : "GOOD");
        creditCheck.setRemarks("Manually entered credit score");
        application.setCreditCheck(creditCheck);
        application.setStatus(LoanApplication.ApplicationStatus.CREDIT_CHECK_COMPLETED);
        return repository.save(application);
    }

    @Transactional
    public LoanApplication submitApplication(Long applicationId, SubmitApplicationRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Submission details are required");
        }
        LoanApplication application = getById(applicationId);
        if (!hasAllRequiredDocuments(application)) {
            throw new IllegalArgumentException("Please upload all required documents before submitting the application.");
        }
        Applicant applicant = application.getApplicant();
        if (applicant == null || applicant.getFullName() == null || applicant.getFullName().isBlank()) {
            throw new IllegalArgumentException("Customer name is required.");
        }
        if (request.getCustomerName() == null || !request.getCustomerName().trim().equals(applicant.getFullName().trim())) {
            throw new IllegalArgumentException("Customer name must match the application details.");
        }
        if (!"PAN_VERIFICATION".equalsIgnoreCase(request.getVerificationType() == null ? "" : request.getVerificationType().trim())) {
            throw new IllegalArgumentException("Only PAN Verification is currently supported.");
        }
        if (request.getPanNumber() == null || request.getPanNumber().isEmpty()) {
            throw new IllegalArgumentException("PAN number is required.");
        }
        if (!request.getPanNumber().matches("[A-Za-z]{5}[0-9]{4}[A-Za-z]")) {
            throw new IllegalArgumentException("Enter a valid PAN in the format ABCDE1234F.");
        }
        String normalizedPan = request.getPanNumber().toUpperCase(java.util.Locale.ROOT);
        if (applicant.getPanNumber() == null || !normalizedPan.equals(applicant.getPanNumber())) {
            throw new IllegalArgumentException("PAN must match the application details.");
        }
        if (!kycProvider.isPanFormatValid(normalizedPan)) {
            throw new IllegalArgumentException("Enter a valid PAN in the format ABCDE1234F.");
        }

        runCreditCheck(applicationId, request.getCreditScore());
        KycVerification verification = kycVerificationRepository.findByLoanApplicationId(applicationId)
                .orElseGet(KycVerification::new);
        verification.setLoanApplication(application);
        verification.setCustomerId(applicant.getId());
        verification.setVerificationType(KycVerification.VerificationType.PAN_VERIFICATION);
        verification.setProvider("LOCAL_PAN_FORMAT_VALIDATION");
        verification.setStatus(KycVerification.KycStatus.VALIDATION_PASSED);
        verification.setFailureReason(null);
        verification.setRetryCount(0);
        kycVerificationRepository.save(verification);
        if (application.getLosNumber() == null || application.getLosNumber().isBlank()) {
            application.setLosNumber(losNumberGenerator.generate());
        }
        application.setStatus(LoanApplication.ApplicationStatus.SUBMITTED);
        application.setUpdatedAt(LocalDateTime.now());
        return repository.save(application);
    }

    @Transactional
    public Document addDocument(Long applicationId, Document document) {
        logger.debug("Document service application lookup started: applicationId={} documentType={}", applicationId,
                document == null ? null : document.getDocumentType());
        LoanApplication application = getById(applicationId);
        logger.debug("Document service application lookup completed: applicationId={}", applicationId);
        if (document == null || document.getDocumentType() == null) {
            throw new IllegalArgumentException("Document type is required");
        }

        for (Document existing : application.getDocuments()) {
            if (existing.getDocumentType() == document.getDocumentType()) {
                logger.debug("Replacing existing document record: applicationId={} documentType={} documentId={}", applicationId, document.getDocumentType(), existing.getId());
                existing.setDocumentName(document.getDocumentName());
                existing.setFileName(document.getFileName());
                existing.setFilePath(document.getFilePath());
                existing.setContentType(document.getContentType());
                existing.setFileSize(document.getFileSize());
                existing.setStatus(Document.DocumentStatus.UPLOADED);
                existing.setUploadedAt(LocalDateTime.now());
                return repository.save(application).getDocuments().stream()
                        .filter(saved -> saved.getDocumentType() == document.getDocumentType())
                        .findFirst()
                        .orElse(existing);
            }
        }

        document.setLoanApplication(application);
        document.setStatus(Document.DocumentStatus.UPLOADED);
        document.setUploadedAt(LocalDateTime.now());
        application.getDocuments().add(document);
        LoanApplication savedApplication = repository.save(application);
        return savedApplication.getDocuments().stream()
            .filter(saved -> saved.getDocumentType() == document.getDocumentType())
            .findFirst()
            .orElse(document);
    }

    @Transactional(readOnly = true)
    public Document getDocument(Long applicationId, Long documentId) {
        LoanApplication application = getById(applicationId);
        return application.getDocuments().stream()
                .filter(document -> document.getId().equals(documentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Document not found with id: " + documentId));
    }

    @Transactional(readOnly = true)
    public List<Document> getDocuments(Long applicationId) {
        LoanApplication application = getById(applicationId);
        return application.getDocuments();
    }

    @Transactional(readOnly = true)
    public Document getDocumentByType(Long applicationId, Document.DocumentType documentType) {
        LoanApplication application = getById(applicationId);
        return application.getDocuments().stream()
                .filter(document -> document.getDocumentType() == documentType)
                .findFirst()
                .orElse(null);
    }

    @Transactional
    public void deleteDocument(Long applicationId, Long documentId) {
        LoanApplication application = getById(applicationId);
        application.getDocuments().removeIf(document -> document.getId().equals(documentId));
        repository.save(application);
    }

    public boolean hasAllRequiredDocuments(LoanApplication application) {
        if (application == null || application.getDocuments() == null) {
            return false;
        }

        Set<Document.DocumentType> uploadedTypes = application.getDocuments().stream()
                .filter(document -> document.getStatus() == Document.DocumentStatus.UPLOADED)
                .map(Document::getDocumentType)
                .collect(Collectors.toSet());

        return Arrays.stream(Document.DocumentType.values())
                .allMatch(uploadedTypes::contains);
    }
}
