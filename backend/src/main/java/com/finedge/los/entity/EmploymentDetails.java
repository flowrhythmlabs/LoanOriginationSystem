package com.finedge.los.entity;

import jakarta.persistence.*;
import java.util.HashMap;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.math.BigDecimal;

@Entity
@Table(name = "employment_details")
public class EmploymentDetails {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EmploymentType employmentType;

    private String employerName;
    private String designation;
    private Double totalWorkExperienceYears;
    private Double currentEmployerExperienceYears;
    private BigDecimal monthlyInHandSalary;
    private BigDecimal monthlyGrossSalary;

    @OneToOne(mappedBy = "employmentDetails")
    @JsonIgnore
    private LoanApplication loanApplication;
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "employment_additional_details", joinColumns = @JoinColumn(name = "employment_details_id"))
    @MapKeyColumn(name = "field_key")
    @Column(name = "field_value", length = 4000)
    private Map<String, String> additionalDetails = new HashMap<>();
    public Map<String, String> getAdditionalDetails() { return additionalDetails; }
    public void setAdditionalDetails(Map<String, String> additionalDetails) { this.additionalDetails = additionalDetails == null ? new HashMap<>() : new HashMap<>(additionalDetails); }

    @Column(nullable = false)
    private java.time.LocalDateTime createdAt;

    @Column(nullable = false)
    private java.time.LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate(){
        createdAt = java.time.LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate(){
        updatedAt = java.time.LocalDateTime.now();
    }

    public enum EmploymentType {
        SALARIED,
        SELF_EMPLOYED,
        BUSINESS_OWNER
    }

    public EmploymentDetails() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public EmploymentType getEmploymentType() { return employmentType; }
    public void setEmploymentType(EmploymentType employmentType) { this.employmentType = employmentType; }
    public String getEmployerName() { return employerName; }
    public void setEmployerName(String employerName) { this.employerName = employerName; }
    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
    public Double getTotalWorkExperienceYears() { return totalWorkExperienceYears; }
    public void setTotalWorkExperienceYears(Double totalWorkExperienceYears) { this.totalWorkExperienceYears = totalWorkExperienceYears; }
    public Double getCurrentEmployerExperienceYears() { return currentEmployerExperienceYears; }
    public void setCurrentEmployerExperienceYears(Double currentEmployerExperienceYears) { this.currentEmployerExperienceYears = currentEmployerExperienceYears; }
    public BigDecimal getMonthlyInHandSalary() { return monthlyInHandSalary; }
    public void setMonthlyInHandSalary(BigDecimal monthlyInHandSalary) { this.monthlyInHandSalary = monthlyInHandSalary; }
    public BigDecimal getMonthlyGrossSalary() { return monthlyGrossSalary; }
    public void setMonthlyGrossSalary(BigDecimal monthlyGrossSalary) { this.monthlyGrossSalary = monthlyGrossSalary; }
    public LoanApplication getLoanApplication() { return loanApplication; }
    public void setLoanApplication(LoanApplication loanApplication) { this.loanApplication = loanApplication; }
    public java.time.LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(java.time.LocalDateTime createdAt) { this.createdAt = createdAt; }
    public java.time.LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
