package com.finedge.los.dto;

import com.finedge.los.entity.LoanApplication;

import java.time.LocalDateTime;

public class ApplicationResponse {
    private Long id;
    private String losNumber;
    private String applicantName;
    private String applicantMobile;
    private String loanType;
    private String status;
    private LocalDateTime createdAt;
    private Integer creditScore;
    private Double requestedAmount;

    public static ApplicationResponse fromEntity(LoanApplication application) {
        ApplicationResponse response = new ApplicationResponse();
        response.setId(application.getId());
        response.setLosNumber(application.getLosNumber());
        response.setApplicantName(application.getApplicant() != null ? application.getApplicant().getFullName() : null);
        response.setApplicantMobile(application.getApplicant() != null ? application.getApplicant().getMobileNumber() : null);
        response.setLoanType(application.getLoanDetails() != null && application.getLoanDetails().getLoanType() != null ? application.getLoanDetails().getLoanType().name() : null);
        response.setStatus(application.getStatus() != null ? application.getStatus().name() : null);
        response.setCreatedAt(application.getCreatedAt());
        response.setCreditScore(application.getCreditCheck() != null ? application.getCreditCheck().getCreditScore() : null);
        response.setRequestedAmount(application.getLoanDetails() != null && application.getLoanDetails().getRequestedLoanAmount() != null ? application.getLoanDetails().getRequestedLoanAmount().doubleValue() : null);
        return response;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getLosNumber() { return losNumber; }
    public void setLosNumber(String losNumber) { this.losNumber = losNumber; }
    public String getApplicantName() { return applicantName; }
    public void setApplicantName(String applicantName) { this.applicantName = applicantName; }
    public String getApplicantMobile() { return applicantMobile; }
    public void setApplicantMobile(String applicantMobile) { this.applicantMobile = applicantMobile; }
    public String getLoanType() { return loanType; }
    public void setLoanType(String loanType) { this.loanType = loanType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public Integer getCreditScore() { return creditScore; }
    public void setCreditScore(Integer creditScore) { this.creditScore = creditScore; }
    public Double getRequestedAmount() { return requestedAmount; }
    public void setRequestedAmount(Double requestedAmount) { this.requestedAmount = requestedAmount; }
}
