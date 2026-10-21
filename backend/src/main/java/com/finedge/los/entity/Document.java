package com.finedge.los.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "documents",
    uniqueConstraints = @UniqueConstraint(columnNames = {"loan_application_id", "document_type"})
)
public class Document {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private DocumentType documentType;

    @Column(nullable = false)
    private String documentName;

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false)
    private String filePath;

    @Column(nullable = false)
    private String contentType;

    @Column(nullable = false)
    private Long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentStatus status = DocumentStatus.NOT_UPLOADED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loan_application_id", nullable = false)
    @JsonIgnore
    private LoanApplication loanApplication;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column
    private LocalDateTime uploadedAt;

    @Column(length = 2000)
    private String verificationRemarks;
    private LocalDateTime verifiedAt;
    public Document() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = DocumentStatus.NOT_UPLOADED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum DocumentType {
        BANK_STATEMENT,
        LATEST_SALARY_SLIP,
        PREVIOUS_SALARY_SLIP,
        PAN_DOCUMENT,
        SALARY_SLIPS, EMPLOYMENT_PROOF, FORM_16, ITR, BUSINESS_PROOF, GST_DOCUMENT, QUALIFICATION_PROOF, PHOTOGRAPH, SIGNATURE, CANCELLED_CHEQUE, VOTER_ID, AADHAAR_DOCUMENT, ADDRESS_PROOF, EXISTING_LOAN_STATEMENTS, PROPERTY_DOCUMENTS, VEHICLE_DOCUMENTS, EDUCATION_DOCUMENTS, BUSINESS_FINANCIALS, COAPPLICANT_PAN, COAPPLICANT_KYC, COAPPLICANT_BANK_STATEMENT, COAPPLICANT_PHOTOGRAPH, COAPPLICANT_SIGNATURE, GUARANTOR_PAN, GUARANTOR_KYC, GUARANTOR_BANK_STATEMENT, GUARANTOR_PHOTOGRAPH, GUARANTOR_SIGNATURE
    }

    public enum DocumentStatus {
        NOT_UPLOADED,
        UPLOADING,
        UPLOADED,
        UPLOAD_FAILED,
        UNDER_REVIEW,
        VERIFIED,
        REJECTED,
        DEFICIENCY_RAISED
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }
    public String getDocumentName() { return documentName; }
    public void setDocumentName(String documentName) { this.documentName = documentName; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus status) { this.status = status; }
    public LoanApplication getLoanApplication() { return loanApplication; }
    public void setLoanApplication(LoanApplication loanApplication) { this.loanApplication = loanApplication; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public String getVerificationRemarks() { return verificationRemarks; }
    public void setVerificationRemarks(String verificationRemarks) { this.verificationRemarks = verificationRemarks; }
    public LocalDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(LocalDateTime verifiedAt) { this.verifiedAt = verifiedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
}
