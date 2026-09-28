package com.finedge.los.repository;

import com.finedge.los.entity.Applicant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApplicantRepository extends JpaRepository<Applicant, Long> {
    Optional<Applicant> findByPanNumber(String panNumber);
    List<Applicant> findAllByPanNumber(String panNumber);
}
