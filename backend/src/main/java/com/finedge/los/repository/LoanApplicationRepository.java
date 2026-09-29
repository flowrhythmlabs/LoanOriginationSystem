package com.finedge.los.repository;

import com.finedge.los.entity.LoanApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, Long> {
    Optional<LoanApplication> findByLosNumber(String losNumber);

    @Query("SELECT application FROM LoanApplication application " +
            "JOIN application.applicant applicant " +
            "WHERE (:search = '' " +
            "OR LOWER(COALESCE(application.losNumber, '')) LIKE CONCAT('%', :search, '%') " +
            "OR LOWER(applicant.fullName) LIKE CONCAT('%', :search, '%') " +
            "OR applicant.mobileNumber LIKE CONCAT('%', :search, '%')) " +
            "AND (:status IS NULL OR application.status = :status) " +
            "ORDER BY application.createdAt DESC")
    List<LoanApplication> searchApplications(
            @Param("search") String search,
            @Param("status") LoanApplication.ApplicationStatus status);

        long countByStatus(LoanApplication.ApplicationStatus status);
}
