-- DEMO ONLY: Do not execute against production.
-- Run ADMIN_PORTAL_SCHEMA.sql first.
-- Creates/updates seven role-specific accounts, each with password: admin.
-- Unique TOTP secrets are provisioned in the database for authenticator apps.
BEGIN;
INSERT INTO staff_account (username,password_hash,enabled,locked_until,failed_login_attempts,totp_secret_encrypted) VALUES ('superadmin','$2y$10$ZAP0smpI40lDqD97IoN4N.YIFl/1FReKiR5n3q9qfi6knFu5TMrh6',TRUE,NULL,0,'3EDAQE2IKKEFDMDGEC3FSFRORZXOQJCY') ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, enabled=TRUE, locked_until=NULL, failed_login_attempts=0, totp_secret_encrypted=EXCLUDED.totp_secret_encrypted;
DELETE FROM staff_account_role WHERE staff_id=(SELECT id FROM staff_account WHERE username='superadmin');
INSERT INTO staff_account_role (staff_id,role_code) SELECT id,'SUPER_ADMIN' FROM staff_account WHERE username='superadmin';
INSERT INTO staff_account (username,password_hash,enabled,locked_until,failed_login_attempts,totp_secret_encrypted) VALUES ('policyadmin','$2y$10$ZAP0smpI40lDqD97IoN4N.YIFl/1FReKiR5n3q9qfi6knFu5TMrh6',TRUE,NULL,0,'DUWKEO4LIGEVWCWCBSQWYGCYRW34SXKG') ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, enabled=TRUE, locked_until=NULL, failed_login_attempts=0, totp_secret_encrypted=EXCLUDED.totp_secret_encrypted;
DELETE FROM staff_account_role WHERE staff_id=(SELECT id FROM staff_account WHERE username='policyadmin');
INSERT INTO staff_account_role (staff_id,role_code) SELECT id,'PRODUCT_POLICY_ADMIN' FROM staff_account WHERE username='policyadmin';
INSERT INTO staff_account (username,password_hash,enabled,locked_until,failed_login_attempts,totp_secret_encrypted) VALUES ('processor','$2y$10$ZAP0smpI40lDqD97IoN4N.YIFl/1FReKiR5n3q9qfi6knFu5TMrh6',TRUE,NULL,0,'ENBYZ5ZU73H53IYS6NAH765KZ5TXMHU4') ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, enabled=TRUE, locked_until=NULL, failed_login_attempts=0, totp_secret_encrypted=EXCLUDED.totp_secret_encrypted;
DELETE FROM staff_account_role WHERE staff_id=(SELECT id FROM staff_account WHERE username='processor');
INSERT INTO staff_account_role (staff_id,role_code) SELECT id,'APPLICATION_PROCESSOR' FROM staff_account WHERE username='processor';
INSERT INTO staff_account (username,password_hash,enabled,locked_until,failed_login_attempts,totp_secret_encrypted) VALUES ('underwriter','$2y$10$ZAP0smpI40lDqD97IoN4N.YIFl/1FReKiR5n3q9qfi6knFu5TMrh6',TRUE,NULL,0,'4G6VSBG5CWTFDQMDDHTPT2IT6FW4MYQZ') ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, enabled=TRUE, locked_until=NULL, failed_login_attempts=0, totp_secret_encrypted=EXCLUDED.totp_secret_encrypted;
DELETE FROM staff_account_role WHERE staff_id=(SELECT id FROM staff_account WHERE username='underwriter');
INSERT INTO staff_account_role (staff_id,role_code) SELECT id,'CREDIT_UNDERWRITER' FROM staff_account WHERE username='underwriter';
INSERT INTO staff_account (username,password_hash,enabled,locked_until,failed_login_attempts,totp_secret_encrypted) VALUES ('creditmanager','$2y$10$ZAP0smpI40lDqD97IoN4N.YIFl/1FReKiR5n3q9qfi6knFu5TMrh6',TRUE,NULL,0,'KLYD3L5BJPNUUV3DWVGPS4GHLPULIML6') ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, enabled=TRUE, locked_until=NULL, failed_login_attempts=0, totp_secret_encrypted=EXCLUDED.totp_secret_encrypted;
DELETE FROM staff_account_role WHERE staff_id=(SELECT id FROM staff_account WHERE username='creditmanager');
INSERT INTO staff_account_role (staff_id,role_code) SELECT id,'CREDIT_MANAGER' FROM staff_account WHERE username='creditmanager';
INSERT INTO staff_account (username,password_hash,enabled,locked_until,failed_login_attempts,totp_secret_encrypted) VALUES ('operations','$2y$10$ZAP0smpI40lDqD97IoN4N.YIFl/1FReKiR5n3q9qfi6knFu5TMrh6',TRUE,NULL,0,'W6PN6XRJWU5ZXVZ4JIEJNPJVPTFA2CQO') ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, enabled=TRUE, locked_until=NULL, failed_login_attempts=0, totp_secret_encrypted=EXCLUDED.totp_secret_encrypted;
DELETE FROM staff_account_role WHERE staff_id=(SELECT id FROM staff_account WHERE username='operations');
INSERT INTO staff_account_role (staff_id,role_code) SELECT id,'OPERATIONS' FROM staff_account WHERE username='operations';
INSERT INTO staff_account (username,password_hash,enabled,locked_until,failed_login_attempts,totp_secret_encrypted) VALUES ('auditor','$2y$10$ZAP0smpI40lDqD97IoN4N.YIFl/1FReKiR5n3q9qfi6knFu5TMrh6',TRUE,NULL,0,'WKHRHOCYNXH5LQOVEIAWSN7JWFI4XOXE') ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash, enabled=TRUE, locked_until=NULL, failed_login_attempts=0, totp_secret_encrypted=EXCLUDED.totp_secret_encrypted;
DELETE FROM staff_account_role WHERE staff_id=(SELECT id FROM staff_account WHERE username='auditor');
INSERT INTO staff_account_role (staff_id,role_code) SELECT id,'COMPLIANCE_AUDIT' FROM staff_account WHERE username='auditor';
COMMIT;
-- NOTE: Running this script again resets each demo account password and MFA enrollment.
