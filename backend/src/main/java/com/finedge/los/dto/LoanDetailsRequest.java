package com.finedge.los.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public class LoanDetailsRequest {
    @NotBlank(message = "Loan type is required")
    @Size(max = 40, message = "Loan type is too long")
    private String loanType;

    @NotNull(message = "Requested loan amount is required")
    @DecimalMin(value = "1000.00", message = "Loan amount must be at least 1000")
    @jakarta.validation.constraints.DecimalMax(value = "100000000.00", message = "Loan amount is too large")
    private BigDecimal requestedLoanAmount;

    @NotNull(message = "Interest rate is required")
    @DecimalMin(value = "0.00", message = "Interest rate must be greater than or equal to 0%")
    private BigDecimal interestRate;

    @NotNull(message = "Preferred tenure is required")
    @jakarta.validation.constraints.Max(value = 480, message = "Preferred tenure must not exceed 480 months")
    private Integer preferredTenure;

    @NotBlank(message = "Purpose of loan is required")
    @Size(max = 300, message = "Purpose of loan is too long")
    private String purposeOfLoan;

    public LoanDetailsRequest() {}

    public String getLoanType() { return loanType; }
    public void setLoanType(String loanType) { this.loanType = loanType; }
    public BigDecimal getRequestedLoanAmount() { return requestedLoanAmount; }
    public void setRequestedLoanAmount(BigDecimal requestedLoanAmount) { this.requestedLoanAmount = requestedLoanAmount; }
    public BigDecimal getInterestRate() { return interestRate; }
    public void setInterestRate(BigDecimal interestRate) { this.interestRate = interestRate; }
    public Integer getPreferredTenure() { return preferredTenure; }
    public void setPreferredTenure(Integer preferredTenure) { this.preferredTenure = preferredTenure; }
    public String getPurposeOfLoan() { return purposeOfLoan; }
    public void setPurposeOfLoan(String purposeOfLoan) { this.purposeOfLoan = purposeOfLoan; }
}
