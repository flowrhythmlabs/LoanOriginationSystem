package com.finedge.los;

import com.finedge.los.config.LosProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class LosPropertiesTest {
    @Test
    void bindsBrandingAndPublicUrlOverrides() {
        MapConfigurationPropertySource source = new MapConfigurationPropertySource(Map.of(
                "los.branding.institution-name", "Example Bank",
                "los.branding.short-name", "Example",
                "los.branding.tagline", "Banking for tomorrow.",
                "los.branding.application-name", "Example Loan Portal",
                "los.url.public-base-url", "https://los.examplebank.com"));

        LosProperties properties = new Binder(source)
                .bind("los", Bindable.of(LosProperties.class))
                .orElseThrow(() -> new IllegalStateException("LOS properties were not bound."));

        assertEquals("Example Bank", properties.getBranding().getInstitutionName());
        assertEquals("Example", properties.getBranding().getShortName());
        assertEquals("Banking for tomorrow.", properties.getBranding().getTagline());
        assertEquals("Example Loan Portal", properties.getBranding().getApplicationName());
        assertEquals("https://los.examplebank.com", properties.getUrl().getPublicBaseUrl());
    }
}
