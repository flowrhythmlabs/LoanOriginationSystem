# FineEdge LOS Phase 4 — Dashboard and pricing

## Implemented
- Staff landing shows Recent Applications before the application wizard; New Application in the header and recent applications section opens the wizard.
- Staff can open an existing application from the list.
- Fee percentage, GST percentage, insurance premium, rate type, and tenure limits are fetched from the PostgreSQL product configuration API.
- Processing fee, GST, total upfront charges and net disbursal are displayed read-only. Calculated amounts are included in the application payload.
- Amount multiples: ₹1,000 unsecured, ₹10,000 secured; product min/max validated in the UI.
- Nominal rate and reducing/fixed rate type are read-only.

## IMPORTANT limitations / remaining tasks
- The product configuration migration must be run before starting the updated backend: `backend/PRODUCT_PRICING_PHASE4.sql`.
- The example 2% processing fee and 18% GST are **illustrative**, not a lender-approved pricing policy. Edit product_configuration before live use.
- The backend must still independently recalculate and validate pricing on save/submit to prevent forged client values. Do not use this phase for binding offers.
- Full APR and Key Fact Statement, including accurate effective annual cost, date-based repayment schedules, insurance terms, fees and first EMI date, require a separate approved server-side calculator and acceptance workflow. This phase explicitly does NOT present the nominal rate as APR.
- Existing admin roles and permission checks are not complete; do not treat staff UI visibility as authorization.
- The UI build and database integration were not verified in this environment.
