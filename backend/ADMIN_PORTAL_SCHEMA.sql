-- Staff identity, audit, underwriting and maker-checker tables used by the /api/staff/** endpoints.
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS staff_account (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150),
    password_hash VARCHAR(100) NOT NULL,
    -- Base32 TOTP secret. Not encrypted at rest in this demo; encrypt before real deployment.
    totp_secret_encrypted TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_account_role (
    staff_id BIGINT NOT NULL REFERENCES staff_account(id) ON DELETE CASCADE,
    role_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (staff_id, role_code)
);

CREATE TABLE IF NOT EXISTS staff_audit_event (
    id BIGSERIAL PRIMARY KEY,
    staff_id BIGINT NOT NULL REFERENCES staff_account(id),
    application_id BIGINT,
    action VARCHAR(80) NOT NULL,
    reason_code VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS los_underwriting_action (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL,
    staff_id BIGINT NOT NULL REFERENCES staff_account(id),
    action VARCHAR(40) NOT NULL,
    reason_code VARCHAR(80) NOT NULL,
    notes TEXT,
    requested_amount NUMERIC(18,2),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS los_approval_authority (
    id BIGSERIAL PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL,
    loan_type VARCHAR(50) NOT NULL,
    maximum_amount NUMERIC(18,2) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (role_code, loan_type)
);

CREATE TABLE IF NOT EXISTS los_manual_verification (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL,
    check_type VARCHAR(50) NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    evidence_reference VARCHAR(250) NOT NULL,
    notes TEXT,
    reviewer_username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_change_request (
    id BIGSERIAL PRIMARY KEY,
    requested_by BIGINT NOT NULL REFERENCES staff_account(id),
    change_type VARCHAR(50) NOT NULL,
    proposed_value JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reason TEXT,
    reviewed_by BIGINT REFERENCES staff_account(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
