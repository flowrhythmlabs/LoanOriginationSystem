package com.finedge.los.config;

import com.finedge.los.service.KycProvider;
import com.finedge.los.service.LocalPanKycProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class KycProviderConfig {

    @Bean
    @Primary
    public KycProvider kycProvider() {
        return new LocalPanKycProvider();
    }
}
