package com.finedge.los.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DemoTokenService {
    private static final Duration TOKEN_LIFETIME = Duration.ofHours(8);
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, TokenRecord> tokens = new ConcurrentHashMap<>();

    public String issue(String principal, String role) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.put(token, new TokenRecord(principal, role, Instant.now().plus(TOKEN_LIFETIME)));
        return token;
    }

    public Authentication authenticate(String token) {
        TokenRecord record = tokens.get(token);
        if (record == null || record.expiresAt().isBefore(Instant.now())) {
            tokens.remove(token);
            return null;
        }
        return new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                record.principal(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + record.role())));
    }

    public void revoke(String token) {
        if (token != null) {
            tokens.remove(token);
        }
    }

    private record TokenRecord(String principal, String role, Instant expiresAt) { }
}