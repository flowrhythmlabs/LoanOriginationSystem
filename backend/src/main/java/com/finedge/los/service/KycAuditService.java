package com.finedge.los.service;

import com.finedge.los.entity.KycVerification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class KycAuditService {
    private static final Logger log = LoggerFactory.getLogger(KycAuditService.class);

    public void audit(String event, Long applicationId, Long kycId, String provider, KycVerification.KycStatus status, String detail) {
        log.info("KYC_AUDIT event={} applicationId={} kycId={} provider={} status={} detail={}",
                event, applicationId, kycId, provider, status, detail);
    }
}
