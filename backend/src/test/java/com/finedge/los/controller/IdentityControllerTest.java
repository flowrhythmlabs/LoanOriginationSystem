package com.finedge.los.controller;

import com.finedge.los.exception.GlobalExceptionHandler;
import com.finedge.los.service.KycProvider;
import com.finedge.los.service.KycService;
import com.finedge.los.service.MockSignzyKycProvider;
import com.finedge.los.service.SignzyKycProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class IdentityControllerTest {
    private KycProvider provider;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        provider = mock(KycProvider.class);
        mvc = MockMvcBuilders.standaloneSetup(new KycController(mock(KycService.class), provider))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void neverCallsProviderWithoutConsentOrValidInput() throws Exception {
        mvc.perform(multipart("/api/kyc/identity").param("documentType", "PAN").param("number", "ABCDE1234F"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Explicit consent is required to fetch identity details."));
        mvc.perform(multipart("/api/kyc/identity").param("documentType", "").param("consent", "true"))
                .andExpect(status().isBadRequest());
        for (String type : new String[]{"AADHAAR", "PAN"}) {
            mvc.perform(multipart("/api/kyc/identity").param("documentType", type).param("number", "invalid").param("consent", "true"))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(provider);
    }

    @Test
    void returnsActualProviderFieldsAndMasksAadhaar() throws Exception {
        when(provider.fetchIdentityDetails("AADHAAR", "234567890123", null)).thenReturn(Map.of(
                "fullName", "Test Applicant", "dateOfBirth", "1990-01-01", "gender", "Other",
                "fatherName", "Test Parent", "residentialAddress", "Test Address",
                "panNumber", "ABCDE1234F", "aadhaarNumber", "234567890123"));
        mvc.perform(multipart("/api/kyc/identity").param("documentType", "AADHAAR")
                        .param("number", "234567890123").param("consent", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fields.fullName").value("Test Applicant"))
                .andExpect(jsonPath("$.fields.fatherName").value("Test Parent"))
                .andExpect(jsonPath("$.fields.aadhaarNumber").value("XXXXXXXX0123"));
        verify(provider).fetchIdentityDetails("AADHAAR", "234567890123", null);
    }

    @Test
    void forwardsValidPanNumber() throws Exception {
        when(provider.fetchIdentityDetails("PAN", "ABCDE1234F", null)).thenReturn(Map.of("panNumber", "ABCDE1234F"));
        mvc.perform(multipart("/api/kyc/identity").param("documentType", "PAN")
                        .param("number", "ABCDE1234F").param("consent", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fields.panNumber").value("ABCDE1234F"));
    }

    @Test
    void supportsDocumentOnlyForBothTypes() throws Exception {
        when(provider.fetchIdentityDetails(anyString(), eq(""), any())).thenReturn(Map.of("fullName", "Test Applicant"));
        for (String type : new String[]{"AADHAAR", "PAN"}) {
            mvc.perform(multipart("/api/kyc/identity").file(pdf(8))
                            .param("documentType", type).param("consent", "true"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.fields.fullName").value("Test Applicant"));
            verify(provider).fetchIdentityDetails(eq(type), eq(""), any());
        }
    }

    @Test
    void rejectsUnsupportedEmptyOversizedAndForgedFilesBeforeCallingProvider() throws Exception {
        for (var file : new MockMultipartFile[]{
                new MockMultipartFile("file", "test.txt", "text/plain", new byte[]{1}),
                new MockMultipartFile("file", "test.pdf", "application/pdf", new byte[0]),
                new MockMultipartFile("file", "test.pdf", "application/pdf", "not pdf".getBytes(StandardCharsets.UTF_8)),
                pdf(5 * 1024 * 1024 + 1)
        }) {
            mvc.perform(multipart("/api/kyc/identity").file(file).param("documentType", "PAN")
                            .param("number", "ABCDE1234F").param("consent", "true"))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(provider);
    }

    @Test
    void acceptsExactlyFiveMegabytes() throws Exception {
        when(provider.fetchIdentityDetails(anyString(), anyString(), any())).thenReturn(Map.of("fullName", "Test Applicant"));
        mvc.perform(multipart("/api/kyc/identity").file(pdf(5 * 1024 * 1024))
                        .param("documentType", "PAN").param("consent", "true"))
                .andExpect(status().isOk());
    }

    @Test
    void unavailableAndEmptyResponsesNeverClaimSuccess() throws Exception {
        when(provider.fetchIdentityDetails(anyString(), anyString(), any()))
                .thenThrow(new UnsupportedOperationException()).thenReturn(Map.of());
        mvc.perform(multipart("/api/kyc/identity").param("documentType", "PAN")
                        .param("number", "ABCDE1234F").param("consent", "true"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Aadhaar/PAN identity fetching is not configured. Please enter your details manually."));
        mvc.perform(multipart("/api/kyc/identity").param("documentType", "PAN")
                        .param("number", "ABCDE1234F").param("consent", "true"))
                .andExpect(status().isBadGateway());
    }

    @Test
    void mockProviderReturnsDemoIdentityAndLiveProviderRemainsUnconfigured() {
        var fields = new MockSignzyKycProvider().fetchIdentityDetails("PAN", "ABCDE1234F", null);
        org.junit.jupiter.api.Assertions.assertEquals("Rahul Sharma", fields.get("fullName"));
        org.junit.jupiter.api.Assertions.assertEquals("1995-05-15", fields.get("dateOfBirth"));
        org.junit.jupiter.api.Assertions.assertEquals("Male", fields.get("gender"));
        org.junit.jupiter.api.Assertions.assertEquals("Suresh Sharma", fields.get("fatherName"));
        org.junit.jupiter.api.Assertions.assertEquals("123 Main Street, Varanasi, UP, 221006", fields.get("residentialAddress"));
        org.junit.jupiter.api.Assertions.assertEquals("ABCDE1234F", fields.get("panNumber"));
        assertThrows(UnsupportedOperationException.class,
                () -> new SignzyKycProvider().fetchIdentityDetails("PAN", "ABCDE1234F", null));
    }

    private MockMultipartFile pdf(int size) {
        byte[] bytes = new byte[size];
        System.arraycopy("%PDF-".getBytes(StandardCharsets.US_ASCII), 0, bytes, 0, 5);
        return new MockMultipartFile("file", "identity.pdf", "application/pdf", bytes);
    }
}
