# Phase 3: staff security and policy maker-checker foundation

Implemented:
- Staff password stage (`POST /api/staff/auth/password`) verifies BCrypt hashes in PostgreSQL, five-attempt/15-minute lockout.
- MFA stage (`POST /api/staff/auth/mfa`) validates TOTP, with short-lived challenge and attempt limit.
- Role-scoped policy change submission and independent checker review. Approved change requests are NOT automatically published to product tables.
- Old single-credential `/api/auth/login/admin` is disabled to prevent bypassing MFA.

**Setup:** Run `backend/ADMIN_PORTAL_SCHEMA.sql`. Provision staff records with BCrypt hashes and TOTP secrets using secure out-of-band tooling; no default accounts/passwords. The current `totp_secret_encrypted` column is read as a BASE32 TOTP secret by this phase, **not encrypted**. Before production, add encryption-at-rest via KMS, replay protection, persistent MFA challenges, audit logging, per-user multi-role authorization, distributed session storage, CORS/CSRF hardening, and integration tests.

**Not yet implemented:** frontend MFA screen, full role queues, application workspace, approval amount limits, bulk assignment, bureau/KYC UI, assisted journeys, final product configuration publishing, and complete cross-screen loan calculation reconciliation. Existing staff login UI still calls the retired endpoint and must be updated next.

Run Spring Boot with the PostgreSQL profile and valid DB settings. This ZIP is an incremental source update, not a production release.
