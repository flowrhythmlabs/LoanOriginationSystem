# Local demo credentials and test sequence

**Never use these accounts or passwords outside an isolated local demo.**

Run `backend/DEMO_STAFF_SEED.sql` (after `backend/ADMIN_PORTAL_SCHEMA.sql`) to create the seven accounts. See `DEMO_STAFF_SETUP.md` for TOTP enrollment. Password is `admin` for every account; staff usernames: `superadmin`, `policyadmin`, `processor`, `underwriter`, `creditmanager`, `operations`, `auditor`.

There are **no valid third-party provider credentials** in this project. Provider keys in `PROVIDER_INTEGRATION_AGREEMENT_CHECKLIST.md` are illustrative placeholders only. Applicant login is OTP-based and depends on the configured local demo OTP setting or a real SMS provider; there is no universal applicant password.

**Important:** Prior demo exports include TOTP secrets in plaintext. Treat them as compromised, rotate/regenerate secrets before shared testing, and never commit them to a public repository.

## Demo workflow

1. Apply all existing schema scripts in documented order through Phase 10; then apply `backend/INTEGRATED_DEMO_FULFILMENT.sql`.
2. Set `SPRING_PROFILES_ACTIVE=demo,postgres` and `FINEDGE_DEMO_ENABLED=true` only in a local isolated database. Ensure all external integrations remain disabled.
3. Create an applicant and submitted application using the existing frontend and APIs; capture the application ID.
4. Log in as processor or underwriter, record **manual** evidence for seven verification types using `/api/staff/verification/{applicationId}`. These are test records, not actual KYC or credit verification.
5. As applicant, explicitly grant hard-bureau consent using the existing consent API. A demo grant is **not** authorization to perform an actual bureau pull.
6. Log in as creditmanager and POST `/api/fulfilment/{applicationId}/offer` with:

```json
{"sanctionedAmount":500000,"annualRate":10.5,"tenureMonths":36,"validDays":7,"agreementVersion":"DEMO-1","reasonCode":"TEST_OFFER"}
```

7. As the owning applicant, POST `/api/fulfilment/{applicationId}/accept`.
8. As operations, POST `/api/fulfilment/{applicationId}/simulate/esign`, then `/mandate`, `/disbursement`, `/lms`, each with:

```json
{"reasonCode":"TEST_SIMULATION","reference":"DEMO-REF-001"}
```

Every simulated status begins with `DEMO_`; no funds move and no legal contract is signed.

## Integration verification

The frontend build could not be completed in this environment because the npm cache lacks the required Vite package. The Maven CLI and a live PostgreSQL instance are also unavailable here. The new endpoints require full build, database migration and security regression testing before use.
