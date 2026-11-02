package com.finedge.los.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Service
public class StaffIdentityService {
    private final JdbcTemplate db;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();
    private record Challenge(long staffId, String username, Instant expires, int attempts) {}
    private final Map<String, Challenge> challenges = new ConcurrentHashMap<>();
    public StaffIdentityService(JdbcTemplate db) { this.db = db; }

    public String passwordStep(String username, String password) {
        if (username == null || password == null) throw new SecurityException("Invalid credentials");
        var accounts = db.queryForList("SELECT id, password_hash, enabled, locked_until, failed_login_attempts FROM staff_account WHERE username=?", username);
        if (accounts.isEmpty()) throw new SecurityException("Invalid credentials");
        var account = accounts.get(0);
        long id = ((Number)account.get("id")).longValue();
        Object lock = account.get("locked_until");
        if (!Boolean.TRUE.equals(account.get("enabled")) || (lock instanceof java.sql.Timestamp && ((java.sql.Timestamp)lock).toInstant().isAfter(Instant.now())))
            throw new SecurityException("Account disabled or temporarily locked. Contact administrator.");
        if (!encoder.matches(password, String.valueOf(account.get("password_hash")))) {
            db.update("UPDATE staff_account SET failed_login_attempts=failed_login_attempts+1, locked_until=CASE WHEN failed_login_attempts+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=?", id);
            throw new SecurityException("Invalid credentials");
        }
        db.update("UPDATE staff_account SET failed_login_attempts=0, locked_until=NULL WHERE id=?", id);
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        challenges.put(challenge, new Challenge(id, username, Instant.now().plusSeconds(300), 0));
        return challenge;
    }

    public Map<String,Object> completePasswordLogin(String challengeId, AuthSessionService sessions) {
        Challenge challenge = challenges.remove(challengeId);
        if (challenge == null || challenge.expires().isBefore(Instant.now()))
            throw new SecurityException("Sign-in challenge expired. Try again.");
        return createStaffSession(challenge, sessions);
    }
    private Map<String,Object> createStaffSession(Challenge challenge, AuthSessionService sessions) {
        var roles = db.queryForList("SELECT role_code FROM staff_account_role WHERE staff_id=? ORDER BY role_code", String.class, challenge.staffId());
        if (roles.isEmpty()) throw new SecurityException("No staff role assigned");
        String token = sessions.createSession(challenge.username(), roles.get(0), null);
        return Map.of("accessToken",token,"role",roles.get(0),"roles",roles,"username",challenge.username(),"expiresInMinutes",sessions.getSessionMinutes());
    }
    public Map<String,Object> mfaStep(String challengeId, String otp, AuthSessionService sessions) {
        Challenge challenge = challenges.get(challengeId);
        if (challenge == null || challenge.expires().isBefore(Instant.now()) || challenge.attempts() >= 5) {
            challenges.remove(challengeId); throw new SecurityException("MFA challenge expired or locked. Sign in again.");
        }
        String secret = db.query("SELECT totp_secret_encrypted FROM staff_account WHERE id=?", rs -> rs.next() ? rs.getString(1) : null, challenge.staffId());
        // The secret column must be populated with an encrypted-at-rest TOTP secret by provisioning tooling.
        // This implementation expects a BASE32 secret and intentionally refuses unprovisioned users.
        if (secret == null || secret.isBlank()) throw new SecurityException("MFA is not enrolled. Contact administrator.");
        boolean valid = false;
        for (long delta=-1; delta<=1; delta++) valid |= otp != null && otp.matches("[0-9]{6}") && otp.equals(totp(secret, Instant.now().getEpochSecond()/30+delta));
        if (!valid) {
            challenges.put(challengeId, new Challenge(challenge.staffId(), challenge.username(), challenge.expires(), challenge.attempts()+1));
            throw new SecurityException("Incorrect MFA code. Try again.");
        }
        challenges.remove(challengeId);
        return createStaffSession(challenge, sessions);
    }

    private static String totp(String base32, long counter) {
        try {
            String alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            int buffer=0,bits=0; java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
            for(char c:base32.toUpperCase(Locale.ROOT).replace("=", "").toCharArray()) {
                int v=alphabet.indexOf(c); if(v<0) throw new IllegalArgumentException("Invalid TOTP secret");
                buffer=(buffer<<5)|v; bits+=5; if(bits>=8){bits-=8;out.write((buffer>>bits)&255);}
            }
            byte[] msg=java.nio.ByteBuffer.allocate(8).putLong(counter).array();
            Mac mac=Mac.getInstance("HmacSHA1");mac.init(new SecretKeySpec(out.toByteArray(),"HmacSHA1"));
            byte[] hash=mac.doFinal(msg);int offset=hash[hash.length-1]&15;
            int n=((hash[offset]&127)<<24)|((hash[offset+1]&255)<<16)|((hash[offset+2]&255)<<8)|(hash[offset+3]&255);
            return String.format(Locale.ROOT,"%06d",n%1000000);
        } catch(Exception e){throw new SecurityException("MFA verification unavailable");}
    }
}
