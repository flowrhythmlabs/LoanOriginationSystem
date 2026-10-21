package com.finedge.los;

import com.finedge.los.dto.ApplicantRequest;
import com.finedge.los.dto.ApplicationDetailResponse;
import com.finedge.los.dto.CreateApplicationRequest;
import com.finedge.los.dto.EmploymentRequest;
import com.finedge.los.dto.LoanDetailsRequest;
import com.finedge.los.controller.LoanApplicationController;
import com.finedge.los.entity.Document;
import com.finedge.los.entity.LoanApplication;
import com.finedge.los.repository.ApplicantRepository;
import com.finedge.los.repository.KycVerificationRepository;
import com.finedge.los.repository.LoanApplicationRepository;
import com.finedge.los.service.LoanApplicationService;
import com.finedge.los.service.DocumentStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class LoanApplicationServiceTest {
    @Autowired
    private LoanApplicationService service;

    @Autowired
    private ApplicantRepository applicantRepository;

    @Autowired
    private LoanApplicationRepository loanApplicationRepository;

    @Autowired
    private KycVerificationRepository kycVerificationRepository;

    @Autowired
    private DocumentStorageService documentStorage;

    @BeforeEach
    void resetDatabase() {
        kycVerificationRepository.deleteAll();
        loanApplicationRepository.deleteAll();
        applicantRepository.deleteAll();
    }

    @Test
    void shouldCreateApplicationWithValidData() {
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

        LoanApplication application = service.createApplication(request);
        assertNotNull(application.getId());
        assertEquals(LoanApplication.ApplicationStatus.DRAFT, application.getStatus());
        assertTrue(application.getDocuments().isEmpty(), "New application should not pre-populate documents as uploaded");

        LoanApplication updated = service.updateApplication(application.getId(), request);
        assertEquals(application.getId(), updated.getId());
        assertEquals(1, loanApplicationRepository.count());

        ApplicationDetailResponse reopened = service.getApplicationDetails(application.getId());
        assertEquals(application.getId(), reopened.getId());
        assertEquals("Amit Sharma", reopened.getApplicant().getFullName());
        assertEquals(new BigDecimal("10.50"), reopened.getLoanDetails().getInterestRate());
    }

    @Test
    void shouldRejectNegativeInterestRate() {
        CreateApplicationRequest request = createValidRequest("LMNOP9876Q");
        request.getLoanDetails().setInterestRate(new BigDecimal("-1.0"));

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.createApplication(request));
        assertTrue(exception.getMessage().contains("Interest rate"));
    }

    @Test
    @Transactional
    void shouldReplaceDocumentOnExistingApplication() {
        CreateApplicationRequest request = createValidRequest("ABCDE1234F");
        LoanApplication application = service.createApplication(request);

        Document firstUpload = service.addDocument(application.getId(), createDocument("statement-v1.pdf"));
        Document replacement = service.addDocument(application.getId(), createDocument("statement-v2.pdf"));

        assertEquals(firstUpload.getId(), replacement.getId());
        assertEquals("statement-v2.pdf", replacement.getFileName());
        assertEquals(1, service.getDocuments(application.getId()).size());
        assertEquals(application.getId(), replacement.getLoanApplication().getId());
        assertEquals(1, loanApplicationRepository.count());
    }

    @Test
    @Transactional
    void shouldUploadRetrieveAndReplaceAllRequiredDocumentTypes() throws Exception {
        LoanApplication application = service.createApplication(createValidRequest("ABCDE1234F"));
        LoanApplicationController controller = new LoanApplicationController(service, documentStorage);
        byte[] originalBytes = "original document".getBytes();
        byte[] replacementBytes = "replacement document".getBytes();

        for (Document.DocumentType type : Document.DocumentType.values()) {
            String name = type.name() + ".pdf";
            controller.uploadDocument(application.getId(), new MockMultipartFile("file", name, "application/pdf", originalBytes), type.name(), type.name());
        }

        Document original = service.getDocumentByType(application.getId(), Document.DocumentType.PREVIOUS_SALARY_SLIP);
        var originalPath = documentStorage.resolve(original.getFilePath());
        Document replacement = controller.uploadDocument(
                application.getId(),
                new MockMultipartFile("file", "previous-salary-replacement.pdf", "application/pdf", replacementBytes),
                Document.DocumentType.PREVIOUS_SALARY_SLIP.name(),
            "Previous Salary Slip").getBody();

        assertNotNull(replacement);
        assertEquals(original.getId(), replacement.getId());
        assertFalse(Files.exists(originalPath));
        assertEquals(4, service.getDocuments(application.getId()).size());
        assertArrayEquals(replacementBytes, Files.readAllBytes(documentStorage.resolve(replacement.getFilePath())));

        for (Document document : service.getDocuments(application.getId())) {
            documentStorage.delete(document.getFilePath());
        }
    }

    @Test
    void shouldRejectUploadWithoutMimeTypeAndInvalidApplicationId() {
        LoanApplicationController controller = new LoanApplicationController(service, documentStorage);
        MockMultipartFile missingMimeType = new MockMultipartFile("file", "statement.pdf", null, "content".getBytes());

        IllegalArgumentException typeError = assertThrows(IllegalArgumentException.class,
                () -> controller.uploadDocument(1L, missingMimeType, Document.DocumentType.BANK_STATEMENT.name(), "Bank Statement"));
        assertTrue(typeError.getMessage().contains("File type is not supported"));

        LoanApplication application = service.createApplication(createValidRequest("LMNOP9876Q"));
        assertThrows(RuntimeException.class,
                () -> controller.uploadDocument(application.getId() + 1000, new MockMultipartFile("file", "statement.pdf", "application/pdf", "content".getBytes()), Document.DocumentType.BANK_STATEMENT.name(), "Bank Statement"));
    }

    @Test
    void shouldSanitizeWindowsInvalidFileNameCharacters() throws Exception {
        LoanApplication application = service.createApplication(createValidRequest("QRSTU1234V"));
        LoanApplicationController controller = new LoanApplicationController(service, documentStorage);
        Document saved = controller.uploadDocument(
                application.getId(),
                new MockMultipartFile("file", "..\\salary:final?.pdf", "application/pdf", "content".getBytes()),
                Document.DocumentType.BANK_STATEMENT.name(),
                "Bank Statement").getBody();

        assertNotNull(saved);
        assertEquals("salary_final_.pdf", saved.getFileName());
        assertTrue(Files.exists(documentStorage.resolve(saved.getFilePath())));
        documentStorage.delete(saved.getFilePath());
    }

        @Test
        void shouldReturnValidationErrorsForEmptyUnsupportedAndOversizedFiles() {
        LoanApplicationController controller = new LoanApplicationController(service, documentStorage);
        String bankStatement = Document.DocumentType.BANK_STATEMENT.name();

        IllegalArgumentException emptyError = assertThrows(IllegalArgumentException.class,
            () -> controller.uploadDocument(1L, new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]), bankStatement, "Bank Statement"));
        assertTrue(emptyError.getMessage().contains("File is empty"));

        IllegalArgumentException typeError = assertThrows(IllegalArgumentException.class,
            () -> controller.uploadDocument(1L, new MockMultipartFile("file", "notes.txt", "text/plain", "content".getBytes()), bankStatement, "Bank Statement"));
        assertTrue(typeError.getMessage().contains("File type is not supported"));

        byte[] oversizedBytes = new byte[10 * 1024 * 1024 + 1];
        IllegalArgumentException sizeError = assertThrows(IllegalArgumentException.class,
            () -> controller.uploadDocument(1L, new MockMultipartFile("file", "large.pdf", "application/pdf", oversizedBytes), bankStatement, "Bank Statement"));
        assertTrue(sizeError.getMessage().contains("10 MB limit"));
        }

    @Test
    void shouldRejectSubmissionWhenMandatoryDocumentsAreMissing() {
        ApplicantRequest applicant = new ApplicantRequest();
        applicant.setFullName("Neha Verma");
        applicant.setDateOfBirth(LocalDate.of(1991, 8, 10));
        applicant.setPanNumber("FGHIJ5678K");
        applicant.setMobileNumber("9999988888");
        applicant.setEmail("neha@example.com");
        applicant.setWorkEmail("neha@company.com");
        applicant.setResidentialAddress("44 Residency Road");
        applicant.setCity("Hyderabad");
        applicant.setState("Telangana");
        applicant.setPincode("500001");

        EmploymentRequest employment = new EmploymentRequest();
        employment.setEmploymentType("SALARIED");
        employment.setEmployerName("BluePeak Labs");
        employment.setDesignation("Product Manager");
        employment.setMonthlyInHandSalary(new BigDecimal("90000"));
        employment.setMonthlyGrossSalary(new BigDecimal("135000"));

        LoanDetailsRequest loanDetails = new LoanDetailsRequest();
        loanDetails.setLoanType("PERSONAL_LOAN");
        loanDetails.setRequestedLoanAmount(new BigDecimal("600000"));
        loanDetails.setInterestRate(new BigDecimal("10.5"));
        loanDetails.setPreferredTenure(48);
        loanDetails.setPurposeOfLoan("Home renovation");

        CreateApplicationRequest request = new CreateApplicationRequest();
        request.setApplicant(applicant);
        request.setEmployment(employment);
        request.setLoanDetails(loanDetails);

        LoanApplication application = service.createApplication(request);
        application.setStatus(LoanApplication.ApplicationStatus.DRAFT);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> service.submitApplication(application.getId()));
        assertTrue(exception.getMessage().contains("required documents"));
    }

    @Test
    void shouldTrackDocumentStatus() {
        Document document = new Document();
        document.setDocumentType(Document.DocumentType.BANK_STATEMENT);
        document.setDocumentName("Bank Statement");
        document.setFileName("bank_statement.pdf");
        document.setFilePath("/tmp/bank_statement.pdf");
        document.setContentType("application/pdf");
        document.setFileSize(2048L);
        document.setStatus(Document.DocumentStatus.UPLOADED);

        assertEquals(Document.DocumentStatus.UPLOADED, document.getStatus());
        assertEquals(Document.DocumentType.BANK_STATEMENT, document.getDocumentType());
    }

    private CreateApplicationRequest createValidRequest(String pan) {
        ApplicantRequest applicant = new ApplicantRequest();
        applicant.setFullName("Amit Sharma");
        applicant.setDateOfBirth(LocalDate.of(1994, 5, 15));
        applicant.setPanNumber(pan);
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
        return request;
    }

    private Document createDocument(String fileName) {
        Document document = new Document();
        document.setDocumentType(Document.DocumentType.BANK_STATEMENT);
        document.setDocumentName("Bank Statement");
        document.setFileName(fileName);
        document.setFilePath("/tmp/" + fileName);
        document.setContentType("application/pdf");
        document.setFileSize(2048L);
        return document;
    }
}
