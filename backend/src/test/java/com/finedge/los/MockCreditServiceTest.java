package com.finedge.los;

import com.finedge.los.service.MockCreditBureauService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class MockCreditServiceTest {
    @Autowired
    private MockCreditBureauService service;

    @Test
    void shouldReturnScoreWithinRange() {
        var response = service.evaluate("ABCDE1234F");
        assertTrue(response.getCreditScore() >= 300 && response.getCreditScore() <= 900);
    }
}
