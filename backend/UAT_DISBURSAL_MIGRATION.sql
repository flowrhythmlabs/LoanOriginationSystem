-- Run in PostgreSQL before enabling external disbursal integration.
CREATE TABLE IF NOT EXISTS los_external_disbursal (
 application_id BIGINT PRIMARY KEY REFERENCES loan_applications(id),
 request_id VARCHAR(64) NOT NULL UNIQUE,
 status VARCHAR(40) NOT NULL,
 loan_number VARCHAR(100),
 provider_status VARCHAR(100),
 provider_reference VARCHAR(200),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
