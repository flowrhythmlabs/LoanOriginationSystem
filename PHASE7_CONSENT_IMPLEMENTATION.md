# Phase 7 — consent ledger integration (incremental)

## Added
- Applicant-authenticated `POST /api/applications/{applicationId}/consents` to record explicit grant **or refusal**, with purpose, approved text version and SHA-256 hash.
- `GET /api/applications/{applicationId}/consents/{purpose}/status` returns current consent state.
- Server checks applicant role and that the authenticated mobile owns the application. Other applicants receive 404.
- Consent is written to PostgreSQL `los_consent_record` from `WORKFLOW_PHASE6_SCHEMA.sql`. No in-memory fallback or hardcoded consent.

Example POST JSON: `{"purpose":"BUREAU_HARD","consentVersion":"v1","consentTextHash":"<64-character SHA-256 hex>","granted":true}`.

## Setup
Run `backend/WORKFLOW_PHASE6_SCHEMA.sql` against your existing PostgreSQL database before using these endpoints. Use an applicant Bearer token. Confirm your auth sessions use `ROLE_APPLICANT` as expected; this integration intentionally fails closed otherwise.

## Not done
- UI checkbox wiring, text-version registry and evidence/IP/device capture; applicant must see and affirm actual consent text before invoking this endpoint.
- Provider calls, fallback, identity matching, secure report storage, bank verification, rate maker-checker, KFS, e-sign, mandates, disbursal and LMS.
- No complete Maven/React build or PostgreSQL integration run; only source review and archive integrity check. Do not use this package for real customers.

## Security caution
The existing project contains demo authentication and unfinished role checks. This new endpoint does not make the overall system production-secure.
