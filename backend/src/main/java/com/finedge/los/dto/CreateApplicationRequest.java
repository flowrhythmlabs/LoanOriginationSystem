package com.finedge.los.dto;

import jakarta.validation.Valid;

public class CreateApplicationRequest {
    @Valid
    private ApplicantRequest applicant;
    @Valid
    private EmploymentRequest employment;
    @Valid
    private LoanDetailsRequest loanDetails;

    public CreateApplicationRequest() {}

    public ApplicantRequest getApplicant() { return applicant; }
    public void setApplicant(ApplicantRequest applicant) { this.applicant = applicant; }
    public EmploymentRequest getEmployment() { return employment; }
    public void setEmployment(EmploymentRequest employment) { this.employment = employment; }
    public LoanDetailsRequest getLoanDetails() { return loanDetails; }
    public void setLoanDetails(LoanDetailsRequest loanDetails) { this.loanDetails = loanDetails; }
}
