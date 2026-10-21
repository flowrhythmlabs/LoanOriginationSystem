package com.finedge.los.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class SmsOtpSender {
    private final ExternalProviderClient client;
    @Value("${providers.sms.url:}") private String url;
    @Value("${providers.sms.api-key:}") private String key;
    @Value("${providers.sms.authorization-header:X-API-Key}") private String header;
    @Value("${providers.sms.sender-id:}") private String sender;
    @Value("${providers.sms.template-id:}") private String template;
    public SmsOtpSender(ExternalProviderClient client) { this.client = client; }
    public void send(String mobile, String otp) {
        client.post(url, header, key, Map.of("mobileNumber", mobile, "otp", otp, "senderId", sender, "templateId", template));
    }
}
