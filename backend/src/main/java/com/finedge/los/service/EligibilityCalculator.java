package com.finedge.los.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/** Indicative calculations only. Never a sanction, approval, or substitute for verified inputs. */
public final class EligibilityCalculator {
    private EligibilityCalculator() {}
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public static Map<String, Object> assess(BigDecimal requested, BigDecimal netMonthlyIncome,
            BigDecimal grossMonthlyIncome, BigDecimal existingMonthlyEmis, BigDecimal annualRate,
            int tenureMonths, BigDecimal foirPercent, BigDecimal productCap,
            BigDecimal applicantTypeCap, BigDecimal bureauBandFraction,
            BigDecimal collateralValue, BigDecimal ltvPercent, BigDecimal productMinimum) {
        if (requested == null || netMonthlyIncome == null || grossMonthlyIncome == null || existingMonthlyEmis == null ||
                annualRate == null || foirPercent == null || productCap == null || applicantTypeCap == null ||
                bureauBandFraction == null || productMinimum == null || tenureMonths <= 0 ||
                requested.signum() <= 0 || netMonthlyIncome.signum() <= 0 || grossMonthlyIncome.signum() <= 0 ||
                existingMonthlyEmis.signum() < 0 || annualRate.signum() < 0 ||
                foirPercent.signum() < 0 || foirPercent.compareTo(HUNDRED) > 0 ||
                bureauBandFraction.signum() < 0 || bureauBandFraction.compareTo(BigDecimal.ONE) > 0 ||
                productCap.signum() <= 0 || applicantTypeCap.signum() <= 0 || productMinimum.signum() <= 0)
            throw new IllegalArgumentException("Invalid eligibility inputs");
        if ((collateralValue == null) != (ltvPercent == null))
            throw new IllegalArgumentException("Collateral value and LTV percentage must be supplied together");
        if (collateralValue != null && (collateralValue.signum() <= 0 || ltvPercent.signum() < 0 || ltvPercent.compareTo(HUNDRED) > 0))
            throw new IllegalArgumentException("Invalid collateral or LTV");

        BigDecimal allowedMonthlyEmi = netMonthlyIncome.multiply(foirPercent).divide(HUNDRED, 8, RoundingMode.HALF_UP)
                .subtract(existingMonthlyEmis).max(BigDecimal.ZERO);
        BigDecimal monthlyRate = annualRate.divide(new BigDecimal("1200"), 16, RoundingMode.HALF_UP);
        BigDecimal foirCap;
        if (monthlyRate.signum() == 0) foirCap = allowedMonthlyEmi.multiply(BigDecimal.valueOf(tenureMonths));
        else {
            double r = monthlyRate.doubleValue();
            double factor = Math.pow(1 + r, tenureMonths);
            foirCap = BigDecimal.valueOf(allowedMonthlyEmi.doubleValue() * (factor - 1) / (r * factor));
        }
        BigDecimal bureauCap = applicantTypeCap.multiply(bureauBandFraction);
        BigDecimal eligible = requested.min(foirCap).min(productCap).min(applicantTypeCap).min(bureauCap);
        BigDecimal ltvCap = null;
        if (collateralValue != null) {
            ltvCap = collateralValue.multiply(ltvPercent).divide(HUNDRED, 8, RoundingMode.HALF_UP);
            eligible = eligible.min(ltvCap);
        }
        eligible = eligible.max(BigDecimal.ZERO).setScale(0, RoundingMode.DOWN);
        BigDecimal requestedEmi = LoanEmiCalculator.calculateEmi(requested, annualRate, tenureMonths);
        BigDecimal foirAfter = existingMonthlyEmis.add(requestedEmi).multiply(HUNDRED)
                .divide(netMonthlyIncome, 2, RoundingMode.HALF_UP);
        BigDecimal dtiAfter = existingMonthlyEmis.add(requestedEmi).multiply(HUNDRED)
                .divide(grossMonthlyIncome, 2, RoundingMode.HALF_UP);
        String outcome = eligible.compareTo(productMinimum) < 0 ? "NOT_ELIGIBLE" :
                eligible.compareTo(requested) < 0 ? "LOWER_AMOUNT" : "INDICATIVELY_ELIGIBLE";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("outcome", outcome); result.put("indicativeOnly", true);
        result.put("eligibleAmount", eligible); result.put("maxNewEmi", allowedMonthlyEmi.setScale(2, RoundingMode.HALF_UP));
        result.put("foirAmountCap", foirCap.setScale(0, RoundingMode.DOWN));
        result.put("applicantTypeCap", applicantTypeCap); result.put("bureauBandCap", bureauCap.setScale(0, RoundingMode.DOWN));
        result.put("productCap", productCap); result.put("ltvAmountCap", ltvCap == null ? null : ltvCap.setScale(0, RoundingMode.DOWN));
        result.put("requestedEmi", requestedEmi); result.put("foirAfterPercent", foirAfter);
        result.put("dtiAfterPercent", dtiAfter);
        result.put("reason", "Indicative assessment only; verify income, identity, credit conduct, consent, fraud checks and policy before any decision");
        return result;
    }
}
