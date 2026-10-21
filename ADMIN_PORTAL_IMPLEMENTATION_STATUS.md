# FineEdge admin portal — implementation status

This is an **incremental source update**, not a completed secure admin portal.

## Included in this package
- Applicant and staff sign-in are separated by URL (`/` and `/staff/login`), with separate React entry component files. No applicant/admin mode toggle remains.
- Existing staff login still uses the current backend endpoint and show/hide password control.
- Admin list loan-type and status labels have been made more readable; a co-applicant column is included but currently shows an em dash because the list API does not expose that field.
- `backend/ADMIN_PORTAL_SCHEMA.sql` adds PostgreSQL staff, role, audit, and maker-checker *tables only* (no credentials or accounts are seeded).

## NOT YET IMPLEMENTED — must not be considered production-ready
- Database-backed staff authentication, password hashing and credential management, lockout, MFA enrollment and verification.
- Server-enforced per-role authorization, action limits, authority matrix, maker/checker service workflow, role-aware queues and dashboards.
- Expanded admin list API, accurate co-applicant and pending-document counts, pagination, sorting, saved filters, bulk assignment.
- Full application workspace with sticky decisions, mandatory reasons, document review, timeline and audit entries.
- Assisted origination with applicant consent and channel persistence.
- Full bureau adapter response mapping, KYC evidence/confidence/status UI, provider metadata and manual override controls.
- Config-driven immutable pricing, repayment schedule, Indian grouping input, slider and pricing disclosures.
- Visual alignment review across desktop/mobile, build, tests, browser verification and end-to-end PostgreSQL testing.

**Security warning:** The current backend still uses a generic `ADMIN` session role. The SQL role table does NOT protect routes or actions. Do not expose staff functions to real users until backend permission checks, MFA, rate limits, and auditing are implemented and tested.
