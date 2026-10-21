package com.finedge.los.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "loan_applications")
public class LoanApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String losNumber;

    @ManyToOne(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "applicant_id", nullable = false)
    private Applicant applicant;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "employment_details_id")
    private EmploymentDetails employmentDetails;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "credit_check_id")
    private CreditCheck creditCheck;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "loan_details_id")
    private LoanDetails loanDetails;

    @OneToMany(mappedBy = "loanApplication", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Document> documents = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status = ApplicationStatus.DRAFT;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate(){
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate(){
        updatedAt = LocalDateTime.now();
    }

    public enum ApplicationStatus {
        DRAFT,
        DOCUMENTS_PENDING,
        CREDIT_CHECK_COMPLETED,
        UNDER_REVIEW,
        SUBMITTED,
        APPROVED,
        REJECTED
    }

    public LoanApplication() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getLosNumber() { return losNumber; }
    public void setLosNumber(String losNumber) { this.losNumber = losNumber; }
    public Applicant getApplicant() { return applicant; }
    public void setApplicant(Applicant applicant) { this.applicant = applicant; }
    public EmploymentDetails getEmploymentDetails() { return employmentDetails; }
    public void setEmploymentDetails(EmploymentDetails employmentDetails) { this.employmentDetails = employmentDetails; }
    public CreditCheck getCreditCheck() { return creditCheck; }
    public void setCreditCheck(CreditCheck creditCheck) { this.creditCheck = creditCheck; }
    public LoanDetails getLoanDetails() { return loanDetails; }
    public void setLoanDetails(LoanDetails loanDetails) { this.loanDetails = loanDetails; }
    public List<Document> getDocuments() { return documents; }
    public void setDocuments(List<Document> documents) { this.documents = documents; }
    public ApplicationStatus getStatus() { return status; }
    public void setStatus(ApplicationStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
