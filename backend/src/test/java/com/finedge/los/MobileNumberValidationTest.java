package com.finedge.los;

import com.finedge.los.dto.ApplicantRequest;
import com.finedge.los.dto.AuthRequest;
import com.finedge.los.dto.CreateApplicationRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MobileNumberValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsOnlyExactlyTenDigitsForLoginAndApplicantRequests() {
        for (String mobile : new String[]{"9876543210", "1234567890"}) {
            assertTrue(validateLoginMobile(mobile));
            assertTrue(validateApplicantMobile(mobile));
        }

        for (String mobile : new String[]{
                "123456789", "12345678901", "9876543210abc", "abcdefghij",
                "98765abc10", "9876 543210", "+919876543210", ""
        }) {
            assertFalse(validateLoginMobile(mobile), "Unexpectedly accepted login mobile: " + mobile);
            assertFalse(validateApplicantMobile(mobile), "Unexpectedly accepted applicant mobile: " + mobile);
        }
    }

    @Test
    void cascadesApplicantMobileValidationFromApplicationRequest() {
        ApplicantRequest applicant = new ApplicantRequest();
        applicant.setMobileNumber("ABC9876543210");
        CreateApplicationRequest request = new CreateApplicationRequest();
        request.setApplicant(applicant);

        assertTrue(validator.validate(request).stream().anyMatch(error -> error.getPropertyPath().toString().equals("applicant.mobileNumber")));
    }

    private boolean validateLoginMobile(String mobile) {
        AuthRequest request = new AuthRequest();
        request.setMobileNumber(mobile);
        return validator.validate(request).stream().noneMatch(error -> error.getPropertyPath().toString().equals("mobileNumber"));
    }

    private boolean validateApplicantMobile(String mobile) {
        ApplicantRequest request = new ApplicantRequest();
        request.setMobileNumber(mobile);
        return validator.validate(request).stream().noneMatch(error -> error.getPropertyPath().toString().equals("mobileNumber"));
    }
}