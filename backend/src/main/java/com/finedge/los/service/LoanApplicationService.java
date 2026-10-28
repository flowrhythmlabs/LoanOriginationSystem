package com.finedge.los.service;

import com.finedge.los.dto.ApplicationResponse;
import com.finedge.los.dto.ApplicationDetailResponse;
import com.finedge.los.dto.CreateApplicationRequest;
import com.finedge.los.dto.LoanDetailsRequest;
import com.finedge.los.entity.*;
import com.finedge.los.exception.ResourceNotFoundException;
import com.finedge.los.repository.ApplicantRepository;
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
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class LoanApplicationService {
    private static final Logger logger = LoggerFactory.getLogger(LoanApplicationService.class);
    private final LoanApplicationRepository repository;
    private final ApplicantRepository applicantRepository;
    private final MockPanVerificationService panVerificationService;
    private final MockCreditBureauService mockCreditBureauService;
    private final LosNumberGenerator losNumberGenerator;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Value("${app.loan.max-interest-rate:30}")
    private BigDecimal maxInterestRate;

    @Value("${app.loan.rates.personal:10.5}") private BigDecimal personalLoanRate;
    @Value("${app.loan.rates.home:10.5}") private BigDecimal homeLoanRate;
    @Value("${app.loan.rates.car:10.5}") private BigDecimal carLoanRate;
    @Value("${app.loan.rates.education:10.5}") private BigDecimal educationLoanRate;
    @Value("${app.loan.rates.business:10.5}") private BigDecimal businessLoanRate;
    @Value("${app.loan.rates.lap:10.5}") private BigDecimal lapLoanRate;
    public LoanApplicationService(
            LoanApplicationRepository repository,
            ApplicantRepository applicantRepository,
            MockPanVerificationService panVerificationService,
            MockCreditBureauService mockCreditBureauService,
            LosNumberGenerator losNumberGenerator, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.repository = repository;
        this.applicantRepository = applicantRepository;
        this.panVerificationService = panVerificationService;
        this.mockCreditBureauService = mockCreditBureauService;
        this.losNumberGenerator = losNumberGenerator;
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> getAllApplications() {
        if (!hasAuthenticationContext()) {
            return repository.findAll().stream().map(ApplicationResponse::fromEntity).collect(Collectors.toList());
        }
        if (isAdmin()) {
            return repository.findAll().stream().map(ApplicationResponse::fromEntity).collect(Collectors.toList());
        }
        String currentMobile = getCurrentUserMobile();
        if (currentMobile == null) throw new AccessDeniedException("Authenticated user identity is missing");
        return repository.findAll().stream()
                .filter(application -> application.getApplicant() != null && application.getApplicant().getMobileNumber() != null)
                .filter(application -> currentMobile.equals(application.getApplicant().getMobileNumber().replaceAll("\\D+", "")))
                .map(ApplicationResponse::fromEntity).collect(Collectors.toList());
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
        String normalizedStatus = status == null || "ALL".equalsIgnoreCase(status) ? "" : status.toUpperCase();

        return repository.findAll().stream()
                .filter(application -> application.getApplicant() != null)
                .filter(application -> {
                    if (!normalizedSearch.isEmpty()) {
                        String losNumber = application.getLosNumber() == null ? "" : application.getLosNumber().toLowerCase();
                        String applicantName = application.getApplicant().getFullName() == null ? "" : application.getApplicant().getFullName().toLowerCase();
                        String mobile = application.getApplicant().getMobileNumber() == null ? "" : application.getApplicant().getMobileNumber();
                        boolean matchesSearch = losNumber.contains(normalizedSearch)
                                || applicantName.contains(normalizedSearch)
                                || mobile.contains(normalizedSearch);
                        if (!matchesSearch) {
                            return false;
                        }
                    }
                    if (!normalizedStatus.isEmpty() && application.getStatus() != null
                            && !application.getStatus().name().equals(normalizedStatus)) {
                        return false;
                    }
                    return true;
                })
                .map(ApplicationResponse::fromEntity)
                .collect(Collectors.toList());
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
    public ApplicationDetailResponse runCreditCheckDetails(Long applicationId) {
        return ApplicationDetailResponse.fromEntity(runCreditCheck(applicationId));
    }

    @Transactional
    public ApplicationDetailResponse submitApplicationDetails(Long applicationId) {
        return ApplicationDetailResponse.fromEntity(submitApplication(applicationId));
    }

    @Transactional(readOnly = true)
    public BigDecimal getConfiguredInterestRate(String loanType) {
        BigDecimal rate = configuredRateFor(loanType);
        if (rate == null || rate.compareTo(BigDecimal.ZERO) < 0 || rate.compareTo(maxInterestRate) > 0) {
            throw new IllegalStateException("Configured loan pricing is invalid. Contact the administrator.");
        }
        return rate;
    }
    @Transactional
    public LoanApplication createApplication(CreateApplicationRequest request) {
        validateApplicationRequest(request);
        ensureCurrentUserOwnsApplicant(request.getApplicant());

        String requestedLoanType = request.getLoanDetails().getLoanType();
        if (requestedLoanType != null && !requestedLoanType.isBlank()) {
            LoanDetails.LoanType type = LoanDetails.LoanType.valueOf(requestedLoanType.toUpperCase().replace("-", "_"));
            var activeByMobile = repository.findByApplicant_MobileNumberAndLoanDetails_LoanTypeAndStatusIn(request.getApplicant().getMobileNumber(), type,
                    List.of(LoanApplication.ApplicationStatus.DRAFT, LoanApplication.ApplicationStatus.DOCUMENTS_PENDING, LoanApplication.ApplicationStatus.CREDIT_CHECK_COMPLETED));
            if (!activeByMobile.isEmpty()) throw new IllegalArgumentException("An active draft already exists for this loan product (Temporary ID: DRAFT-" + activeByMobile.get(0).getId() + "). Resume it from your dashboard.");
        }
        String panValue = request.getApplicant().getPanNumber();
        String normalizedPan = panValue == null || panValue.isBlank() ? null : panValue.toUpperCase();
        Applicant applicant = normalizedPan == null ? new Applicant() : applicantRepository.findAllByPanNumber(normalizedPan).stream().findFirst().orElseGet(Applicant::new);
        if (applicant.getId() != null && request.getLoanDetails().getLoanType() != null && !request.getLoanDetails().getLoanType().isBlank()) {
            LoanDetails.LoanType requestedType = LoanDetails.LoanType.valueOf(request.getLoanDetails().getLoanType().toUpperCase().replace("-", "_"));
            var active = repository.findByApplicant_IdAndLoanDetails_LoanTypeAndStatusIn(applicant.getId(), requestedType,
                    List.of(LoanApplication.ApplicationStatus.DRAFT, LoanApplication.ApplicationStatus.DOCUMENTS_PENDING, LoanApplication.ApplicationStatus.CREDIT_CHECK_COMPLETED));
            if (!active.isEmpty()) {
                throw new IllegalArgumentException("An active application already exists for this loan product (Temporary ID: DRAFT-" + active.get(0).getId() + "). Resume it from your dashboard instead of starting another draft.");
            }
        }
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
        String mobile = request.getApplicant().getMobileNumber();
        if (mobile == null || !mobile.matches("^[0-9]{10}$")) throw new IllegalArgumentException("Please enter a valid 10-digit mobile number.");
        String name = request.getApplicant().getFullName();
        if (name != null && !name.isBlank() && !name.matches("[A-Za-z .'-]+")) throw new IllegalArgumentException("Full name should contain letters only.");
        String pan = request.getApplicant().getPanNumber();
        if (pan != null && !pan.isBlank() && !pan.toUpperCase().matches("[A-Z]{5}[0-9]{4}[A-Z]")) throw new IllegalArgumentException("PAN should look like ABCDE1234F.");
        for (String email : List.of(request.getApplicant().getEmail() == null ? "" : request.getApplicant().getEmail(), request.getApplicant().getWorkEmail() == null ? "" : request.getApplicant().getWorkEmail())) {
            if (!email.isBlank() && !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new IllegalArgumentException("Enter a valid email address.");
        }
        String pin = request.getApplicant().getPincode();
        if (pin != null && !pin.isBlank() && !pin.matches("^[1-9][0-9]{5}$")) throw new IllegalArgumentException("PIN code must be a valid 6-digit Indian PIN code.");
        var applicantExtra = request.getApplicant().getAdditionalDetails();
        var employmentExtra = request.getEmployment().getAdditionalDetails();
        for (String email : List.of(
                applicantExtra.getOrDefault("coApplicantEmail", ""), applicantExtra.getOrDefault("coApplicantWorkEmail", ""), applicantExtra.getOrDefault("guarantorEmail", ""),
                employmentExtra.getOrDefault("officialEmail", ""), employmentExtra.getOrDefault("businessEmail", ""))) {
            if (email != null && !email.isBlank() && !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new IllegalArgumentException("One of the employer, business, co-applicant or guarantor email addresses is invalid.");
        }
        String designation = request.getEmployment().getDesignation();
        if (designation != null && !designation.isBlank() && !designation.matches("[A-Za-z .'-]+")) throw new IllegalArgumentException("Designation should contain letters only.");
        String employmentType = request.getEmployment().getEmploymentType();
        if (employmentType != null && !employmentType.isBlank()) {
            try { EmploymentDetails.EmploymentType.valueOf(employmentType.toUpperCase()); }
            catch (IllegalArgumentException ex) { throw new IllegalArgumentException("Select a valid employment type."); }
        }
        String loanType = request.getLoanDetails().getLoanType();
        if (loanType != null && !loanType.isBlank()) configuredRateFor(loanType);
        BigDecimal income = request.getEmployment().getMonthlyInHandSalary();
        if (income != null && income.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Monthly income cannot be negative.");
        BigDecimal amount = request.getLoanDetails().getRequestedLoanAmount();
        if (amount != null && amount.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Loan amount cannot be negative.");
        var extra = request.getLoanDetails().getAdditionalDetails();
        if (extra != null) {
            BigDecimal charges = BigDecimal.ZERO;
            for (String key : List.of("processingFees", "gstOnFees", "insuranceCharges")) {
                String raw = extra.get(key);
                if (raw != null && !raw.isBlank()) {
                    try { BigDecimal fee = new BigDecimal(raw); if (fee.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException(key + " must be zero or greater."); charges = charges.add(fee); }
                    catch (NumberFormatException ex) { throw new IllegalArgumentException(key + " must be a valid amount."); }
                }
            }
            if (amount != null && charges.compareTo(amount) > 0) throw new IllegalArgumentException("Total fees and charges cannot exceed the requested loan amount.");
            String date = extra.get("scheduledDisbursalDate");
            if (date != null && !date.isBlank()) { try { if (java.time.LocalDate.parse(date).isBefore(java.time.LocalDate.now())) throw new IllegalArgumentException("Scheduled disbursal date cannot be in the past."); } catch (java.time.format.DateTimeParseException ex) { throw new IllegalArgumentException("Scheduled disbursal date must be a valid date."); } }
        }
    }

    private void validateCompleteApplication(LoanApplication application) {
        Applicant applicant = application.getApplicant();
        if (applicant.getFullName() == null || !applicant.getFullName().matches("[A-Za-z .'-]+")) throw new IllegalArgumentException("Full name is required and should contain letters only.");
        if (applicant.getDateOfBirth() == null || !applicant.getDateOfBirth().isBefore(java.time.LocalDate.now())) throw new IllegalArgumentException("Enter a valid date of birth.");
        if (applicant.getPanNumber() == null || !applicant.getPanNumber().matches("[A-Z]{5}[0-9]{4}[A-Z]")) throw new IllegalArgumentException("PAN should look like ABCDE1234F.");
        if (applicant.getMobileNumber() == null || !applicant.getMobileNumber().matches("^[0-9]{10}$")) throw new IllegalArgumentException("Please enter a valid 10-digit mobile number.");
        if (applicant.getEmail() == null || !applicant.getEmail().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new IllegalArgumentException("Enter a valid personal email address.");
        if (!blank(applicant.getWorkEmail()) && !applicant.getWorkEmail().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new IllegalArgumentException("Enter a valid work email address.");
        if (blank(applicant.getResidentialAddress()) || blank(applicant.getCity()) || blank(applicant.getState())) throw new IllegalArgumentException("Residential address, city and state are required.");
        if (applicant.getPincode() == null || !applicant.getPincode().matches("^[1-9][0-9]{5}$")) throw new IllegalArgumentException("PIN code must be a valid 6-digit Indian PIN code.");
        var panResult = panVerificationService.verify(toApplicantRequest(applicant));
        if (!panResult.isVerified()) throw new IllegalArgumentException(panResult.getMessage());
        EmploymentDetails employment = application.getEmploymentDetails();
        if (employment == null || employment.getEmploymentType() == null) throw new IllegalArgumentException("Select an employment type.");
        if (employment.getMonthlyInHandSalary() == null || employment.getMonthlyInHandSalary().compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Monthly income must be greater than zero.");
        if (employment.getEmploymentType() == EmploymentDetails.EmploymentType.SALARIED && (blank(employment.getEmployerName()) || blank(employment.getDesignation()))) throw new IllegalArgumentException("Employer name and designation are required for salaried applicants.");
        var employmentExtra = employment.getAdditionalDetails();
        if (employment.getEmploymentType() == EmploymentDetails.EmploymentType.SELF_EMPLOYED) {
            if (employmentExtra == null || blank(employmentExtra.get("profession")) || blank(employmentExtra.get("practiceBusinessName")) || blank(employmentExtra.get("businessAddress")) || blank(employmentExtra.get("natureOfWork"))) throw new IllegalArgumentException("Profession, practice/business name, business address and nature of work are required for self-employed applicants.");
        }
        if (employment.getEmploymentType() == EmploymentDetails.EmploymentType.BUSINESS_OWNER) {
            if (employmentExtra == null || blank(employmentExtra.get("practiceBusinessName")) || blank(employmentExtra.get("businessPan")) || !employmentExtra.get("businessPan").matches("[A-Z]{5}[0-9]{4}[A-Z]") || blank(employmentExtra.get("constitution")) || blank(employmentExtra.get("natureOfWork")) || blank(employmentExtra.get("registeredAddress"))) throw new IllegalArgumentException("Business name, valid business PAN, constitution, nature of business and registered address are required.");
            if ("Yes".equalsIgnoreCase(employmentExtra.get("gstRegistered")) && blank(employmentExtra.get("gstin"))) throw new IllegalArgumentException("GSTIN is required when the business is GST registered.");
        }
        LoanDetails loan = application.getLoanDetails();
        if (loan == null) throw new IllegalArgumentException("Loan details are required.");
        LoanDetailsRequest request = new LoanDetailsRequest(); request.setLoanType(loan.getLoanType() == null ? null : loan.getLoanType().name()); request.setRequestedLoanAmount(loan.getRequestedLoanAmount()); request.setInterestRate(loan.getInterestRate()); request.setPreferredTenure(loan.getPreferredTenure()); request.setPurposeOfLoan(loan.getPurposeOfLoan()); request.setAdditionalDetails(loan.getAdditionalDetails());
        validateLoanDetails(request);
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }
    private com.finedge.los.dto.ApplicantRequest toApplicantRequest(Applicant applicant) {
        var request = new com.finedge.los.dto.ApplicantRequest(); request.setFullName(applicant.getFullName()); request.setDateOfBirth(applicant.getDateOfBirth()); request.setPanNumber(applicant.getPanNumber()); request.setMobileNumber(applicant.getMobileNumber()); request.setEmail(applicant.getEmail()); request.setWorkEmail(applicant.getWorkEmail()); request.setResidentialAddress(applicant.getResidentialAddress()); request.setCity(applicant.getCity()); request.setState(applicant.getState()); request.setPincode(applicant.getPincode()); request.setAdditionalDetails(applicant.getAdditionalDetails()); return request;
    }
    private void validateLoanDetails(LoanDetailsRequest loanDetailsRequest) {
        if (loanDetailsRequest == null) {
            throw new IllegalArgumentException("Loan details are required");
        }
        if (blank(loanDetailsRequest.getPurposeOfLoan())) throw new IllegalArgumentException("Purpose of loan is required.");
        if (loanDetailsRequest.getRequestedLoanAmount() == null || loanDetailsRequest.getRequestedLoanAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Loan amount must be greater than zero");
        }
        BigDecimal configuredInterestRate = configuredRateFor(loanDetailsRequest.getLoanType());
        if (configuredInterestRate == null || configuredInterestRate.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalStateException("Loan pricing is not configured correctly");
        }
        if (configuredInterestRate.compareTo(maxInterestRate) > 0) {
            throw new IllegalStateException("Configured loan pricing exceeds the permitted maximum. Contact the administrator.");
        }
        if (loanDetailsRequest.getPreferredTenure() == null || loanDetailsRequest.getPreferredTenure() <= 0) {
            throw new IllegalArgumentException("Preferred tenure must be greater than zero");
        }
        if (loanDetailsRequest.getPreferredTenure() < 1) {
            throw new IllegalArgumentException("Preferred tenure must be in months and greater than zero");
        }
        var product = getProductPricing(loanDetailsRequest.getLoanType());
        BigDecimal amount = loanDetailsRequest.getRequestedLoanAmount();
        BigDecimal min = (BigDecimal) product.get("minAmount");
        BigDecimal max = (BigDecimal) product.get("maxAmount");
        if (amount.compareTo(min) < 0 || amount.compareTo(max) > 0) {
            throw new IllegalArgumentException("Requested loan amount must be between " + min + " and " + max);
        }
        int minTenure = (Integer) product.get("minTenure");
        int maxTenure = (Integer) product.get("maxTenure");
        if (loanDetailsRequest.getPreferredTenure() < minTenure || loanDetailsRequest.getPreferredTenure() > maxTenure) {
            throw new IllegalArgumentException("Tenure must be between " + minTenure + " and " + maxTenure + " months");
        }
        String type = loanDetailsRequest.getLoanType() == null ? "" : loanDetailsRequest.getLoanType().toUpperCase();
        BigDecimal increment = (type.contains("HOME") || type.contains("PROPERTY")) ? BigDecimal.valueOf(10000) : BigDecimal.valueOf(1000);
        if (amount.remainder(increment).compareTo(BigDecimal.ZERO) != 0) {
            throw new IllegalArgumentException("Requested amount must be a multiple of " + increment);
        }
        var extra = loanDetailsRequest.getAdditionalDetails();
        if (extra != null) {
            for (String feeKey : List.of("processingFees", "gstOnFees", "insuranceCharges")) {
                String raw = extra.get(feeKey);
                if (raw != null && !raw.isBlank()) {
                    try { if (new BigDecimal(raw).compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException(feeKey + " must be zero or greater."); }
                    catch (NumberFormatException ex) { throw new IllegalArgumentException(feeKey + " must be a valid amount."); }
                }
            }
            BigDecimal totalCharges = BigDecimal.ZERO;
            for (String feeKey : List.of("processingFees", "gstOnFees", "insuranceCharges")) {
                String raw = extra.get(feeKey);
                if (raw != null && !raw.isBlank()) totalCharges = totalCharges.add(new BigDecimal(raw));
            }
            if (loanDetailsRequest.getRequestedLoanAmount() != null && totalCharges.compareTo(loanDetailsRequest.getRequestedLoanAmount()) > 0) {
                throw new IllegalArgumentException("Total fees and charges cannot exceed the requested loan amount.");
            }
            String scheduledDate = extra.get("scheduledDisbursalDate");
            if (scheduledDate != null && !scheduledDate.isBlank()) {
                try { if (java.time.LocalDate.parse(scheduledDate).isBefore(java.time.LocalDate.now())) throw new IllegalArgumentException("Scheduled disbursal date cannot be in the past."); }
                catch (java.time.format.DateTimeParseException ex) { throw new IllegalArgumentException("Scheduled disbursal date must be a valid date."); }
            }
        }

        LoanEmiCalculator.calculateEmi(
                loanDetailsRequest.getRequestedLoanAmount(),
                configuredInterestRate,
                loanDetailsRequest.getPreferredTenure()
        );
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getProductPricing(String loanType) {
        String key = loanType == null ? "" : loanType.toUpperCase().replace("-", "_").trim();
        if ("CAR_LOAN".equals(key)) key = "VEHICLE_LOAN";
        if ("LAP_LOAN".equals(key)) key = "LOAN_AGAINST_PROPERTY";
        var products = jdbc.query("SELECT annual_rate, minimum_amount, maximum_amount, processing_fee_percent, gst_percent, insurance_premium, rate_type, minimum_tenure_months, maximum_tenure_months FROM product_configuration WHERE product_code=? AND enabled=true",
                (rs, row) -> {
                    var policy = new java.util.HashMap<String, Object>();
                    policy.put("interestRate", rs.getBigDecimal(1));
                    policy.put("minAmount", rs.getBigDecimal(2));
                    policy.put("maxAmount", rs.getBigDecimal(3));
                    policy.put("processingFeePercent", rs.getBigDecimal(4));
                    policy.put("gstPercent", rs.getBigDecimal(5));
                    policy.put("insurancePremium", rs.getBigDecimal(6));
                    policy.put("rateType", rs.getString(7));
                    policy.put("minTenure", rs.getInt(8));
                    policy.put("maxTenure", rs.getInt(9));
                    return policy;
                }, key);
        if (products.isEmpty()) throw new IllegalStateException("Active product configuration not found: " + key);
        return products.get(0);
    }
    private BigDecimal configuredRateFor(String loanType) {
        if (loanType == null) throw new IllegalArgumentException("Loan type is required");
        String key = loanType.toUpperCase().replace("-", "_").trim();
        if ("CAR_LOAN".equals(key)) key = "VEHICLE_LOAN";
        if ("LAP_LOAN".equals(key)) key = "LOAN_AGAINST_PROPERTY";
        var rates = jdbc.query("SELECT annual_rate FROM product_configuration WHERE product_code=? AND enabled=true",
                (rs, row) -> rs.getBigDecimal(1), key);
        if (rates.isEmpty()) throw new IllegalStateException("Active product configuration not found: " + key);
        return rates.get(0);
    }
    private void updateApplicant(Applicant applicant, CreateApplicationRequest request) {
        String pan = request.getApplicant().getPanNumber();
        String normalizedPan = pan == null || pan.isBlank() ? null : pan.toUpperCase();
        applicant.setFullName(emptyToNull(request.getApplicant().getFullName()));
        applicant.setDateOfBirth(request.getApplicant().getDateOfBirth());
        applicant.setPanNumber(normalizedPan);
        applicant.setMobileNumber(request.getApplicant().getMobileNumber());
        applicant.setEmail(emptyToNull(request.getApplicant().getEmail()));
        applicant.setWorkEmail(emptyToNull(request.getApplicant().getWorkEmail()));
        applicant.setResidentialAddress(emptyToNull(request.getApplicant().getResidentialAddress()));
        applicant.setCity(emptyToNull(request.getApplicant().getCity()));
        applicant.setState(emptyToNull(request.getApplicant().getState()));
        applicant.setPincode(emptyToNull(request.getApplicant().getPincode()));
        applicant.setAdditionalDetails(request.getApplicant().getAdditionalDetails());
    }
    private String emptyToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

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
        String type = request.getEmployment().getEmploymentType();
        employment.setEmploymentType(type == null || type.isBlank() ? null : EmploymentDetails.EmploymentType.valueOf(type.toUpperCase()));
        employment.setEmployerName(request.getEmployment().getEmployerName());
        employment.setDesignation(request.getEmployment().getDesignation());
        employment.setTotalWorkExperienceYears(request.getEmployment().getTotalWorkExperienceYears());
        employment.setCurrentEmployerExperienceYears(request.getEmployment().getCurrentEmployerExperienceYears());
        employment.setMonthlyInHandSalary(request.getEmployment().getMonthlyInHandSalary());
        employment.setMonthlyGrossSalary(request.getEmployment().getMonthlyGrossSalary());
        employment.setAdditionalDetails(request.getEmployment().getAdditionalDetails());
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
        String type = request.getLoanDetails().getLoanType();
        LoanDetails.LoanType loanType = type == null || type.isBlank() ? null : LoanDetails.LoanType.valueOf(type.toUpperCase().replace("-", "_"));
        loanDetails.setLoanType(loanType);
        loanDetails.setRequestedLoanAmount(request.getLoanDetails().getRequestedLoanAmount());
        loanDetails.setInterestRate(loanType == null ? null : configuredRateFor(loanType.name()));
        loanDetails.setPreferredTenure(request.getLoanDetails().getPreferredTenure());
        loanDetails.setPurposeOfLoan(request.getLoanDetails().getPurposeOfLoan());
        loanDetails.setAdditionalDetails(request.getLoanDetails().getAdditionalDetails());
    }

    @Transactional
    public LoanApplication runCreditCheck(Long applicationId) {
        LoanApplication application = getById(applicationId);
        if (application.getApplicant().getAdditionalDetails() == null || !"true".equalsIgnoreCase(application.getApplicant().getAdditionalDetails().get("kycBureauConsent"))) {
            throw new IllegalArgumentException("Applicant consent for KYC and credit bureau enquiry is required before verification.");
        }
        String pan = application.getApplicant().getPanNumber();
        if (pan == null || !pan.matches("[A-Z]{5}[0-9]{4}[A-Z]")) throw new IllegalArgumentException("Enter a valid PAN before starting the credit bureau enquiry.");
        MockCreditBureauService.CreditScoreResponse response = mockCreditBureauService.evaluate(pan);

        CreditCheck creditCheck = new CreditCheck();
        creditCheck.setScoreSource("BUREAU_API");
        creditCheck.setCreditScore(response.getCreditScore());
        creditCheck.setBureau(response.getBureau());
        creditCheck.setStatus(response.getStatus());
        creditCheck.setRemarks("Credit score retrieved from configured bureau provider");
        application.setCreditCheck(creditCheck);
        application.setStatus(LoanApplication.ApplicationStatus.CREDIT_CHECK_COMPLETED);
        return repository.save(application);
    }

    @Transactional
    public LoanApplication submitApplication(Long applicationId) {
        LoanApplication application = getById(applicationId);
        validateCompleteApplication(application);
        var extraApplicant = application.getApplicant().getAdditionalDetails();
        if (extraApplicant != null && extraApplicant.get("guarantorName") != null && !extraApplicant.get("guarantorName").isBlank()
                && !"true".equalsIgnoreCase(extraApplicant.get("guarantorConsent"))) {
            throw new IllegalArgumentException("Separate KYC and bureau consent is required for the guarantor.");
        }
        if (!hasAllRequiredDocuments(application)) {
            throw new IllegalArgumentException("Please upload all required documents before submitting the application.");
        }
        var duplicateSubmitted = repository.findByApplicant_IdAndLoanDetails_LoanTypeAndStatusIn(
                application.getApplicant().getId(), application.getLoanDetails().getLoanType(),
                List.of(LoanApplication.ApplicationStatus.SUBMITTED, LoanApplication.ApplicationStatus.UNDER_REVIEW, LoanApplication.ApplicationStatus.APPROVED));
        if (duplicateSubmitted.stream().anyMatch(existing -> !existing.getId().equals(applicationId))) {
            throw new IllegalArgumentException("A submitted or under-review application already exists for this loan product. Please contact support instead of submitting a duplicate.");
        }
        String creditMode = extraApplicant == null ? null : extraApplicant.get("creditScoreMode");
        if ("MANUAL".equalsIgnoreCase(creditMode)) {
            String enteredScore = extraApplicant.get("selfReportedCreditScore");
            if (enteredScore == null || !enteredScore.matches("[0-9]{3}")) {
                throw new IllegalArgumentException("Enter a valid self-reported credit score between 300 and 900.");
            }
            int score = Integer.parseInt(enteredScore);
            if (score < 300 || score > 900) {
                throw new IllegalArgumentException("Enter a valid self-reported credit score between 300 and 900.");
            }
            CreditCheck manualCheck = application.getCreditCheck();
            if (manualCheck == null) manualCheck = new CreditCheck();
            manualCheck.setCreditScore(score);
            manualCheck.setScoreSource("MANUAL");
            manualCheck.setBureau("SELF_REPORTED");
            manualCheck.setStatus("UNVERIFIED");
            manualCheck.setRemarks("Applicant-entered score; not independently bureau verified");
            application.setCreditCheck(manualCheck);
        } else if ("ONLINE".equalsIgnoreCase(creditMode)) {
        if (application.getCreditCheck() == null) {
                throw new IllegalArgumentException("Complete the online bureau credit check before submission.");
            }
        } else {
            if (application.getCreditCheck() == null) {
                throw new IllegalArgumentException("Select Manual or Online credit score mode and complete that step before submission.");
            }
        }
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
                existing.setVerificationRemarks(null);
                existing.setVerifiedAt(null);
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

    @Transactional
    public Document reviewDocument(Long applicationId, Long documentId, String reviewStatus, String remarks) {
        LoanApplication application = getById(applicationId);
        Document document = application.getDocuments().stream().filter(item -> item.getId().equals(documentId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));
        Document.DocumentStatus parsed;
        try { parsed = Document.DocumentStatus.valueOf(reviewStatus == null ? "" : reviewStatus.toUpperCase()); }
        catch (IllegalArgumentException ex) { throw new IllegalArgumentException("Review status must be VERIFIED, REJECTED, or DEFICIENCY_RAISED."); }
        if (!(parsed == Document.DocumentStatus.VERIFIED || parsed == Document.DocumentStatus.REJECTED || parsed == Document.DocumentStatus.DEFICIENCY_RAISED)) {
            throw new IllegalArgumentException("Review status must be VERIFIED, REJECTED, or DEFICIENCY_RAISED.");
        }
        if (parsed != Document.DocumentStatus.VERIFIED && (remarks == null || remarks.isBlank())) {
            throw new IllegalArgumentException("Provide a reason for rejection or deficiency.");
        }
        document.setStatus(parsed);
        document.setVerificationRemarks(remarks == null ? "" : remarks.trim());
        document.setVerifiedAt(LocalDateTime.now());
        application.setUpdatedAt(LocalDateTime.now());
        repository.save(application);
        return document;
    }
    public boolean hasAllRequiredDocuments(LoanApplication application) {
        if (application == null || application.getDocuments() == null) {
            return false;
        }

        Set<Document.DocumentType> uploadedTypes = application.getDocuments().stream()
                .filter(document -> document.getStatus() == Document.DocumentStatus.UPLOADED
                        || document.getStatus() == Document.DocumentStatus.UNDER_REVIEW
                        || document.getStatus() == Document.DocumentStatus.VERIFIED)
                .map(Document::getDocumentType)
                .collect(Collectors.toSet());

        var employmentType = application.getEmploymentDetails() == null ? null : application.getEmploymentDetails().getEmploymentType();
        Set<Document.DocumentType> required = new java.util.HashSet<>(Set.of(
                Document.DocumentType.PAN_DOCUMENT, Document.DocumentType.AADHAAR_DOCUMENT,
                Document.DocumentType.BANK_STATEMENT, Document.DocumentType.PHOTOGRAPH,
                Document.DocumentType.SIGNATURE, Document.DocumentType.CANCELLED_CHEQUE,
                Document.DocumentType.ADDRESS_PROOF));
        if (employmentType == EmploymentDetails.EmploymentType.SALARIED) {
            required.addAll(Set.of(Document.DocumentType.SALARY_SLIPS, Document.DocumentType.EMPLOYMENT_PROOF,
                    Document.DocumentType.FORM_16));
        } else if (employmentType == EmploymentDetails.EmploymentType.SELF_EMPLOYED) {
            required.addAll(Set.of(Document.DocumentType.BUSINESS_PROOF,
                    Document.DocumentType.QUALIFICATION_PROOF));
        } else if (employmentType == EmploymentDetails.EmploymentType.BUSINESS_OWNER) {
            required.addAll(Set.of(Document.DocumentType.BUSINESS_PROOF,
                    Document.DocumentType.GST_DOCUMENT, Document.DocumentType.BUSINESS_FINANCIALS));
        }
        var extraApplicant = application.getApplicant() == null ? null : application.getApplicant().getAdditionalDetails();
        if (extraApplicant != null && "true".equalsIgnoreCase(extraApplicant.get("coApplicantRequired"))
                && extraApplicant.get("coApplicantName") != null && !extraApplicant.get("coApplicantName").isBlank()) {
            required.addAll(Set.of(Document.DocumentType.COAPPLICANT_PAN, Document.DocumentType.COAPPLICANT_KYC, Document.DocumentType.COAPPLICANT_PHOTOGRAPH, Document.DocumentType.COAPPLICANT_SIGNATURE));
            if ("Earning".equalsIgnoreCase(extraApplicant.get("coApplicantType"))) required.add(Document.DocumentType.COAPPLICANT_BANK_STATEMENT);
        }
        if (extraApplicant != null && extraApplicant.get("guarantorName") != null && !extraApplicant.get("guarantorName").isBlank()) {
            required.addAll(Set.of(Document.DocumentType.GUARANTOR_PAN, Document.DocumentType.GUARANTOR_KYC, Document.DocumentType.GUARANTOR_BANK_STATEMENT, Document.DocumentType.GUARANTOR_PHOTOGRAPH, Document.DocumentType.GUARANTOR_SIGNATURE));
        }
        if (application.getLoanDetails() != null) {
            switch (application.getLoanDetails().getLoanType()) {
                case HOME_LOAN, LOAN_AGAINST_PROPERTY -> required.add(Document.DocumentType.PROPERTY_DOCUMENTS);
                case CAR_LOAN -> required.add(Document.DocumentType.VEHICLE_DOCUMENTS);
                case EDUCATION_LOAN -> required.add(Document.DocumentType.EDUCATION_DOCUMENTS);
                default -> { }
            }
        }
        return uploadedTypes.containsAll(required);
    }
}
