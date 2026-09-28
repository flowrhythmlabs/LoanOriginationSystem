package com.finedge.los.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
public class MockCreditBureauService {
    private final Random random = new Random();

    @Value("${app.mock.credit.profile:GOOD}")
    private String profile;

    public CreditScoreResponse evaluate(String pan) {
        int baseScore = switch (profile.toUpperCase()) {
            case "EXCELLENT" -> 830;
            case "GOOD" -> 760;
            case "AVERAGE" -> 600;
            case "POOR" -> 420;
            default -> 680;
        };

        int variation = random.nextInt(51) - 25;
        int score = Math.max(300, Math.min(900, baseScore + variation));

        return new CreditScoreResponse(pan, score, "MOCK-BUREAU", "SUCCESS");
    }

    public static class CreditScoreResponse {
        private String pan;
        private int creditScore;
        private String bureau;
        private String status;

        public CreditScoreResponse(String pan, int creditScore, String bureau, String status) {
            this.pan = pan;
            this.creditScore = creditScore;
            this.bureau = bureau;
            this.status = status;
        }

        public String getPan() { return pan; }
        public void setPan(String pan) { this.pan = pan; }
        public int getCreditScore() { return creditScore; }
        public void setCreditScore(int creditScore) { this.creditScore = creditScore; }
        public String getBureau() { return bureau; }
        public void setBureau(String bureau) { this.bureau = bureau; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }
}
