# UAT integration status

Implemented: configurable HTTPS disbursal and loan-account POST adapter; operations form; persistent request ID/status; refusal to retry uncertain or completed transfers; loan number capture when response follows the provisional contract below.

## Prerequisites
1. Execute `backend/UAT_DISBURSAL_MIGRATION.sql` against the intended PostgreSQL database.
2. Set `DISBURSAL_API_URL`, `DISBURSAL_API_KEY`, `LOAN_ACCOUNT_API_URL`, `LOAN_ACCOUNT_API_KEY` in the deployment environment. Both URLs must use HTTPS. Empty URLs disable processing.
3. The provisional disbursal endpoint must accept JSON `{applicationId,requestId,amount,beneficiaryAccount,beneficiaryIfsc,reference}` and return `{status:"SUCCESS",reference:"..."}` or `{status:"FAILED",reference:"..."}`.
4. The provisional loan-account endpoint must accept `{applicationId,requestId,disbursalReference}` and return `{status:"SUCCESS",loanNumber:"..."}`.
5. Provider must enforce idempotency using `requestId` / `Idempotency-Key`. On UNKNOWN, reconcile with provider before any retry. No automated retries.

## Not completed / blockers
- This is a provisional API contract, not validated against an actual bank/provider.
- Consent UI still needs explicit recording in `los_consent_record` via applicant-authenticated consent API; no consent has been fabricated or bypassed.
- Legacy demo flows remain elsewhere in the project and must be retired before production/UAT release.
- No end-to-end provider, Spring Boot compile, or frontend build was performed in this environment (Maven and installed node_modules unavailable).
- Loan-account recovery after timeout is manual; status refresh currently reads locally stored state, not provider reconciliation.
- Do not use this build for real fund transfers until security, provider contract, and integration testing are completed.
