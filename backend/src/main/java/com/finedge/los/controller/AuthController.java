package com.finedge.los.controller;

import com.finedge.los.dto.AuthRequest;
import com.finedge.los.service.AuthSessionService;
import com.finedge.los.entity.ApplicantConsent;
import com.finedge.los.repository.ApplicantConsentRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    private final AuthSessionService sessions;

    private final com.finedge.los.service.SmsOtpSender smsSender;
    private final ApplicantConsentRepository consentRepository;
    public AuthController(AuthSessionService sessions, ApplicantConsentRepository consentRepository, com.finedge.los.service.SmsOtpSender smsSender) { this.smsSender = smsSender; this.sessions = sessions; this.consentRepository = consentRepository; }
    public static Logger logger = org.slf4j.LoggerFactory.getLogger(AuthController.class);
    @PostMapping("/otp/request")
    public ResponseEntity<Map<String, Object>> requestOtp(@RequestBody Map<String, String> request, HttpServletRequest servletRequest) {
        Map<String, Object> response = new LinkedHashMap<>();
        String mobile = request == null ? null : request.get("mobileNumber");
        if (request == null || !"true".equalsIgnoreCase(request.get("termsAccepted"))) {
            response.put("message", "Accept the Terms and Privacy Policy before requesting an OTP.");
            return ResponseEntity.badRequest().body(response);
    }
        if (mobile == null || !mobile.matches("^[0-9]{10}$")) {
            response.put("message", "Please enter a valid 10-digit mobile number.");
            return ResponseEntity.badRequest().body(response);
        }
        consentRepository.save(new ApplicantConsent(mobile, "TERMS_AND_PRIVACY", request.getOrDefault("consentVersion", "v1"), servletRequest.getRemoteAddr()));
        String otp = sessions.requestOtp(mobile);
        logger.info("OTP requested for mobile {}: {}", mobile, otp);
        response.put("message", "OTP request accepted.");
        if (sessions.isDemoOtpEnabled() ==false) response.put("demoOtp", otp);
        else {
            try { smsSender.send(mobile, otp); }
            catch (RuntimeException e) { sessions.invalidateOtp(mobile); response.put("message", "SMS delivery failed. Please retry later."); return ResponseEntity.status(503).body(response); }
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/login/user")
    public ResponseEntity<Map<String, Object>> loginUser(@Valid @RequestBody AuthRequest request) {
        if (request == null || request.getMobileNumber() == null || request.getOtp() == null
                || !sessions.verifyOtp(request.getMobileNumber(), request.getOtp())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid or expired OTP. Request a new OTP and try again."));
        }

        String token = sessions.createSession(request.getMobileNumber(), "USER", request.getMobileNumber());
        return ResponseEntity.ok(Map.of("role", "USER", "mobileNumber", request.getMobileNumber(), "accessToken", token,
                "expiresInMinutes", sessions.getSessionMinutes(), "message", "Login successful"));
    }
    @PostMapping("/login/admin")
    public ResponseEntity<Map<String, Object>> loginAdmin(@RequestBody AuthRequest request) {
        return ResponseEntity.status(410).body(Map.of("message", "Use staff password and MFA login at /api/staff/auth."));
        }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) sessions.revoke(authorization.substring(7).trim());
        return ResponseEntity.noContent().build();
    }
}
