package com.finedge.los.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class AuthSessionService {
    public record Principal(String username, String role, String mobile, Instant expiresAt) {}
    public record OtpRequest(String code, boolean allowed, long retryAfterSeconds) {}
    public enum OtpVerificationResult { VERIFIED, INVALID, EXPIRED }
    private record OtpEntry(String code, Instant expiresAt, Instant resendAfter, int attempts, boolean verifiable) {}
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Principal> sessions = new ConcurrentHashMap<>();
    private final Map<String, OtpEntry> otps = new ConcurrentHashMap<>();

    @Value("${app.auth.session-minutes:60}") private long sessionMinutes;
    @Value("${app.auth.otp-minutes:5}") private long otpMinutes;
    @Value("${app.auth.otp-resend-cooldown-seconds:30}") private long otpResendCooldownSeconds;
    @Value("${app.auth.demo-otp-enabled:false}") private boolean demoOtpEnabled;
    @Value("${LOS_ADMIN_USERNAME:}") private String adminUsername;
    @Value("${LOS_ADMIN_PASSWORD:}") private String adminPassword;

    public OtpRequest requestOtp(String mobile) {
        if (mobile == null || !mobile.matches("^[0-9]{10}$")) throw new IllegalArgumentException("Please enter a valid 10-digit mobile number.");
        Instant now = Instant.now();
        AtomicReference<OtpRequest> result = new AtomicReference<>();
        otps.compute(mobile, (key, existing) -> {
            if (existing != null && existing.expiresAt().isAfter(now)) {
                long remaining = secondsUntil(existing.resendAfter(), now);
                if (remaining > 0) {
                    result.set(new OtpRequest(existing.code(), false, remaining));
                    return existing;
                }
            }
            String code = String.format("%06d", random.nextInt(1_000_000));
            Instant expiresAt = now.plusSeconds(otpMinutes * 60);
            OtpEntry entry = new OtpEntry(code, expiresAt, now.plusSeconds(otpResendCooldownSeconds), 0, true);
            result.set(new OtpRequest(code, true, otpResendCooldownSeconds));
            return entry;
        });
        return result.get();
    }

    public long deferOtpResendUntilExpiry(String mobile) {
        Instant now = Instant.now();
        AtomicLong retryAfter = new AtomicLong();
        otps.computeIfPresent(mobile, (key, entry) -> {
            if (!entry.expiresAt().isAfter(now)) return entry;
            retryAfter.set(secondsUntil(entry.expiresAt(), now));
            return new OtpEntry(entry.code(), entry.expiresAt(), entry.expiresAt(), entry.attempts(), entry.verifiable());
        });
        return retryAfter.get();
    }

    public long rejectOtpAndRetainCooldown(String mobile) {
        Instant now = Instant.now();
        AtomicLong retryAfter = new AtomicLong();
        otps.computeIfPresent(mobile, (key, entry) -> {
            if (!entry.expiresAt().isAfter(now)) return null;
            Instant resendAfter = now.plusSeconds(otpResendCooldownSeconds);
            retryAfter.set(secondsUntil(resendAfter, now));
            return new OtpEntry(entry.code(), entry.expiresAt(), resendAfter, entry.attempts(), false);
        });
        return retryAfter.get();
    }

    private long secondsUntil(Instant deadline, Instant now) {
        long millis = Duration.between(now, deadline).toMillis();
        return millis <= 0 ? 0 : (millis + 999) / 1000;
    }

    public void invalidateOtp(String mobile) { otps.remove(mobile); }
    public boolean isDemoOtpEnabled() { return demoOtpEnabled; }
    public long getSessionMinutes() { return sessionMinutes; }

    public boolean verifyOtp(String mobile, String code) {
        return verifyOtpResult(mobile, code) == OtpVerificationResult.VERIFIED;
    }

    public OtpVerificationResult verifyOtpResult(String mobile, String code) {
        AtomicReference<OtpVerificationResult> result = new AtomicReference<>(OtpVerificationResult.INVALID);
        Instant now = Instant.now();
        otps.computeIfPresent(mobile, (key, entry) -> {
            if (!entry.expiresAt().isAfter(now)) {
                result.set(OtpVerificationResult.EXPIRED);
                return null;
            }
            if (!entry.verifiable() || entry.attempts() >= 5) return null;
            if (code != null && code.equals(entry.code())) {
                result.set(OtpVerificationResult.VERIFIED);
                return null;
            }
            int attempts = entry.attempts() + 1;
            return attempts >= 5 ? null : new OtpEntry(entry.code(), entry.expiresAt(), entry.resendAfter(), attempts, true);
        });
        return result.get();
    }

    public boolean verifyAdmin(String username, String password) {
        return adminUsername != null && !adminUsername.isBlank() && adminPassword != null && !adminPassword.isBlank()
                && adminUsername.equals(username) && adminPassword.equals(password);
    }

    public String createSession(String username, String role, String mobile) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, new Principal(username, role, mobile, Instant.now().plusSeconds(sessionMinutes * 60)));
        return token;
    }

    public Principal findSession(String token) {
        if (token == null || token.isBlank()) return null;
        Principal principal = sessions.get(token);
        if (principal == null) return null;
        if (principal.expiresAt().isBefore(Instant.now())) {
            sessions.remove(token);
            return null;
        }
        return principal;
    }

    public void revoke(String token) { if (token != null) sessions.remove(token); }
}
