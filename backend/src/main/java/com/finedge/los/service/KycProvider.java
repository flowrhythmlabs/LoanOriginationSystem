package com.finedge.los.service;

import com.finedge.los.dto.KycRequest;
import com.finedge.los.entity.KycVerification;

public interface KycProvider {
    KycVerification submitKyc(KycRequest request);
}
