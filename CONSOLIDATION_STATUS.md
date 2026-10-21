# FineEdge LOS — consolidated requirements / verified implementation status

This package builds on Phase 4. It is NOT production-ready and does not implement all 543 lines of the new requirements.

## Changes in this package
- Fixed the staff-assisted wizard's missing Back / Save Draft / Continue navigation controls by rendering the existing sticky navigation for both USER and ADMIN sessions when the application wizard is open.
- Added `backend/CONSOLIDATED_POSTGRES_MIGRATION.sql`: repeatable additive migration for the missing `processing_fee_percent` and related pricing fields, plus foundational audit/consent/bureau tables. It does not overwrite existing approved rates.
- Enforced product minimum/maximum amount, tenure, and amount increment on the backend when saving loan details.
- Added `LoanQuoteCalculator` and `GET /api/pricing/{loanType}/quote?amount=500000&tenureMonths=36` to calculate EMI, total interest, processing fee, GST on fee, total charges, and net disbursal from database configuration. Indicative quote only; it is not a binding offer or compliant KFS/APR.
- Added a JUnit regression test for the illustrative ₹5 lakh, 2% fee, 18% GST example.

## Database setup
1. Back up your PostgreSQL database.
2. On a fresh database, run `backend/DATABASE_SEED.sql` first to create and populate six illustrative products.
3. Run `backend/CONSOLIDATED_POSTGRES_MIGRATION.sql` on fresh or existing databases. On existing databases, do not re-run seeds over approved live pricing.
4. Inspect product pricing with `SELECT product_code, annual_rate, processing_fee_percent, gst_percent, minimum_tenure_months, maximum_tenure_months FROM product_configuration;`.
5. The Phase 4 `PRODUCT_PRICING_PHASE4.sql` should not also be run after this consolidated migration because it contains unconditional named CHECK constraints that can fail on repeat execution.

## Critical outstanding work (NOT complete)
- Production role-based staff permissions, MFA enrollment/security, approval authority and maker-checker publishing.
- Full KFS with APR, repayment calendar, amortization rounding reconciliation, first EMI date, floating benchmark resets and regulatory disclosures.
- Three-stage eligibility and policy engine (FOIR/DTI/LTV, score caps, routing, reason codes).
- Consent enforcement, encrypted bureau reports, live bureau adapters and fallback; KYC, bank account, AA, AML and GST/ITR integrations.
- Dynamic product checklists, assisted-channel consent, comprehensive audit, documents and customer notifications.
- Offer, e-sign, mandates, disbursal and LMS integration.
- Frontend quote endpoint integration and complete UI alignment review.
- Full Maven, Vite, PostgreSQL and browser integration tests.

Do not use demo staff credentials or illustrative product rules in production. Live bureau and bank operations require onboarding and regulatory approval.
