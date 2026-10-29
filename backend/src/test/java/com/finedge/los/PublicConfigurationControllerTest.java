package com.finedge.los;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicConfigurationControllerTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void exposesOnlyDefaultPublicConfigurationWithoutAuthentication() throws Exception {
        MvcResult result = mvc.perform(get("/api/public/config"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        Set<String> expectedFields = Set.of(
                "institutionName", "shortName", "tagline", "applicationName", "publicBaseUrl");
        Set<String> responseFields = new java.util.HashSet<>();
        response.fieldNames().forEachRemaining(responseFields::add);

        assertEquals(expectedFields, responseFields);
        mvc.perform(get("/api/applications"))
                .andExpect(status().isUnauthorized());
        assertEquals("FinEdge NBFC", response.get("institutionName").asText());
        assertEquals("FinEdge", response.get("shortName").asText());
        assertEquals("Your Growth. Our Support.", response.get("tagline").asText());
        assertEquals("FinEdge Loan Origination System", response.get("applicationName").asText());
        assertEquals("http://localhost:5173", response.get("publicBaseUrl").asText());
    }
}
