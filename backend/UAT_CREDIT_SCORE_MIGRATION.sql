-- Run after backup, before deploying the new backend.
ALTER TABLE credit_checks ADD COLUMN IF NOT EXISTS score_source varchar(24);
-- Existing bureau checks created by the old online-only persistence path:
UPDATE credit_checks SET score_source='BUREAU_API' WHERE score_source IS NULL;
ALTER TABLE credit_checks ALTER COLUMN score_source SET NOT NULL;
