package com.finedge.los.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.Arrays;

/** DB business settings; environment always controls the maximum simulation privilege. */
@Service
public class StaffRuntimeSettings {
    private final JdbcTemplate db;
    private final boolean environmentAllowsDemo;
    public StaffRuntimeSettings(JdbcTemplate db, Environment env,
            @Value("${finedge.demo.enabled:false}") boolean demoEnabled) {
        this.db=db;
        this.environmentAllowsDemo=demoEnabled && Arrays.stream(env.getActiveProfiles())
            .anyMatch(p -> p.equals("demo") || p.equals("localbank"));
    }
    public boolean demoApprovalEnabled() {
        if(!environmentAllowsDemo)return false;
        try {
            return Boolean.TRUE.equals(db.query("SELECT setting_value FROM staff_runtime_setting WHERE setting_key='DEMO_APPROVAL_ENABLED'",
                rs -> rs.next() && Boolean.parseBoolean(rs.getString(1))));
        } catch(org.springframework.dao.DataAccessException ex) {
            return false; // fail closed when migrations are missing
        }
    }
    public boolean environmentAllowsDemo() { return environmentAllowsDemo; }
}
