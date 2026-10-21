package com.finedge.los;

import com.finedge.los.dto.ApplicantRequest;
import com.finedge.los.service.MockPanVerificationService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PanValidationTest {

    @Test
    void validPanShouldPass() {
        ApplicantRequest request = new ApplicantRequest();
        request.setPanNumber("ABCDE1234F");
        MockPanVerificationService service = new MockPanVerificationService();
        assertTrue(service.verify(request).isVerified());
    }

    @Test
    void invalidPanShouldFail() {
        ApplicantRequest request = new ApplicantRequest();
        request.setPanNumber("ABC123");
        MockPanVerificationService service = new MockPanVerificationService();
        assertFalse(service.verify(request).isVerified());
    }
}
