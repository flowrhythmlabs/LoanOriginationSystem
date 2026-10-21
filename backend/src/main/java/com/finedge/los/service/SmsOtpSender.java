package com.finedge.los.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.net.URI;
import java.util.Map;

@Service
public class SmsOtpSender {
    private final ExternalProviderClient client;
    @Value("${providers.sms.url:}") private String url;
    @Value("${providers.sms.api-key:}") private String key;
    @Value("${providers.sms.authorization-header:X-API-Key}") private String header;
    @Value("${providers.sms.sender-id:}") private String sender;
    @Value("${providers.sms.template-id:}") private String template;
    private final ObjectMapper mapper;
    private final RestTemplate http = new RestTemplate();
    public SmsOtpSender(ExternalProviderClient client, ObjectMapper mapper) { this.client = client; this.mapper = mapper; }

    public void send(String mobile, String otp) {
        if (url != null && !url.isBlank()) {
            client.post(url, header, key, Map.of("mobileNumber", mobile, "otp", otp, "senderId", sender, "templateId", template));
            return;
        }
        sendViaTwoFactor(mobile, otp);
    }

    // The API key is part of the 2Factor URL, so it must never appear in exception messages or logs.
    private void sendViaTwoFactor(String mobile, String otp) {
        if (key == null || key.isBlank()) throw new IllegalStateException("SMS API key is not configured");
        if (!mobile.matches("\\d{10}") || !otp.matches("\\d{4,8}")) throw new IllegalArgumentException("Invalid SMS parameters");
        String path = "https://2factor.in/API/V1/" + key + "/SMS/" + mobile + "/" + otp;
        if (template != null && !template.isBlank()) path += "/" + template;
        try {
            String body = http.getForObject(URI.create(path), String.class);
            JsonNode json = mapper.readTree(body == null ? "{}" : body);
            if (!"Success".equalsIgnoreCase(json.path("Status").asText())) {
                throw new IllegalStateException("2Factor rejected the request: " + json.path("Details").asText());
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("2Factor request failed (" + e.getClass().getSimpleName() + ")");
        }
    }
}
