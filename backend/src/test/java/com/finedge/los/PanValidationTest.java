package com.finedge.los;

import com.finedge.los.dto.ApplicantRequest;
import com.finedge.los.service.PanFormatValidationService;
import com.finedge.los.service.LocalPanKycProvider;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PanValidationTest {

    @Test
    void validPanShouldPass() {
        ApplicantRequest request = new ApplicantRequest();
        request.setPanNumber("ABCDE1234F");
        PanFormatValidationService service = new PanFormatValidationService();
        assertTrue(service.validate(request).isValid());
    }

    @Test
    void invalidPanShouldFail() {
        ApplicantRequest request = new ApplicantRequest();
        request.setPanNumber("ABC123");
        PanFormatValidationService service = new PanFormatValidationService();
        assertFalse(service.validate(request).isValid());
    }

    @Test
    void localKycPanFormatValidationShouldAcceptOnlyExactPanPattern() {
        LocalPanKycProvider validator = new LocalPanKycProvider();
        assertTrue(validator.isPanFormatValid("ABCDE1234F"));

        for (String pan : new String[] {"ABCDE12345", "ABCD1234F", "ABCDE1234", "123451234A", "ABCDEABCDE", "ABCDE-1234F", "ABCDE 1234F", ""}) {
            assertFalse(validator.isPanFormatValid(pan), pan);
        }
    }
}
