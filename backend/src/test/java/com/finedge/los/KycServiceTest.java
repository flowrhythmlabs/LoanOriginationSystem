package com.finedge.los;

import com.finedge.los.dto.ApplicantRequest;
import com.finedge.los.dto.CreateApplicationRequest;
import com.finedge.los.dto.EmploymentRequest;
import com.finedge.los.dto.LoanDetailsRequest;
import com.finedge.los.entity.KycVerification;
import com.finedge.los.entity.LoanApplication;
import com.finedge.los.exception.ResourceNotFoundException;
import com.finedge.los.service.KycService;
import com.finedge.los.service.LoanApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class KycServiceTest {

    @Autowired
    private KycService kycService;

    @Autowired
    private LoanApplicationService loanApplicationService;

    @Test
    void shouldCreateKycForValidApplication() {
        Long applicationId = createApplication();

        KycVerification verification = kycService.initiateKyc(applicationId, "PAN_VERIFICATION");

        assertNotNull(verification.getId());
        assertEquals(KycVerification.VerificationType.PAN_VERIFICATION, verification.getVerificationType());
        assertTrue(verification.getStatus() == KycVerification.KycStatus.PENDING || verification.getStatus() == KycVerification.KycStatus.VERIFIED);
    }

    @Test
    void shouldRejectDuplicateKycRequestForSameApplication() {
        Long applicationId = createApplication();
        kycService.initiateKyc(applicationId, "PAN_VERIFICATION");

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> kycService.initiateKyc(applicationId, "PAN_VERIFICATION"));

        assertTrue(exception.getMessage().contains("already exists") || exception.getMessage().contains("duplicate"));
    }

    @Test
    void shouldFailForUnknownApplication() {
        ResourceNotFoundException exception = assertThrows(ResourceNotFoundException.class,
                () -> kycService.initiateKyc(9999L, "PAN_VERIFICATION"));

        assertTrue(exception.getMessage().contains("Application not found"));
    }

    private Long createApplication() {
        ApplicantRequest applicant = new ApplicantRequest();
        applicant.setFullName("Amit Sharma");
        applicant.setDateOfBirth(LocalDate.of(1994, 5, 15));
        applicant.setPanNumber("ABCDE1234F");
        applicant.setMobileNumber("9876543210");
        applicant.setEmail("amit@example.com");
        applicant.setWorkEmail("amit@company.com");
        applicant.setResidentialAddress("12 MG Road");
        applicant.setCity("Bengaluru");
        applicant.setState("Karnataka");
        applicant.setPincode("560001");

        EmploymentRequest employment = new EmploymentRequest();
        employment.setEmploymentType("SALARIED");
        employment.setEmployerName("FinEdge Technologies");
        employment.setDesignation("Senior Analyst");
        employment.setMonthlyInHandSalary(new BigDecimal("85000"));
        employment.setMonthlyGrossSalary(new BigDecimal("120000"));

        LoanDetailsRequest loanDetails = new LoanDetailsRequest();
        loanDetails.setLoanType("PERSONAL_LOAN");
        loanDetails.setRequestedLoanAmount(new BigDecimal("500000"));
        loanDetails.setInterestRate(new BigDecimal("10.5"));
        loanDetails.setPreferredTenure(36);
        loanDetails.setPurposeOfLoan("Medical emergency");

        CreateApplicationRequest request = new CreateApplicationRequest();
        request.setApplicant(applicant);
        request.setEmployment(employment);
        request.setLoanDetails(loanDetails);

        LoanApplication application = loanApplicationService.createApplication(request);
        return application.getId();
    }
}
