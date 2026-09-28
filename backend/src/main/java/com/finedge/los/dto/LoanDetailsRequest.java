package com.finedge.los.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class LoanDetailsRequest {
    @NotBlank(message = "Loan type is required")
    private String loanType;

    @NotNull(message = "Requested loan amount is required")
    @DecimalMin(value = "1000.00", message = "Loan amount must be greater than zero")
    private BigDecimal requestedLoanAmount;

    @NotNull(message = "Interest rate is required")
    @DecimalMin(value = "0.00", message = "Interest rate must be greater than or equal to 0%")
    private BigDecimal interestRate;

    @NotNull(message = "Preferred tenure is required")
    private Integer preferredTenure;

    @NotBlank(message = "Purpose of loan is required")
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
