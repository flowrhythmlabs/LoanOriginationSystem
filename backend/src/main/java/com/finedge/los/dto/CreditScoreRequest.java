package com.finedge.los.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;

public class CreditScoreRequest {
    @NotNull(message = "Credit score is required")
    @Pattern(regexp = "[0-9]+", message = "Credit score must be a whole number between 300 and 900")
    private String creditScore;

    public String getCreditScore() { return creditScore; }
    public void setCreditScore(String creditScore) { this.creditScore = creditScore; }
}