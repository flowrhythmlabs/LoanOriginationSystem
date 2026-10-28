# FineEdge LOS — staff portals and manual review update

Source: **only** the user-uploaded `LoanOriginationSystem(2).zip`.

## Implemented
- Reinstated manual review form in full case review, using the existing GET/POST `/api/staff/verification/{applicationId}` endpoints.
- Manual review captures check type, PASS/FAIL/PENDING, evidence reference, remarks; reloads history after saving.
- Backend-driven staff role lookup: GET `/api/staff/portal/context` (role claims from authenticated token, not username).
- SUPER_ADMIN defaults to Users & System Settings; list staff accounts, enable/disable eligible accounts, assign roles with reason and audit entry, and view nonsecret system security settings. Own account and super-admin disabling/demotion are blocked.
- PRODUCT_POLICY_ADMIN defaults to Products & Rate Cards; read product pricing and create maker proposals for rates, fees, limits, rules and document checklists; see proposal history.
- Other staff continue to use Recent Applications and role-specific case review. Assisted application button is shown to processors only.
- Existing underwriting decision and verification APIs continue enforcing backend role annotations.

## Database prerequisites
Existing `backend/ADMIN_PORTAL_SCHEMA.sql` defines staff_account, staff_account_role, staff_audit_event, staff_change_request and los_manual_verification. Existing product_configuration must include pricing/fee columns. No new schema tables introduced in this update.

## Known limits / NOT production-complete
- Policy change approval records a checker decision but does **not** publish a new product configuration: the existing backend explicitly requires a separate validated apply/publish step. Do not interpret an APPROVED change request as a live rate.
- System settings are displayed read-only; deployment/security settings cannot be changed through this page.
- No staff account creation or MFA enrolment/reset flow was added; existing staff can be managed.
- Full backend Maven, database and browser integration tests were not available. Frontend TSX files passed TypeScript syntax transpilation, but full build dependencies were unavailable.
- The ZIP omits uploaded `backend/data/documents` and other generated/private runtime data intentionally. Keep your existing data directory locally.

## API changes
- GET `/api/staff/portal/context`
- GET `/api/staff/administration/users`
- PATCH `/api/staff/administration/users/{id}` body: `{ "enabled": true, "roles": ["APPLICATION_PROCESSOR"], "reason": "Approved role change" }`
- GET `/api/staff/administration/settings`
- GET `/api/staff/policy/products`
- GET `/api/staff/policy/changes`
- Existing POST `/api/staff/policy/changes` accepts ELIGIBILITY_RULES proposals in addition to existing types.

## Recommended smoke tests
1. Super Admin login → Users & System Settings; verify role management and denial of self-edits.
2. Policy Admin login → Products & Rate Cards; submit proposal and verify PENDING request in DB.
3. Processor login → Recent Applications → Review → Record Manual Review → confirm ledger row and refreshed evidence.
4. Underwriter login → read case and submit recommendation; no product-admin or super-admin controls.
5. Operations / Audit login → verify they cannot record evidence or submit credit decisions.
