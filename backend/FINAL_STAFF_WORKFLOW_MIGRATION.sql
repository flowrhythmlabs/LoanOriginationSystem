-- Apply after your existing product_configuration and ADMIN_PORTAL_SCHEMA.sql.
-- This is additive; back up your database first.
BEGIN;
ALTER TABLE product_configuration ADD COLUMN IF NOT EXISTS configuration_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_configuration ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ;
ALTER TABLE product_configuration ADD COLUMN IF NOT EXISTS processing_fee_percent NUMERIC(6,3) NOT NULL DEFAULT 2.000;
ALTER TABLE product_configuration ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(6,3) NOT NULL DEFAULT 18.000;
ALTER TABLE product_configuration ADD COLUMN IF NOT EXISTS required_documents TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_staff_change_request_status ON staff_change_request(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_audit_event_recent ON staff_audit_event(created_at DESC,id DESC);
COMMIT;
