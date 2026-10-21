package com.finedge.los.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.Map;

/** Provider-neutral JSON adapter. Align payload/response with the chosen provider contract. */
@Service
public class ExternalProviderClient {
    private final RestTemplate http = new RestTemplate();
    private final ObjectMapper mapper;
    public ExternalProviderClient(ObjectMapper mapper) { this.mapper = mapper; }
    public JsonNode post(String url, String header, String apiKey, Map<String, Object> body) {
        if (url == null || url.isBlank()) throw new IllegalStateException("External provider URL is not configured");
        HttpHeaders headers = new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null && !apiKey.isBlank()) headers.set(header, apiKey);
        try {
            ResponseEntity<String> result = http.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            if (!result.getStatusCode().is2xxSuccessful()) throw new IllegalStateException("Provider request failed");
            return mapper.readTree(result.getBody() == null ? "{}" : result.getBody());
        } catch (Exception e) { throw new IllegalStateException("Provider request failed; check provider configuration and response contract", e); }
    }
}
