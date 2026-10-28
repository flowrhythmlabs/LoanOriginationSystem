# FineEdge LOS — local bank simulator

**Not a real loan approval system.** All verification and fulfilment outcomes are local/simulated. No third-party account is required. A local PostgreSQL server, JDK 17+, Maven and Node.js/npm ARE required.

## Windows setup

1. Back up the existing `finedge` PostgreSQL database. Create it and a user if needed; configure `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` in your terminal or Windows environment.
2. Apply the project's existing schema/migrations in their documented order, including `backend/FINAL_STAFF_WORKFLOW_MIGRATION.sql`. For an existing installation, also run `backend/LOCAL_BANK_COMPATIBILITY_MIGRATION.sql` to permit `PROCESS_FORWARD` while preserving the other accepted actions. Do not re-run seed scripts blindly on a populated database.
3. Run `run-local-bank.cmd` from project root. This starts Spring Boot with profiles `demo,localbank`, enabling simulated approvals ONLY.
4. In a second terminal run `run-local-frontend.cmd`, then open the Vite URL shown.
5. Use the existing `DEMO_CREDENTIALS_AND_RUNBOOK.md` for demo staff users, and seed `los_approval_authority` for your test product and amount if the table is empty.

## Full local simulation

Applicant creates/submits → Processor records manual evidence and forwards → Underwriter recommends → Credit Manager checks delegated role authority, separate maker and checker, consent and latest PASS evidence → demo APPROVED → Manager drafts DEMO offer → Applicant accepts → Operations simulates e-sign, mandate, disbursement and LMS. Policy Admin proposes rate/fee/limit/checklist updates; authorized independent checker reviews and publishes supported fields. Compliance can view audit history.

## Safety boundaries

- Mock/manual KYC, bureau, income and fraud checks are not bank verification.
- `DEMO_DISBURSED` never transfers money. `DEMO_LMS_SYNCED` never creates a real LMS account.
- Do not use demo credentials, mock profiles, demo OTP or this database for real customer information.
- A genuine bank deployment still needs authorized provider integrations, approved rule versions, independent authorization, security testing and bank compliance sign-off.
- The existing eligibility-rules proposal workflow does not publish executable rule versions. This is intentionally blocked rather than silently activated.

## Verification

This package was prepared from the uploaded project. Full Spring Boot, database and browser end-to-end tests must be run locally; they have not been validated in this environment.
