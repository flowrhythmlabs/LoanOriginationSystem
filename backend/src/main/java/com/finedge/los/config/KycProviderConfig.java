package com.finedge.los.config;

import com.finedge.los.service.KycProvider;
import com.finedge.los.service.MockSignzyKycProvider;
import com.finedge.los.service.SignzyKycProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class KycProviderConfig {

    @Value("${kyc.provider:mock-signzy}")
    private String providerType;

    @Bean
    @Primary
    public KycProvider kycProvider(MockSignzyKycProvider mockSignzyKycProvider, SignzyKycProvider signzyKycProvider) {
        if ("signzy".equalsIgnoreCase(providerType)) {
            return signzyKycProvider;
        }
        return mockSignzyKycProvider;
    }
}
