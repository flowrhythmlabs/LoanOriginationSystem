package com.finedge.los;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finedge.los.repository.ApplicantConsentRepository;
import com.finedge.los.service.SmsOtpSender;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.auth.demo-otp-enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private ApplicantConsentRepository consents;
    @MockBean private SmsOtpSender smsSender;

    @Test
    void shouldPersistConsentAndCompleteDemoLogin() throws Exception {
        long consentCount = consents.count();
        String body = mvc.perform(post("/api/auth/otp/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "mobileNumber", "9876543210", "termsAccepted", "true"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.demoOtp").value(org.hamcrest.Matchers.matchesPattern("[0-9]{6}")))
                .andReturn().getResponse().getContentAsString();

        assertEquals(consentCount + 1, consents.count());
        String otp = mapper.readTree(body).get("demoOtp").asText();
        mvc.perform(post("/api/auth/login/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("mobileNumber", "9876543210", "otp", otp))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
        verifyNoInteractions(smsSender);
    }

    @Test
    void shouldRejectRequestWithoutConsent() throws Exception {
        long consentCount = consents.count();
        mvc.perform(post("/api/auth/otp/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mobileNumber\":\"9876543210\"}"))
                .andExpect(status().isBadRequest());
        assertEquals(consentCount, consents.count());
        verifyNoInteractions(smsSender);
    }
}
