package com.finedge.los.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;

@Service
public class SmsOtpSender {
    public record SendResult(Integer httpStatus, String providerStatus) {}

    public static class SmsOtpException extends RuntimeException {
        private final Integer httpStatus;
        private final String providerStatus;
        private final boolean outcomeUnknown;
        private final boolean providerRejected;
        private final String diagnosticCode;

        public SmsOtpException(Integer httpStatus, String providerStatus, boolean outcomeUnknown, boolean providerRejected) {
            this(httpStatus, providerStatus, outcomeUnknown, providerRejected, "provider_request_failed");
        }

        public SmsOtpException(Integer httpStatus, String providerStatus, boolean outcomeUnknown, boolean providerRejected,
                               String diagnosticCode) {
            super("SMS provider request failed");
            this.httpStatus = httpStatus;
            this.providerStatus = providerStatus;
            this.outcomeUnknown = outcomeUnknown;
            this.providerRejected = providerRejected;
            this.diagnosticCode = diagnosticCode;
        }

        public Integer getHttpStatus() { return httpStatus; }
        public String getProviderStatus() { return providerStatus; }
        public boolean isOutcomeUnknown() { return outcomeUnknown; }
        public boolean isProviderRejected() { return providerRejected; }
        public String getDiagnosticCode() { return diagnosticCode; }
    }

    private final ExternalProviderClient client;
    @Value("${providers.sms.url:}") private String url;
    @Value("${providers.sms.api-key:}") private String key;
    @Value("${providers.sms.authorization-header:X-API-Key}") private String header;
    @Value("${providers.sms.sender-id:}") private String sender;
    @Value("${providers.sms.template-id:}") private String template;
    private final ObjectMapper mapper;
    private final RestTemplate http;

    @Autowired
    public SmsOtpSender(ExternalProviderClient client, ObjectMapper mapper, RestTemplateBuilder builder,
                       @Value("${providers.sms.connect-timeout-ms:3000}") long connectTimeoutMs,
                       @Value("${providers.sms.read-timeout-ms:8000}") long readTimeoutMs) {
        this(client, mapper, builder
                .setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                .build());
    }

    SmsOtpSender(ExternalProviderClient client, ObjectMapper mapper, RestTemplate http) {
        this.client = client;
        this.mapper = mapper;
        this.http = http;
    }

    public SendResult send(String mobile, String otp) {
        if (url != null && !url.isBlank()) {
            rejectTwoFactorVoiceUrl(url);
            try {
                JsonNode response = client.post(url, header, key, Map.of("mobileNumber", mobile, "otp", otp, "senderId", sender, "templateId", template));
                return new SendResult(200, response.path("Status").asText(null));
            } catch (RuntimeException e) {
                throw new SmsOtpException(null, null, true, false, "custom_provider_outcome_unknown");
            }
        }
        return sendViaTwoFactor(mobile, otp);
    }

    private void rejectTwoFactorVoiceUrl(String configuredUrl) {
        URI uri;
        try {
            uri = URI.create(configuredUrl);
        } catch (IllegalArgumentException e) {
            throw new SmsOtpException(null, null, false, false, "invalid_sms_provider_url");
        }
        String host = uri.getHost();
        if (host == null || !(host.equalsIgnoreCase("2factor.in") || host.equalsIgnoreCase("www.2factor.in"))) return;
        String path = uri.getPath().toUpperCase(Locale.ROOT);
        if (path.contains("/VOICE/") || !path.contains("/SMS/")) {
            throw new SmsOtpException(null, null, false, false, "invalid_2factor_sms_url");
        }
    }

    private SendResult sendViaTwoFactor(String mobile, String otp) {
        if (key == null || key.isBlank()) {
            throw new SmsOtpException(null, null, false, false, "sms_api_key_missing");
        }
        if (!mobile.matches("\\d{10}") || !otp.matches("\\d{4,8}")) {
            throw new SmsOtpException(null, null, false, false, "invalid_sms_request");
        }
        UriComponentsBuilder path = UriComponentsBuilder.fromHttpUrl("https://2factor.in")
                .pathSegment("API", "V1", key, "SMS", mobile, otp);
        if (template != null && !template.isBlank()) path.pathSegment(template);
        String target = path.build().encode().toUriString();
        try {
            ResponseEntity<String> response = http.exchange(target, HttpMethod.GET, HttpEntity.EMPTY, String.class);
            String body = response.getBody();
            JsonNode json = mapper.readTree(body == null ? "{}" : body);
            String providerStatus = json.path("Status").asText(null);
            if (!"Success".equalsIgnoreCase(providerStatus)) {
                throw new SmsOtpException(response.getStatusCode().value(), providerStatus, false, true, "provider_rejected_request");
            }
            return new SendResult(response.getStatusCode().value(), providerStatus);
        } catch (SmsOtpException e) {
            throw e;
        } catch (HttpStatusCodeException e) {
            String providerStatus = readProviderStatus(e.getResponseBodyAsString());
            boolean unknown = e.getStatusCode().is5xxServerError();
            throw new SmsOtpException(e.getStatusCode().value(), providerStatus, unknown, !unknown,
                    unknown ? "provider_server_error" : "provider_http_rejection");
        } catch (ResourceAccessException e) {
            throw new SmsOtpException(null, null, true, false, "provider_timeout_or_network_error");
        } catch (Exception e) {
            throw new SmsOtpException(null, null, true, false, "provider_response_invalid");
        }
    }

    private String readProviderStatus(String body) {
        try {
            return mapper.readTree(body).path("Status").asText(null);
        } catch (Exception ignored) {
            return null;
        }
    }
}
