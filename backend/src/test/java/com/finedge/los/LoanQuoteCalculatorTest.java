package com.finedge.los;
import com.finedge.los.service.LoanQuoteCalculator;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
class LoanQuoteCalculatorTest {
 @Test void feeBreakdown() {
   var q = LoanQuoteCalculator.quote(new BigDecimal("500000"),new BigDecimal("10.5"),36,
       new BigDecimal("2"),new BigDecimal("18"),BigDecimal.ZERO);
   assertEquals(new BigDecimal("10000.00"),q.get("processingFee"));
   assertEquals(new BigDecimal("1800.00"),q.get("gstOnProcessingFee"));
   assertEquals(new BigDecimal("488200.00"),q.get("netDisbursal"));
 }
}
