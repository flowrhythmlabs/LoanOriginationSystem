package com.finedge.los.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "applicant_consents")
public class ApplicantConsent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String mobileNumber;
    @Column(nullable = false) private String consentType;
    @Column(nullable = false) private String consentVersion;
    @Column(nullable = false) private LocalDateTime capturedAt;
    private String sourceIp;
    public ApplicantConsent() {}
    public ApplicantConsent(String mobileNumber, String consentType, String consentVersion, String sourceIp) {
        this.mobileNumber = mobileNumber; this.consentType = consentType; this.consentVersion = consentVersion; this.sourceIp = sourceIp; this.capturedAt = LocalDateTime.now();
    }
    public Long getId() { return id; }
    public String getMobileNumber() { return mobileNumber; }
    public String getConsentType() { return consentType; }
    public String getConsentVersion() { return consentVersion; }
    public LocalDateTime getCapturedAt() { return capturedAt; }
    public String getSourceIp() { return sourceIp; }
}
