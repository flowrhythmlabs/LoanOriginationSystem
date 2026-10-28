# Database-managed staff roles and demo workflow settings

Baseline: FineEdge_LOS_Processor_Preview_403_Corrected.zip.

## Changes
- `staff_role_catalog` defines enabled staff roles in PostgreSQL.
- `staff_account_role` remains the source of staff role assignments. Staff accounts and their active roles are checked against the database for each authenticated request.
- Super Admin role selector reads the active role catalog from the database.
- `staff_runtime_setting.DEMO_APPROVAL_ENABLED` is editable by Super Admin from System Administration, with audit reason.
- Backend still requires `finedge.demo.enabled=true` and an active `demo` or `localbank` Spring profile; the database cannot enable simulated approvals in a production deployment.
- Existing loan product and credit-manager authority tables remain database-managed.
- Secrets and live approval/disbursement safety controls are intentionally not editable from the database.

## Setup
1. Back up PostgreSQL.
2. Run `backend/STAFF_DB_CONFIGURATION_MIGRATION.sql` after existing staff tables have been created.
3. Start backend with demo/localbank profile and finedge.demo.enabled=true for local testing.
4. Super Admin > System Administration > System settings > set reason and toggle simulated approval.
5. Existing authority, maker-checker and verification checks still apply.

## Testing
ZIP integrity checked. Maven unavailable; Java compilation, frontend build, database execution and browser tests not performed.
