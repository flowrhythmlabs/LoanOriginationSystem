package com.finedge.los;

import com.finedge.los.security.DemoTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import static org.junit.jupiter.api.Assertions.*;

class DemoTokenServiceTest {
    @Test
    void issuesAndRevokesOpaqueToken() {
        DemoTokenService service = new DemoTokenService();

        String token = service.issue("9876543210", "USER");

        assertNotNull(token);
        assertNotEquals("9876543210", token);
        Authentication authentication = service.authenticate(token);
        assertNotNull(authentication);
        assertEquals("9876543210", authentication.getName());
        assertTrue(authentication.getAuthorities().stream().anyMatch(a -> "ROLE_USER".equals(a.getAuthority())));

        service.revoke(token);

        assertNull(service.authenticate(token));
    }
}