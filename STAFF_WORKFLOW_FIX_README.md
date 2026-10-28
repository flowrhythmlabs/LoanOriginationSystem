# Staff workflow changes — based exclusively on uploaded LoanOriginationSystem(1).zip

## Implemented
- Processor queue shows applications without prior workflow action, or sent back by Credit Manager.
- Processor can forward a reviewed application using PROCESS_FORWARD (requires at least one recorded PASS manual verification).
- Underwriter queue shows forwarded applications, and can submit RECOMMEND_APPROVE or RECOMMEND_DECLINE.
- Credit Manager queue shows underwriter recommendations and can HOLD, SEND_BACK or DECLINE. APPROVE remains blocked by existing backend verification-policy safeguard.
- Operations queue shows APPROVED applications only. Since approval is currently blocked, this queue may remain empty. Underwriter recommendations do NOT count as approved loans.
- Super Admin / Compliance Audit can view all submitted and in-review applications.
- Review button loads full applicant, employment, loan, credit score, documents, verification evidence and decision history via new staff review endpoint.
- The existing Underwriting navigation label is changed to Pending Applications / Review.
- Existing applicant UI and manual-credit submission behavior are preserved.

## Required database tables
Existing ADMIN_PORTAL_SCHEMA.sql must have been applied (staff_account, los_underwriting_action, los_manual_verification etc.). No new schema required.

## API endpoints
GET /api/staff/underwriting/context
GET /api/staff/underwriting/queue?page=0&size=100
GET /api/staff/underwriting/{id}/review
GET /api/staff/underwriting/{id}/timeline
POST /api/staff/underwriting/{id}/decision with action PROCESS_FORWARD for processor.

## Known limitations
- This is not a full production approval workflow. Final approval is intentionally blocked by existing backend verification-policy checks.
- Operations won't receive cases until legitimate final approval is implemented.
- Manual evidence is not proof of external provider verification.
- Full Maven build unavailable (mvn missing). Frontend dependency install timed out; complete build and browser tests remain unverified.
- Review detail endpoint returns sensitive applicant information to authorized staff roles; production deployment requires granular field-level masking, audit of read access, and stronger case-assignment authorization.
- Super Admin role needs matching token authorities. Staff queue routing currently uses the latest underwriting action; add a dedicated assignment table and durable workflow states for production.
