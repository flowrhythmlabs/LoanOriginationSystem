package com.finedge.los.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class AuthSessionServiceOtpTest {
    private final AuthSessionService sessions = new AuthSessionService();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(sessions, "otpMinutes", 5L);
        ReflectionTestUtils.setField(sessions, "otpResendCooldownSeconds", 30L);
    }

    @Test
    void blocksDuplicateOtpRequestsDuringCooldownWithoutReplacingCode() {
        AuthSessionService.OtpRequest first = sessions.requestOtp("9876543210");
        AuthSessionService.OtpRequest duplicate = sessions.requestOtp("9876543210");

        assertTrue(first.allowed());
        assertFalse(duplicate.allowed());
        assertEquals(first.code(), duplicate.code());
        assertTrue(duplicate.retryAfterSeconds() > 0);
    }

    @Test
    void delaysResendUntilExpiryWhenTheProviderOutcomeIsUnknown() {
        AuthSessionService.OtpRequest first = sessions.requestOtp("9876543210");
        long retryAfter = sessions.deferOtpResendUntilExpiry("9876543210");
        AuthSessionService.OtpRequest duplicate = sessions.requestOtp("9876543210");

        assertTrue(retryAfter > 30);
        assertFalse(duplicate.allowed());
        assertEquals(first.code(), duplicate.code());
        assertTrue(duplicate.retryAfterSeconds() > 30);
    }

    @Test
    void onlyOneConcurrentRequestCanIssueAnOtp() {
        AtomicInteger issued = new AtomicInteger();

        IntStream.range(0, 32).parallel().forEach(index -> {
            if (sessions.requestOtp("9876543210").allowed()) issued.incrementAndGet();
        });

        assertEquals(1, issued.get());
    }

    @Test
    void rejectedRequestInvalidatesTheOtpButKeepsTheResendCooldown() {
        AuthSessionService.OtpRequest first = sessions.requestOtp("9876543210");
        long retryAfter = sessions.rejectOtpAndRetainCooldown("9876543210");
        AuthSessionService.OtpRequest duplicate = sessions.requestOtp("9876543210");

        assertTrue(retryAfter > 0);
        assertFalse(sessions.verifyOtp("9876543210", first.code()));
        assertFalse(duplicate.allowed());
        assertEquals(first.code(), duplicate.code());
    }

    @Test
    void rejectsInvalidOtpAndAllowsTheCorrectOtpOnce() {
        String code = sessions.requestOtp("9876543210").code();

        assertFalse(sessions.verifyOtp("9876543210", "000000".equals(code) ? "000001" : "000000"));
        assertTrue(sessions.verifyOtp("9876543210", code));
        assertFalse(sessions.verifyOtp("9876543210", code));
    }

    @Test
    void rejectsExpiredOtp() {
        ReflectionTestUtils.setField(sessions, "otpMinutes", 0L);
        String code = sessions.requestOtp("9876543210").code();

        assertEquals(AuthSessionService.OtpVerificationResult.EXPIRED,
                sessions.verifyOtpResult("9876543210", code));
    }

    @Test
    void removesOtpAfterMaximumInvalidAttempts() {
        String code = sessions.requestOtp("9876543210").code();
        String invalidCode = "000000".equals(code) ? "000001" : "000000";

        for (int attempt = 0; attempt < 5; attempt++) {
            assertFalse(sessions.verifyOtp("9876543210", invalidCode));
        }
        assertFalse(sessions.verifyOtp("9876543210", code));
    }
}
