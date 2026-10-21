# Phase 8 — Staff underwriting foundation

## Included
- Backend staff underwriting queue (paginated, non-draft cases), role-restricted timeline, recommendation and decision endpoints.
- Database audit entries for every accepted action; reason codes mandatory.
- Role restrictions: underwriters recommend; credit managers can hold, send back, decline; compliance reads only.
- Approval authority stored by product in PostgreSQL and disabled by default. Approval deliberately blocked until KYC, consent, bureau, verified income, fraud, policy and maker-checker gates are fully enforced.
- No frontend underwriting workspace or end-to-end validation yet.

## Setup
Run `backend/UNDERWRITING_PHASE8.sql` after `ADMIN_PORTAL_SCHEMA.sql` and the existing application tables.

## APIs
`GET /api/staff/underwriting/queue?page=0&size=20`
`GET /api/staff/underwriting/{id}/timeline`
`POST /api/staff/underwriting/{id}/decision` JSON: `{"action":"RECOMMEND_APPROVE","reasonCode":"INCOME_VERIFIED","notes":"Review complete"}`.

## Limitations
No live approval, sanction, e-sign, disbursal or LMS functionality. All security and calculations require full integration testing. Product/credit policy must authorize approval limits before enabling them. Legacy endpoints must be reviewed separately for authorization bypasses. Demo-only accounts must not be deployed in production.
