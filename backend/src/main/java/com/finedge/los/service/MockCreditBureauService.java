package com.finedge.los.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class MockCreditBureauService {
    private final ExternalProviderClient client;

    @Value("${providers.bureau.url:}") private String url;
    @Value("${providers.bureau.api-key:}") private String key;
    @Value("${providers.bureau.authorization-header:X-API-Key}") private String header;
    @Value("${providers.bureau.score-json-pointer:/creditScore}") private String pointer;
    @Value("${providers.bureau.name:CONFIGURED_BUREAU}") private String name;
    public MockCreditBureauService(ExternalProviderClient client) { this.client = client; }
    public CreditScoreResponse evaluate(String pan) {
        JsonNode result = client.post(url, header, key, Map.of("pan", pan));
        JsonNode scoreNode = result.at(pointer);
        if (!scoreNode.isIntegralNumber()) throw new IllegalStateException("Bureau response does not contain a numeric credit score at configured JSON pointer");

        int score = scoreNode.asInt();
        if (score < 300 || score > 900) throw new IllegalStateException("Invalid credit score returned by provider");

        return new CreditScoreResponse(pan, score, name, "SUCCESS");
    }


    public record CreditScoreResponse(String pan, int creditScore, String bureau, String status) {

        public String getPan() {return pan;} public int getCreditScore() {return creditScore;}
        public String getBureau() {return bureau;} public String getStatus() {return status;}
    }
}
