package com.finedge.los.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class SubmitApplicationRequest {
    @NotBlank(message = "Credit score is required")
    @Pattern(regexp = "[0-9]+", message = "Credit score must be a whole number between 300 and 900")
    private String creditScore;

    @NotBlank(message = "Customer name is required")
    @Size(max = 120, message = "Customer name is too long")
    private String customerName;

    @NotBlank(message = "Verification type is required")
    private String verificationType;

    @NotBlank(message = "PAN number is required.")
    private String panNumber;

    public String getCreditScore() { return creditScore; }
    public void setCreditScore(String creditScore) { this.creditScore = creditScore; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getVerificationType() { return verificationType; }
    public void setVerificationType(String verificationType) { this.verificationType = verificationType; }
    public String getPanNumber() { return panNumber; }
    public void setPanNumber(String panNumber) { this.panNumber = panNumber; }
}