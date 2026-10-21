package com.finedge.los.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/** Illustrative pre-offer quotation. Final APR/KFS requires an approved disclosure engine. */
public final class LoanQuoteCalculator {
    private LoanQuoteCalculator() {}
    public static Map<String, Object> quote(BigDecimal amount, BigDecimal annualRate, int months,
                                             BigDecimal feePercent, BigDecimal gstPercent, BigDecimal insurance) {
        if (amount == null || amount.signum() <= 0 || months <= 0 || annualRate == null || annualRate.signum() < 0
            || feePercent == null || feePercent.signum() < 0 || gstPercent == null || gstPercent.signum() < 0
            || insurance == null || insurance.signum() < 0) throw new IllegalArgumentException("Invalid loan quote inputs");
        BigDecimal fee = amount.multiply(feePercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal gst = fee.multiply(gstPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal charges = fee.add(gst).add(insurance);
        if (charges.compareTo(amount) >= 0) throw new IllegalArgumentException("Charges must be below the principal");
        BigDecimal emi = LoanEmiCalculator.calculateEmi(amount, annualRate, months);
        BigDecimal totalRepayable = emi.multiply(BigDecimal.valueOf(months));
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("principal", amount); result.put("annualRate", annualRate); result.put("tenureMonths", months);
        result.put("emi", emi); result.put("totalInterest", totalRepayable.subtract(amount));
        result.put("totalRepayable", totalRepayable); result.put("processingFee", fee);
        result.put("gstOnProcessingFee", gst); result.put("insurancePremium", insurance);
        result.put("totalCharges", charges); result.put("netDisbursal", amount.subtract(charges));
        result.put("indicativeOnly", true);
        return result;
    }
}
