package com.finedge.los.repository;

import com.finedge.los.entity.LoanApplication;
import com.finedge.los.entity.LoanDetails;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, Long> {
    Optional<LoanApplication> findByLosNumber(String losNumber);
    List<LoanApplication> findByApplicant_IdAndLoanDetails_LoanTypeAndStatusIn(Long applicantId, LoanDetails.LoanType loanType, List<LoanApplication.ApplicationStatus> statuses);
    List<LoanApplication> findByApplicant_MobileNumberAndLoanDetails_LoanTypeAndStatusIn(String mobileNumber, LoanDetails.LoanType loanType, List<LoanApplication.ApplicationStatus> statuses);
}
