package com.finedge.los.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class LoanEmiCalculator {
    private LoanEmiCalculator() {
    }

    public static BigDecimal calculateEmi(BigDecimal principal, BigDecimal annualInterestRate, Integer tenureMonths) {
        if (principal == null || principal.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Loan amount must be greater than zero");
        }
        if (annualInterestRate == null) {
            throw new IllegalArgumentException("Interest rate is required");
        }
        if (tenureMonths == null || tenureMonths <= 0) {
            throw new IllegalArgumentException("Preferred tenure must be greater than zero");
        }
        if (annualInterestRate.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Interest rate must be greater than or equal to 0%");
        }

        if (annualInterestRate.compareTo(BigDecimal.ZERO) == 0) {
            return principal.divide(BigDecimal.valueOf(tenureMonths), 2, RoundingMode.HALF_UP);
        }

        double monthlyRate = annualInterestRate.doubleValue() / 12d / 100d;
        double multiplier = Math.pow(1d + monthlyRate, tenureMonths);
        double monthlyEmi = principal.doubleValue() * monthlyRate * multiplier / (multiplier - 1d);
        return BigDecimal.valueOf(Math.round(monthlyEmi)).setScale(0, RoundingMode.HALF_UP);
    }

    public static BigDecimal calculateTotalPayable(BigDecimal principal, BigDecimal annualInterestRate, Integer tenureMonths) {
        BigDecimal monthlyEmi = calculateEmi(principal, annualInterestRate, tenureMonths);
        return monthlyEmi.multiply(BigDecimal.valueOf(tenureMonths)).setScale(0, RoundingMode.HALF_UP);
    }

    public static BigDecimal calculateTotalInterest(BigDecimal principal, BigDecimal annualInterestRate, Integer tenureMonths) {
        BigDecimal totalPayable = calculateTotalPayable(principal, annualInterestRate, tenureMonths);
        return totalPayable.subtract(principal).setScale(0, RoundingMode.HALF_UP);
    }
}
