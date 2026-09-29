package com.finedge.los;

import com.finedge.los.entity.Applicant;
import com.finedge.los.entity.LoanApplication;
import com.finedge.los.entity.LoanApplication.ApplicationStatus;
import com.finedge.los.repository.LoanApplicationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest
@ActiveProfiles("test")
class LoanApplicationRepositoryTest {
    @Autowired
    private LoanApplicationRepository repository;

    @Test
    void searchesByLosNumberApplicantNameMobileAndStatus() {
        repository.save(createApplication("Asha Rao", "9876543210", "LOS-2026-00000001", ApplicationStatus.SUBMITTED));
        repository.save(createApplication("Ravi Shah", "9123456780", null, ApplicationStatus.DRAFT));

        assertEquals(1, repository.searchApplications("los-2026", null).size());
        assertEquals("Asha Rao", repository.searchApplications("asha", null).get(0).getApplicant().getFullName());
        assertEquals("9876543210", repository.searchApplications("9876543210", null).get(0).getApplicant().getMobileNumber());
        assertEquals(1, repository.searchApplications("", ApplicationStatus.SUBMITTED).size());
        assertEquals(1, repository.countByStatus(ApplicationStatus.DRAFT));
        assertEquals(1, repository.countByStatus(ApplicationStatus.SUBMITTED));
    }

    private LoanApplication createApplication(String name, String mobile, String losNumber, ApplicationStatus status) {
        Applicant applicant = new Applicant();
        applicant.setFullName(name);
        applicant.setDateOfBirth(LocalDate.of(1990, 1, 1));
        applicant.setPanNumber("ABCDE" + mobile.substring(0, 4) + "F");
        applicant.setMobileNumber(mobile);
        applicant.setEmail(name.toLowerCase().replace(' ', '.') + "@example.com");
        applicant.setWorkEmail(name.toLowerCase().replace(' ', '.') + ".work@example.com");
        applicant.setResidentialAddress("10 Main Street");
        applicant.setCity("Mumbai");
        applicant.setState("Maharashtra");
        applicant.setPincode("400001");

        LoanApplication application = new LoanApplication();
        application.setApplicant(applicant);
        application.setLosNumber(losNumber);
        application.setStatus(status);
        return application;
    }
}