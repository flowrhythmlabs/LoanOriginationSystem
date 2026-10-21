package com.finedge.los.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.SocketTimeoutException;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SmsOtpSenderTest {
    private RestTemplate http;
    private MockRestServiceServer server;
    private SmsOtpSender sender;

    @BeforeEach
    void setUp() {
        http = new RestTemplate();
        server = MockRestServiceServer.createServer(http);
        sender = new SmsOtpSender(new ExternalProviderClient(new ObjectMapper()), new ObjectMapper(), http);
        ReflectionTestUtils.setField(sender, "key", "test-api-key");
        ReflectionTestUtils.setField(sender, "template", "test-template");
    }

    @Test
    void treatsProviderSuccessAsAcceptedRatherThanConfirmedDelivery() {
        server.expect(requestTo("https://2factor.in/API/V1/test-api-key/SMS/9876543210/123456/test-template"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"Status\":\"Success\",\"Details\":\"session-ref\"}", org.springframework.http.MediaType.APPLICATION_JSON));

        SmsOtpSender.SendResult result = sender.send("9876543210", "123456");

        assertEquals(200, result.httpStatus());
        assertEquals("Success", result.providerStatus());
        server.verify();
    }

    @Test
    void exposesProviderRejectionWithoutLeakingResponseDetails() {
        server.expect(requestTo("https://2factor.in/API/V1/test-api-key/SMS/9876543210/123456/test-template"))
                .andRespond(withSuccess("{\"Status\":\"Error\",\"Details\":\"private provider detail\"}", org.springframework.http.MediaType.APPLICATION_JSON));

        SmsOtpSender.SmsOtpException error = assertThrows(SmsOtpSender.SmsOtpException.class,
                () -> sender.send("9876543210", "123456"));

        assertEquals("Error", error.getProviderStatus());
        assertFalse(error.isOutcomeUnknown());
        assertTrue(error.isProviderRejected());
        assertFalse(error.getMessage().contains("private provider detail"));
        server.verify();
    }

    @Test
    void marksServerErrorsAsAmbiguous() {
        server.expect(requestTo("https://2factor.in/API/V1/test-api-key/SMS/9876543210/123456/test-template"))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY)
                        .body("{\"Status\":\"Error\"}")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON));

        SmsOtpSender.SmsOtpException error = assertThrows(SmsOtpSender.SmsOtpException.class,
                () -> sender.send("9876543210", "123456"));

        assertEquals(502, error.getHttpStatus());
        assertTrue(error.isOutcomeUnknown());
        server.verify();
    }

    @Test
    void treatsMalformedProviderResponseAsAmbiguousWithoutReturningItsBody() {
        server.expect(requestTo("https://2factor.in/API/V1/test-api-key/SMS/9876543210/123456/test-template"))
                .andRespond(withSuccess("private provider response", org.springframework.http.MediaType.APPLICATION_JSON));

        SmsOtpSender.SmsOtpException error = assertThrows(SmsOtpSender.SmsOtpException.class,
                () -> sender.send("9876543210", "123456"));

        assertEquals("provider_response_invalid", error.getDiagnosticCode());
        assertTrue(error.isOutcomeUnknown());
        assertFalse(error.getMessage().contains("private provider response"));
        server.verify();
    }

    @Test
    void marksTimeoutAsAmbiguousWithoutExposingExceptionDetails() {
        server.expect(requestTo("https://2factor.in/API/V1/test-api-key/SMS/9876543210/123456/test-template"))
                .andRespond(request -> {
                    throw new ResourceAccessException("timed out", new SocketTimeoutException("private timeout detail"));
                });

        SmsOtpSender.SmsOtpException error = assertThrows(SmsOtpSender.SmsOtpException.class,
                () -> sender.send("9876543210", "123456"));

        assertNull(error.getHttpStatus());
        assertTrue(error.isOutcomeUnknown());
        assertFalse(error.getMessage().contains("private timeout detail"));
        server.verify();
    }

    @Test
    void refusesConfiguredTwoFactorVoiceEndpointBeforeSending() {
        ReflectionTestUtils.setField(sender, "url", "https://2factor.in/API/V1/test-api-key/VOICE/9876543210/123456");

        SmsOtpSender.SmsOtpException error = assertThrows(SmsOtpSender.SmsOtpException.class,
                () -> sender.send("9876543210", "123456"));

        assertFalse(error.isOutcomeUnknown());
        assertFalse(error.isProviderRejected());
        server.verify();
    }

    @Test
    void identifiesMissingApiKeyWithoutExposingConfigurationDetails() {
        ReflectionTestUtils.setField(sender, "key", "");

        SmsOtpSender.SmsOtpException error = assertThrows(SmsOtpSender.SmsOtpException.class,
                () -> sender.send("9876543210", "123456"));

        assertEquals("sms_api_key_missing", error.getDiagnosticCode());
        assertFalse(error.isOutcomeUnknown());
        assertFalse(error.getMessage().contains("test-api-key"));
        server.verify();
    }
}
