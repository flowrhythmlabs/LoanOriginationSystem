package com.finedge.los.controller;

import com.finedge.los.repository.ApplicantConsentRepository;
import com.finedge.los.service.AuthSessionService;
import com.finedge.los.service.SmsOtpSender;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthControllerOtpTest {
    @Test
    void preservesOtpWhenProviderOutcomeIsUnknown() {
        AuthSessionService sessions = mock(AuthSessionService.class);
        SmsOtpSender sender = mock(SmsOtpSender.class);
        ApplicantConsentRepository consents = mock(ApplicantConsentRepository.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(sessions.requestOtp("9876543210")).thenReturn(new AuthSessionService.OtpRequest("123456", true, 30));
        when(sessions.deferOtpResendUntilExpiry("9876543210")).thenReturn(300L);
        when(sessions.isDemoOtpEnabled()).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(sender.send("9876543210", "123456")).thenThrow(new SmsOtpSender.SmsOtpException(null, null, true, false));

        AuthController controller = new AuthController(sessions, consents, sender);
        var response = controller.requestOtp(Map.of(
                "mobileNumber", "9876543210",
                "termsAccepted", "true"
        ), request);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals(true, response.getBody().get("requestPending"));
        assertEquals("UNKNOWN", response.getBody().get("deliveryStatus"));
        assertEquals("We couldn’t send the OTP right now. Please try again shortly.", response.getBody().get("message"));
        assertFalse(response.getBody().containsKey("providerStatus"));
        assertTrue(response.getBody().containsKey("correlationId"));
        verify(sessions, never()).invalidateOtp(any());
    }

    @Test
    void returnsSafeFailureForProviderRejectionAndRetainsCooldown() {
        AuthSessionService sessions = mock(AuthSessionService.class);
        SmsOtpSender sender = mock(SmsOtpSender.class);
        ApplicantConsentRepository consents = mock(ApplicantConsentRepository.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(sessions.requestOtp("9876543210")).thenReturn(new AuthSessionService.OtpRequest("123456", true, 30));
        when(sessions.rejectOtpAndRetainCooldown("9876543210")).thenReturn(30L);
        when(sessions.isDemoOtpEnabled()).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(sender.send("9876543210", "123456")).thenThrow(
                new SmsOtpSender.SmsOtpException(401, "InvalidKey", false, true, "sms_api_key_missing"));

        AuthController controller = new AuthController(sessions, consents, sender);
        var response = controller.requestOtp(Map.of(
                "mobileNumber", "9876543210",
                "termsAccepted", "true"
        ), request);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals(false, response.getBody().get("requestPending"));
        assertEquals(30L, response.getBody().get("retryAfterSeconds"));
        assertEquals("We couldn’t send the OTP right now. Please try again shortly.", response.getBody().get("message"));
        assertFalse(response.getBody().toString().contains("InvalidKey"));
        assertFalse(response.getBody().toString().contains("sms_api_key_missing"));
    }

    @Test
    void reportsProviderAcceptanceWithoutClaimingDelivery() {
        AuthSessionService sessions = mock(AuthSessionService.class);
        SmsOtpSender sender = mock(SmsOtpSender.class);
        ApplicantConsentRepository consents = mock(ApplicantConsentRepository.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(sessions.requestOtp("9876543210")).thenReturn(new AuthSessionService.OtpRequest("123456", true, 30));
        when(sessions.isDemoOtpEnabled()).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(sender.send("9876543210", "123456"))
                .thenReturn(new SmsOtpSender.SendResult(200, "Success"));

        AuthController controller = new AuthController(sessions, consents, sender);
        var response = controller.requestOtp(Map.of(
                "mobileNumber", "9876543210",
                "termsAccepted", "true"
        ), request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("UNKNOWN", response.getBody().get("deliveryStatus"));
        assertEquals("If your number is eligible, you will receive an OTP shortly.", response.getBody().get("message"));
        assertFalse(response.getBody().containsKey("providerStatus"));
    }

    @Test
    void returnsSeparateSafeVerificationMessagesForExpiredAndInvalidOtps() {
        AuthSessionService sessions = mock(AuthSessionService.class);
        ApplicantConsentRepository consents = mock(ApplicantConsentRepository.class);
        AuthController controller = new AuthController(sessions, consents, mock(SmsOtpSender.class));
        var request = new com.finedge.los.dto.AuthRequest();
        request.setMobileNumber("9876543210");
        request.setOtp("123456");
        when(sessions.verifyOtpResult("9876543210", "123456"))
                .thenReturn(AuthSessionService.OtpVerificationResult.EXPIRED)
                .thenReturn(AuthSessionService.OtpVerificationResult.INVALID);

        var expired = controller.loginUser(request);
        var invalid = controller.loginUser(request);

        assertEquals("EXPIRED_OTP", expired.getBody().get("errorCode"));
        assertEquals("This OTP has expired. Please request a new one.", expired.getBody().get("message"));
        assertEquals("INVALID_OTP", invalid.getBody().get("errorCode"));
        assertEquals("The OTP you entered is incorrect. Please try again.", invalid.getBody().get("message"));
    }

    @Test
    void successfulOtpVerificationPreservesExistingLoginResponse() {
        AuthSessionService sessions = mock(AuthSessionService.class);
        AuthController controller = new AuthController(
                sessions,
                mock(ApplicantConsentRepository.class),
                mock(SmsOtpSender.class)
        );
        var request = new com.finedge.los.dto.AuthRequest();
        request.setMobileNumber("9876543210");
        request.setOtp("123456");
        when(sessions.verifyOtpResult("9876543210", "123456"))
                .thenReturn(AuthSessionService.OtpVerificationResult.VERIFIED);
        when(sessions.createSession("9876543210", "USER", "9876543210")).thenReturn("access-token");
        when(sessions.getSessionMinutes()).thenReturn(60L);

        var response = controller.loginUser(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("USER", response.getBody().get("role"));
        assertEquals("access-token", response.getBody().get("accessToken"));
        assertEquals(60L, response.getBody().get("expiresInMinutes"));
    }
}
