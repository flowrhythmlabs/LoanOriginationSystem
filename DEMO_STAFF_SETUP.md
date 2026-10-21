# FineEdge LOS: seven demo staff accounts

**DEMO ENVIRONMENT ONLY.** These intentionally weak credentials and enrollment secrets must not be used for real customer data or production deployment.

## Setup (existing PostgreSQL database)

1. Run `backend/ADMIN_PORTAL_SCHEMA.sql` (if not already applied).
2. Run `backend/DEMO_STAFF_SEED.sql` on the same database configured in Spring Boot. Example: `psql -h localhost -U postgres -d finedge_los -f backend/DEMO_STAFF_SEED.sql`.
3. Open `backend/DEMO_STAFF_MFA_ENROLLMENT.csv` locally. For each account, add a **time-based** entry in Google Authenticator, Microsoft Authenticator or another TOTP app using the corresponding Base32 secret (or `otpauth_uri`). Never expose this file in a public repo or deploy it to the web.
4. Sign in at `/staff/login` with a username below and password `admin`, then enter the current six-digit code from that account's authenticator entry. Server clock and authenticator clock must be synchronized.

| Username | Role | Password |
|---|---|---|
| superadmin | Super Admin | admin |
| policyadmin | Product / Credit Policy Admin | admin |
| processor | Application Processor | admin |
| underwriter | Credit Underwriter | admin |
| creditmanager | Approver / Credit Manager | admin |
| operations | Operations | admin |
| auditor | Compliance / Audit | admin |

**Important:** Re-running the seed rotates all seven MFA secrets and invalidates their previous authenticator entries. Existing accounts with these usernames will have their password and roles overwritten. The current MFA implementation stores a Base32 secret in a column named `totp_secret_encrypted`; despite that name, the secret is **not encrypted**. Encrypt it before any real deployment. Role-specific backend authorization is still incomplete; seeding roles does not enforce permissions.

The demo accounts are database records; they are not automatically created until you execute the SQL against your PostgreSQL server.
