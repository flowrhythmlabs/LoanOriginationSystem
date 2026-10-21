# LOS implementation update

The existing layout and color palette were preserved. No CSS/theme redesign was performed.

## Implemented in this update

- Replaced browser-side OTP/admin checks and identity headers with backend-issued opaque bearer tokens.
- Added short-lived server-generated development OTPs with expiry and a five-attempt limit. OTP delivery by SMS is not integrated.
- Added server-side session expiry and logout token revocation.
- Removed the identity-header authentication filter and fixed demo user service.
- Secured API routes behind authentication and kept admin-only route protection.
- Filtered the application list to the authenticated user's own mobile number; Admin can see the full list.
- Added the existing-style **My Applications** table for users so saved drafts can be reopened.
- Connected **Run Credit Check** to the application-specific endpoint so the simulated credit-check result is persisted.
- Save the latest form values before submission.
- Made the interest rate read-only in the UI and server-derived by loan type. Added an authenticated pricing endpoint so the UI can display the configured rate. Client-submitted rate values are ignored.
- Disabled the H2 console by default and removed the standalone score-by-PAN endpoint.
- Added the Vite `/api` proxy for local frontend/backend development.

## Development configuration

- `LOS_ADMIN_USERNAME` — default `admin` for local development only.
- `LOS_ADMIN_PASSWORD` — default `admin` for local development only.
- `LOS_DEMO_OTP_ENABLED` — defaults to `true` for local testing; set to `false` in production. With this set to false, user login will return an error until an SMS OTP provider is integrated.
- `LOS_SESSION_MINUTES` — bearer token lifetime; defaults to 60 minutes.
- `LOS_OTP_MINUTES` — OTP lifetime; defaults to 5 minutes.
- `H2_CONSOLE_ENABLED` — defaults to `false`.
- `LOAN_RATE_PERSONAL`, `LOAN_RATE_HOME`, `LOAN_RATE_CAR`, `LOAN_RATE_EDUCATION` — per-product rate values. They all default to 10.5% only as a prototype placeholder. Replace with Credit Policy-approved rates before real use.
- `LOAN_MAX_INTEREST_RATE` — maximum accepted configured rate; defaults to 30%.

## Still not production-ready

- OTP is generated for development and displayed in the UI; no SMS provider is connected.
- Credit score and KYC are still mock results; no real bureau or KYC decision should be inferred.
- Default admin credentials must be overridden before deployment. Add MFA, rate limiting, password management, and persistent user/session administration before production.
- The default per-product rates are placeholders, not approved loan pricing.
- Admin approval/rejection, application-summary download, and the remaining LOS roadmap items are not implemented in this phase.

## Validation

All backend main Java sources compile against the application dependency set bundled in the uploaded build. Runtime checks passed for OTP login, bearer-token enforcement, the product-pricing endpoint, and ignoring a forged client interest rate. The modified TypeScript files passed a syntax parse. Full frontend dependency/type-check and backend Maven test suite could not be run in this environment because frontend packages were not available locally and Maven is not installed. Run `npm ci && npm run build` in `frontend/` and `mvn test` in `backend/` after extracting the ZIP in your development environment.


## Change-request update (2026-10-14)
- Added persisted additional-detail maps to applicant, employment and loan details so expanded fields survive draft save/resume without destructive schema replacement.
- Added applicant dashboard with resume actions, temporary DRAFT IDs, and final Application Number assignment at submission.
- Added employment-specific document checklists, optional document labels, loan-specific property/vehicle/education documents, 5 MB upload limit, extension/MIME/signature checks, authenticated document viewing, replace/remove, and mobile photo capture.
- Added real-time client validation for PAN, email, name, mobile and PIN code, plus server-side name/designation patterns and actionable API validation messages.
- Added pricing fee fields, computed net disbursal, scheduled disbursal date validation, review/declaration step, duplicate active-draft/submitted-application checks, and system-triggered KYC then bureau flow after consent.
- Added a persisted terms/privacy consent record at OTP request and a demo-mode UI ribbon controlled by `VITE_DEMO_MODE=true`.
- UI layout and styling conventions are retained; expanded field groups are collapsible.
- Live SMS OTP delivery, contracted live bureau/KYC integrations, liveness checks, automated document-to-identity matching, document deficiencies workflow, actual upload-progress events, and provider-based IFSC lookup remain integration work.
- Draft handling now permits incomplete applicant/employment/loan data; new applications start without demo personal/employment/amount values. Final submission performs server-side validation.
- Added a startup schema migration for existing H2/PostgreSQL deployments so draft-only columns can accept null values. Back up the database before upgrading.


## Observation fixes (2026-10-14)
- KYC initiate/retry endpoints now return `KycResponse` DTOs rather than serializing Hibernate entities, preventing `ByteBuddyInterceptor` JSON conversion failures after successful verification.
- Applicant dashboard suppresses the empty-draft notice when no draft exists. Stepper navigation is locked to steps unlocked through Continue; document upload is required before the review step.
- Added field-level red validation messages for core identity/contact fields and co-applicant/guarantor PAN/email fields; alpha-only filters for person/name/relationship/nationality inputs; red required-field asterisks; IFSC lookup actions for applicant, co-applicant, and guarantor bank fields.
- Co-applicant fields are conditional on the applicant's Include a co-applicant checkbox. Purpose of loan now includes suggested choices plus a free-text remark. Bureau/KYC progress shows a spinner while verification is running.
- Submission no longer clears the login session on an individual API 401/403 response; an API error is shown in the form instead. Required documents are checked against the employment-specific checklist and persisted uploads are accepted for submission, with admin verification available as a follow-up review state.
- Validation performed here is source/syntax-level only. Install dependencies and run `npm ci && npm run build` from `frontend`, and `mvn test` from `backend`, before deploying.
