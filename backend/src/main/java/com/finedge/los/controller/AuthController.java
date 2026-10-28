package com.finedge.los.controller;

import com.finedge.los.dto.AuthRequest;
import com.finedge.los.service.AuthSessionService;
import com.finedge.los.service.SmsOtpSender;
import com.finedge.los.entity.ApplicantConsent;
import com.finedge.los.repository.ApplicantConsentRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private static final Pattern SAFE_DIAGNOSTIC = Pattern.compile("[A-Za-z0-9_-]{1,48}");
    private final AuthSessionService sessions;

    private final SmsOtpSender smsSender;
    private final ApplicantConsentRepository consentRepository;
    public AuthController(AuthSessionService sessions, ApplicantConsentRepository consentRepository, SmsOtpSender smsSender) { this.smsSender = smsSender; this.sessions = sessions; this.consentRepository = consentRepository; }
    @PostMapping("/otp/request")
    public ResponseEntity<Map<String, Object>> requestOtp(@RequestBody Map<String, String> request, HttpServletRequest servletRequest) {
        Map<String, Object> response = new LinkedHashMap<>();
        String correlationId = UUID.randomUUID().toString();
        response.put("correlationId", correlationId);
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
        AuthSessionService.OtpRequest otpRequest = sessions.requestOtp(mobile);
        if (!otpRequest.allowed()) {
            response.put("message", "Please wait before requesting another OTP.");
            response.put("requestPending", true);
            response.put("retryAfterSeconds", otpRequest.retryAfterSeconds());
            response.put("requestState", "COOLDOWN");
            logger.info("event=otp_request correlation_id={} timestamp={} outcome=cooldown cooldown_seconds={}",
                    correlationId, Instant.now(), otpRequest.retryAfterSeconds());
            return ResponseEntity.status(429).body(response);
        }
        String otp = otpRequest.code();
        long providerStartedAt = System.nanoTime();
        if (sessions.isDemoOtpEnabled()==false) response.put("demoOtp", otp);
        else {
            try {
                SmsOtpSender.SendResult result = smsSender.send(mobile, otp);
                long latencyMs = elapsedMillis(providerStartedAt);
                response.put("message", "If your number is eligible, you will receive an OTP shortly.");
                response.put("requestPending", true);
                response.put("retryAfterSeconds", otpRequest.retryAfterSeconds());
                response.put("requestState", "ACCEPTED");
                response.put("deliveryStatus", "UNKNOWN");
                logger.info("event=otp_provider_request correlation_id={} timestamp={} operation=sms_otp http_status={} provider_status={} latency_ms={} delivery_status=unknown outcome=accepted cooldown_seconds={}",
                        correlationId, Instant.now(), safeStatus(result.httpStatus()), safeProviderStatus(result.providerStatus()),
                        latencyMs, otpRequest.retryAfterSeconds());
            } catch (SmsOtpSender.SmsOtpException e) {
                long latencyMs = elapsedMillis(providerStartedAt);
                long retryAfter = e.isOutcomeUnknown()
                        ? sessions.deferOtpResendUntilExpiry(mobile)
                        : sessions.rejectOtpAndRetainCooldown(mobile);
                response.put("retryAfterSeconds", retryAfter);
                response.put("message", "We couldn’t send the OTP right now. Please try again shortly.");
                response.put("requestPending", e.isOutcomeUnknown());
                response.put("requestState", e.isOutcomeUnknown() ? "VERIFICATION_PENDING" : "FAILED");
                response.put("deliveryStatus", e.isOutcomeUnknown() ? "UNKNOWN" : "NOT_ACCEPTED");
                logger.warn("event=otp_provider_request correlation_id={} timestamp={} operation=sms_otp http_status={} provider_status={} diagnostic_code={} latency_ms={} delivery_status={} outcome={} cooldown_seconds={}",
                        correlationId, Instant.now(), safeStatus(e.getHttpStatus()), safeProviderStatus(e.getProviderStatus()),
                        safeDiagnostic(e.getDiagnosticCode()), latencyMs, e.isOutcomeUnknown() ? "unknown" : "not_accepted",
                        e.isOutcomeUnknown() ? "ambiguous" : "failed", retryAfter);
                return ResponseEntity.status(503).body(response);
            } catch (RuntimeException e) {
                long latencyMs = elapsedMillis(providerStartedAt);
                long retryAfter = sessions.deferOtpResendUntilExpiry(mobile);
                response.put("retryAfterSeconds", retryAfter);
                response.put("message", "We couldn’t send the OTP right now. Please try again shortly.");
                response.put("requestPending", true);
                response.put("requestState", "VERIFICATION_PENDING");
                response.put("deliveryStatus", "UNKNOWN");
                logger.error("event=otp_provider_request correlation_id={} timestamp={} operation=sms_otp http_status=none provider_status=none diagnostic_code=unexpected_backend_error exception_type={} latency_ms={} delivery_status=unknown outcome=ambiguous cooldown_seconds={}",
                        correlationId, Instant.now(), safeDiagnostic(e.getClass().getSimpleName()), latencyMs, retryAfter);
                return ResponseEntity.status(503).body(response);
            }
        }
        if (sessions.isDemoOtpEnabled()) {
            response.put("message", "If your number is eligible, you will receive an OTP shortly.");
            response.put("requestPending", true);
            response.put("retryAfterSeconds", otpRequest.retryAfterSeconds());
            response.put("requestState", "ACCEPTED");
            response.put("deliveryStatus", "UNKNOWN");
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/login/user")
    public ResponseEntity<Map<String, Object>> loginUser(@Valid @RequestBody AuthRequest request) {
        String correlationId = UUID.randomUUID().toString();
        AuthSessionService.OtpVerificationResult verificationResult = request == null || request.getMobileNumber() == null
                ? AuthSessionService.OtpVerificationResult.INVALID
                : sessions.verifyOtpResult(request.getMobileNumber(), request.getOtp());
        if (verificationResult != AuthSessionService.OtpVerificationResult.VERIFIED) {
            boolean expired = verificationResult == AuthSessionService.OtpVerificationResult.EXPIRED;
            logger.info("event=otp_verification correlation_id={} timestamp={} outcome={}",
                    correlationId, Instant.now(), expired ? "expired" : "invalid");
            return ResponseEntity.status(401).body(Map.of(
                    "errorCode", expired ? "EXPIRED_OTP" : "INVALID_OTP",
                    "message", expired ? "This OTP has expired. Please request a new one." : "The OTP you entered is incorrect. Please try again."
            ));
        }

        String token = sessions.createSession(request.getMobileNumber(), "USER", request.getMobileNumber());
        logger.info("event=otp_verification correlation_id={} timestamp={} outcome=verified", correlationId, Instant.now());
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

    private static long elapsedMillis(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private static String safeStatus(Integer status) {
        return status == null ? "none" : status.toString();
    }

    private static String safeDiagnostic(String value) {
        if (value == null || !SAFE_DIAGNOSTIC.matcher(value).matches()) return "other";
        return value;
    }

    private static String safeProviderStatus(String value) {
        if (value == null || !value.matches("[A-Za-z_-]{1,32}")) return "other";
        return value;
    }
}
