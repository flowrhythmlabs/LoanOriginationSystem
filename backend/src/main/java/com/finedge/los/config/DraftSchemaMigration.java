package com.finedge.los.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DraftSchemaMigration implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DraftSchemaMigration.class);
    private final JdbcTemplate jdbcTemplate;
    public DraftSchemaMigration(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }
    @Override public void run(ApplicationArguments args) {
        String product;
        try (var connection = jdbcTemplate.getDataSource().getConnection()) { product = connection.getMetaData().getDatabaseProductName(); }
        catch (Exception ex) { log.warn("Could not inspect database for draft migration: {}", ex.getMessage()); return; }
        if (product == null || !(product.toLowerCase().contains("h2") || product.toLowerCase().contains("postgres"))) return;
        String[] statements = {
            "ALTER TABLE applicants ALTER COLUMN full_name DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN date_of_birth DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN pan_number DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN email DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN work_email DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN residential_address DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN city DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN state DROP NOT NULL",
            "ALTER TABLE applicants ALTER COLUMN pincode DROP NOT NULL",
            "ALTER TABLE employment_details ALTER COLUMN employment_type DROP NOT NULL",
            "ALTER TABLE loan_details ALTER COLUMN loan_type DROP NOT NULL",
            "ALTER TABLE loan_details ALTER COLUMN requested_loan_amount DROP NOT NULL",
            "ALTER TABLE loan_details ALTER COLUMN preferred_tenure DROP NOT NULL",
            "ALTER TABLE loan_details ALTER COLUMN purpose_of_loan DROP NOT NULL"
        };
        for (String sql : statements) {
            try { jdbcTemplate.execute(sql); }
            catch (Exception ex) { log.debug("Draft schema migration skipped for statement '{}': {}", sql, ex.getMessage()); }
        }
    }
}
