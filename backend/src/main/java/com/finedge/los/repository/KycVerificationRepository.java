package com.finedge.los.repository;

import com.finedge.los.entity.KycVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KycVerificationRepository extends JpaRepository<KycVerification, Long> {
    Optional<KycVerification> findByLoanApplicationId(Long applicationId);
}
