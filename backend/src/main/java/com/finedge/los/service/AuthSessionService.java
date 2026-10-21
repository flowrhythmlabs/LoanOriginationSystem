package com.finedge.los.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthSessionService {
    public record Principal(String username, String role, String mobile, Instant expiresAt) {}
    private record OtpEntry(String code, Instant expiresAt, int attempts) {}
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Principal> sessions = new ConcurrentHashMap<>();
    private final Map<String, OtpEntry> otps = new ConcurrentHashMap<>();

    @Value("${app.auth.session-minutes:60}") private long sessionMinutes;
    @Value("${app.auth.otp-minutes:5}") private long otpMinutes;
    @Value("${app.auth.demo-otp-enabled:true}") private boolean demoOtpEnabled;
    @Value("${LOS_ADMIN_USERNAME:}") private String adminUsername;
    @Value("${LOS_ADMIN_PASSWORD:}") private String adminPassword;

    public String requestOtp(String mobile) {
        if (mobile == null || !mobile.matches("^[0-9]{10}$")) throw new IllegalArgumentException("Please enter a valid 10-digit mobile number.");
        String code = String.format("%06d", random.nextInt(1_000_000));
        otps.put(mobile, new OtpEntry(code, Instant.now().plusSeconds(otpMinutes * 60), 0));
        return code;
    }

    public void invalidateOtp(String mobile) { otps.remove(mobile); }
    public boolean isDemoOtpEnabled() { return demoOtpEnabled; }
    public long getSessionMinutes() { return sessionMinutes; }

    public boolean verifyOtp(String mobile, String code) {
        OtpEntry entry = otps.get(mobile);
        if (entry == null || entry.expiresAt().isBefore(Instant.now()) || entry.attempts() >= 5) {
            otps.remove(mobile);
            return false;
        }
        if (code != null && code.equals(entry.code())) {
            otps.remove(mobile);
            return true;
        }
        otps.put(mobile, new OtpEntry(entry.code(), entry.expiresAt(), entry.attempts() + 1));
        return false;
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
