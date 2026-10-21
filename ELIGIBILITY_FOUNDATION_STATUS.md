# Eligibility foundation update — incomplete overall requirements

This increment adds a **pure Java indicative eligibility calculator**, tests and a draft PostgreSQL policy/audit schema. It retains all Phase 4 consolidated code.

- Calculates available EMI headroom, reverse-EMI FOIR principal cap, FOIR after loan, DTI after loan, and the minimum of requested amount, product cap, applicant-type cap, bureau-band cap and optional collateral/LTV cap.
- Distinguishes indicative eligibility, a lower amount and below-product-minimum outcomes. Never approves or rejects an actual application.
- Adds JUnit examples for normal income, no headroom and secured LTV.
- Adds `backend/ELIGIBILITY_POLICY_FOUNDATION.sql` with versioned DRAFT policy definitions and assessment audit storage; it does **not** activate any policy or automatically store assessments.

## Still not implemented

End-to-end policy engine integration, verified inputs, persisted assessment audit service, score-based routing, UI, complete admin queues, maker-checker enforcement, KFS/APR, floating-rate resets, consent-gated provider adapters, e-sign, mandates, disbursal, LMS, and provider certification. Do not use this foundation to approve or reject a real applicant. The full Maven/Vite builds and database integration were not run in this environment.
