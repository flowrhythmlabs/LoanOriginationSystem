# Final step: controlled DEMO approval and Operations routing

This update builds on the staff-workflow ZIP provided in the preceding turn. It does **not** implement live loan sanction or disbursement.

## What changed
- Credit Manager `APPROVE` now succeeds only when BOTH `finedge.demo.enabled=true` and the active Spring profile is `demo`.
- The product-specific `los_approval_authority` must be explicitly enabled and cover the requested amount.
- The latest underwriting action must be `RECOMMEND_APPROVE` from a different staff account.
- The latest manual evidence for KYC, BUREAU, INCOME, BANK_ACCOUNT, FRAUD, POLICY, DOCUMENTS must all be `PASS`.
- The latest `BUREAU_HARD` consent must be granted.
- A successful demo approval records `APPROVE` in the underwriting action history, an audit event, and sets application status `APPROVED`, so Operations can see it in their queue.
- A `DECLINE` remains a rejection, and neither recommendation nor manual review alone routes to Operations.

## Local demo configuration
Start Spring Boot with the `demo` profile and set `finedge.demo.enabled=true` **only on an isolated test database**. Default is false. Use the existing `los_approval_authority` policy table to explicitly enable demo authority for a loan product and limit. No authority limits are changed or seeded by this patch.

## Test sequence
1. Processor records manual review and forwards.
2. Underwriter submits `RECOMMEND_APPROVE`.
3. Record the seven required latest manual PASS outcomes and granted hard-bureau consent in the existing application workflow. Self-reported credit scores alone do not meet real bureau verification requirements.
4. Credit Manager logs in separately and selects `APPROVE` with reason code.
5. Operations logs in and sees the demo-approved application. Any downstream offer, e-sign, mandate, disbursement and LMS steps remain **simulated**.

## Safety and limitations
Manual PASS entries do not prove a genuine provider check. A status of `APPROVED` in demo mode is **not** a legally effective credit sanction. Never enable demo mode for real lending, real customers or live funds. This update does not add production-ready KFS, e-sign, disbursement or provider integrations. Existing data are not modified by this package; no new database migration is required if prior tables exist.
