-- Run on the local demo database after the existing staff schema; back up first.
BEGIN;
CREATE TABLE IF NOT EXISTS staff_role_catalog (
 role_code varchar(64) PRIMARY KEY, description varchar(250), enabled boolean NOT NULL DEFAULT true
);
INSERT INTO staff_role_catalog(role_code,description) VALUES
 ('SUPER_ADMIN','Manage users and configuration'),('PRODUCT_POLICY_ADMIN','Propose product policy changes'),
 ('APPLICATION_PROCESSOR','Review and forward applications'),('CREDIT_UNDERWRITER','Recommend credit decisions'),
 ('CREDIT_MANAGER','Approve within authority'),('OPERATIONS','Post-sanction operations'),
 ('COMPLIANCE_AUDIT','Read-only audit')
ON CONFLICT(role_code) DO NOTHING;
CREATE TABLE IF NOT EXISTS staff_runtime_setting (
 setting_key varchar(100) PRIMARY KEY, setting_value varchar(100) NOT NULL,
 description varchar(500) NOT NULL, updated_by bigint NULL REFERENCES staff_account(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO staff_runtime_setting(setting_key,setting_value,description)
VALUES ('DEMO_APPROVAL_ENABLED','true','Enable simulated credit approval only when deployment also permits local demo')
ON CONFLICT(setting_key) DO NOTHING;
COMMIT;
