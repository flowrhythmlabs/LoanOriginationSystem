package com.finedge.los.entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "credit_checks")
public class CreditCheck {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer creditScore;

    @Column(nullable = false)
    private String bureau = "MANUAL";

    @Column(nullable = false)
    private String status = "SUCCESS";

    @Column(nullable = true)
    private String remarks;

    @OneToOne(mappedBy = "creditCheck")
    @JsonIgnore
    private LoanApplication loanApplication;

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

    public CreditCheck() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getCreditScore() { return creditScore; }
    public void setCreditScore(Integer creditScore) { this.creditScore = creditScore; }
    public String getBureau() { return bureau; }
    public void setBureau(String bureau) { this.bureau = bureau; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public LoanApplication getLoanApplication() { return loanApplication; }
    public void setLoanApplication(LoanApplication loanApplication) { this.loanApplication = loanApplication; }
    public java.time.LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(java.time.LocalDateTime createdAt) { this.createdAt = createdAt; }
    public java.time.LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
