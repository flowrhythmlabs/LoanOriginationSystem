package com.finedge.los;

import com.finedge.los.service.EligibilityCalculator;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class EligibilityCalculatorTest {
    private BigDecimal n(String s) { return new BigDecimal(s); }
    @Test void examplePassesFoirAndReturnsRequestedAmount() {
        Map<String,Object> r = EligibilityCalculator.assess(n("500000"),n("80000"),n("100000"),n("10000"),n("10.5"),36,n("50"),n("2500000"),n("1600000"),n("1"),null,null,n("50000"));
        assertEquals("INDICATIVELY_ELIGIBLE",r.get("outcome"));
        assertEquals(n("500000"),r.get("eligibleAmount"));
        assertEquals(n("30000.00"),r.get("maxNewEmi"));
    }
    @Test void insufficientHeadroomCannotProduceNegativeLoan() {
        Map<String,Object> r = EligibilityCalculator.assess(n("500000"),n("25000"),n("30000"),n("20000"),n("10.5"),36,n("50"),n("2500000"),n("1000000"),n("1"),null,null,n("50000"));
        assertEquals("NOT_ELIGIBLE",r.get("outcome"));
        assertEquals(n("0"),r.get("eligibleAmount"));
    }
    @Test void securedCapConstrainsEligibleAmount() {
        Map<String,Object> r = EligibilityCalculator.assess(n("500000"),n("80000"),n("100000"),n("0"),n("10.5"),36,n("70"),n("2500000"),n("1600000"),n("1"),n("400000"),n("75"),n("50000"));
        assertEquals(n("300000"),r.get("eligibleAmount"));
        assertEquals("LOWER_AMOUNT",r.get("outcome"));
    }
}
