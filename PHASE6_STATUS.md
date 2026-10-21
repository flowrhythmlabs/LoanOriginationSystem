# Phase 6 — disclosure and workflow data foundation

## Implemented
- `IndicativeDisclosureCalculator`: full monthly principal/interest schedule, upfront fee breakdown, estimated effective APR and total indicative credit cost. Pure Java, no provider credentials.
- `WORKFLOW_PHASE6_SCHEMA.sql`: additive consent, bureau-pull and decision-event tables with basic database constraints.

## Not implemented / not production ready
- The disclosure calculator is NOT a compliant Key Fact Statement; it is not wired to the UI or a secured backend endpoint. APR needs validation against actual cash-flow dates and RBI requirements.
- Workflow tables are NOT wired to consent screens, API authentication, staff roles or decision APIs. Schema is a foundation only.
- No live bureau, PAN, Aadhaar, SMS, bank, e-sign, mandate, disbursal or LMS integration is claimed.
- Maker-checker, authority checks, full staff workspace, immutable audit and product versioning still need implementation.
- No end-to-end tests, PostgreSQL migration execution, or full React/Spring Boot builds are claimed.

## Next integration priorities
1. Connect consent capture to authenticated applicant identity and prevent bureau calls without valid purpose-specific consent.
2. Implement versioned policy/rate-card persistence and enforce permissions on every mutation.
3. Integrate calculations through server-owned quote/eligibility APIs; reconcile screen values.
4. Complete role queues and decision workflow with maker-checker, audit and authority limits.
5. Integrate real providers only with their specifications, credentials and certification environments.
