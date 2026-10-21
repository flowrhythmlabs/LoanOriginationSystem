package com.finedge.los.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Pre-offer amortisation and annualised-cost estimate; NOT a regulatory KFS. */
public final class IndicativeDisclosureCalculator {
    private IndicativeDisclosureCalculator() {}
    private static BigDecimal money(double n) { return BigDecimal.valueOf(n).setScale(2, RoundingMode.HALF_UP); }

    public static Map<String,Object> calculate(BigDecimal principal, BigDecimal annualRate, int months,
            BigDecimal feePercent, BigDecimal gstPercent, BigDecimal insurance) {
        Map<String,Object> q = LoanQuoteCalculator.quote(principal, annualRate, months, feePercent, gstPercent, insurance);
        double p = principal.doubleValue(), emi = ((BigDecimal) q.get("emi")).doubleValue();
        double net = ((BigDecimal) q.get("netDisbursal")).doubleValue();
        double monthlyRate = annualRate.doubleValue() / 1200.0;
        double balance = p;
        List<Map<String,Object>> schedule = new ArrayList<>();
        for (int i = 1; i <= months; i++) {
            double interest = balance * monthlyRate;
            double principalPart = (i == months) ? balance : Math.min(balance, Math.max(0, emi - interest));
            balance = Math.max(0, balance - principalPart);
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("month", i); row.put("principal", money(principalPart));
            row.put("interest", money(interest)); row.put("closingBalance", money(balance));
            schedule.add(row);
        }
        // APR estimate uses net amount received and monthly instalments, assuming equal monthly periods.
        double lo = 0, hi = 1;
        for (int j = 0; j < 120; j++) {
            double mid = (lo + hi) / 2;
            double pv = mid == 0 ? emi * months : emi * (1 - Math.pow(1 + mid, -months)) / mid;
            if (pv > net) lo = mid; else hi = mid;
        }
        double monthlyApr = (lo + hi) / 2;
        Map<String,Object> out = new LinkedHashMap<>(q);
        out.put("estimatedEffectiveAprPercent", money((Math.pow(1 + monthlyApr, 12) - 1) * 100));
        out.put("estimatedTotalCostOfCredit", ((BigDecimal) q.get("totalInterest")).add((BigDecimal) q.get("totalCharges")));
        out.put("repaymentSchedule", schedule);
        out.put("disclosureStatus", "INDICATIVE_NOT_KFS");
        out.put("disclosureNote", "Assumes equal monthly instalments and all listed fees deducted upfront. Exact disbursal and repayment dates, third-party costs, moratorium, variable rates, rounding and regulatory APR/KFS requirements must be validated before issuing an offer.");
        return out;
    }
}
