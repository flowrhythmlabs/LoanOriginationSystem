package com.finedge.los.service;

import com.finedge.los.dto.KycRequest;
import com.finedge.los.entity.KycVerification;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
public interface KycProvider {
    KycVerification submitKyc(KycRequest request);
    default Map<String, String> fetchIdentityDetails(String documentType, String number, MultipartFile file) {
        throw new UnsupportedOperationException("Live Aadhaar/PAN identity extraction is not configured");
    }
}
