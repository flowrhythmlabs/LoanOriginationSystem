package com.finedge.los.controller;

import com.finedge.los.config.LosProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicConfigurationController {
    private final LosProperties properties;

    public PublicConfigurationController(LosProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/api/public/config")
    public PublicConfigurationResponse getPublicConfiguration() {
        LosProperties.Branding branding = properties.getBranding();
        return new PublicConfigurationResponse(
                branding.getInstitutionName(),
                branding.getShortName(),
                branding.getTagline(),
                branding.getApplicationName(),
                properties.getUrl().getPublicBaseUrl());
    }

    public record PublicConfigurationResponse(
            String institutionName,
            String shortName,
            String tagline,
            String applicationName,
            String publicBaseUrl) {
    }
}
