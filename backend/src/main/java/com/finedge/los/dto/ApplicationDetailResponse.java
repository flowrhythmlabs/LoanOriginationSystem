package com.finedge.los.dto;

import com.finedge.los.entity.LoanApplication;

import java.time.LocalDateTime;

public class ApplicationDetailResponse {
    private Long id;
    private String losNumber;
    private ApplicantRequest applicant;
    private EmploymentRequest employmentDetails;
    private LoanDetailsRequest loanDetails;
    private CreditCheckData creditCheck;
    private String status;
    private LocalDateTime createdAt;

    public static ApplicationDetailResponse fromEntity(LoanApplication application) {
        ApplicationDetailResponse response = new ApplicationDetailResponse();
        response.id = application.getId();
        response.losNumber = application.getLosNumber();
        response.status = application.getStatus().name();
        response.createdAt = application.getCreatedAt();

        var applicant = application.getApplicant();
        ApplicantRequest applicantData = new ApplicantRequest();
        applicantData.setFullName(applicant.getFullName());
        applicantData.setDateOfBirth(applicant.getDateOfBirth());
        applicantData.setPanNumber(applicant.getPanNumber());
        applicantData.setMobileNumber(applicant.getMobileNumber());
        applicantData.setEmail(applicant.getEmail());
        applicantData.setWorkEmail(applicant.getWorkEmail());
        applicantData.setResidentialAddress(applicant.getResidentialAddress());
        applicantData.setCity(applicant.getCity());
        applicantData.setState(applicant.getState());
        applicantData.setPincode(applicant.getPincode());
        applicantData.setAdditionalDetails(applicant.getAdditionalDetails());
        response.applicant = applicantData;

        var employment = application.getEmploymentDetails();
        EmploymentRequest employmentData = new EmploymentRequest();
        employmentData.setEmploymentType(employment.getEmploymentType().name());
        employmentData.setEmployerName(employment.getEmployerName());
        employmentData.setDesignation(employment.getDesignation());
        employmentData.setTotalWorkExperienceYears(employment.getTotalWorkExperienceYears());
        employmentData.setCurrentEmployerExperienceYears(employment.getCurrentEmployerExperienceYears());
        employmentData.setMonthlyInHandSalary(employment.getMonthlyInHandSalary());
        employmentData.setMonthlyGrossSalary(employment.getMonthlyGrossSalary());
        employmentData.setAdditionalDetails(employment.getAdditionalDetails());
        response.employmentDetails = employmentData;

        var loan = application.getLoanDetails();
        LoanDetailsRequest loanData = new LoanDetailsRequest();
        loanData.setLoanType(loan.getLoanType().name());
        loanData.setRequestedLoanAmount(loan.getRequestedLoanAmount());
        loanData.setInterestRate(loan.getInterestRate());
        loanData.setPreferredTenure(loan.getPreferredTenure());
        loanData.setPurposeOfLoan(loan.getPurposeOfLoan());
        loanData.setAdditionalDetails(loan.getAdditionalDetails());
        response.loanDetails = loanData;

        if (application.getCreditCheck() != null) {
            response.creditCheck = new CreditCheckData(application.getCreditCheck().getCreditScore());
        }
        return response;
    }

    public Long getId() { return id; }
    public String getLosNumber() { return losNumber; }
    public ApplicantRequest getApplicant() { return applicant; }
    public EmploymentRequest getEmploymentDetails() { return employmentDetails; }
    public LoanDetailsRequest getLoanDetails() { return loanDetails; }
    public CreditCheckData getCreditCheck() { return creditCheck; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public static class CreditCheckData {
        private final Integer creditScore;

        public CreditCheckData(Integer creditScore) {
            this.creditScore = creditScore;
        }

        public Integer getCreditScore() { return creditScore; }
    }
}
