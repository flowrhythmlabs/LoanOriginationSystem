# Phase 9: Underwriting UI integration

Added an Underwriting navigation item and a React workspace connected to Phase 8 APIs. Includes paginated queue, case selection, decision history, reason-code validation, recommendation submission, API error display, and refresh.

## Safety and limitations
- Phase 8 backend deliberately blocks final APPROVE until KYC, bureau, income, fraud, and policy verification gates exist. This behavior is preserved.
- Frontend navigation does not replace server-side RBAC; backend @PreAuthorize remains required.
- Only authorized staff roles can use the API; role-aware hiding of action choices is not yet wired to a role-specific session claim.
- This is **not** a complete LOS: third-party integrations, KFS, e-sign, disbursal, LMS, and full end-to-end testing remain pending.
- npm installation timed out in the execution environment, so the frontend build has not been verified.

## Test
1. Apply the Phase 8 SQL migration and earlier migrations to a backed-up test PostgreSQL instance.
2. Start backend and frontend using existing README instructions.
3. Log in through /staff/login as a permitted staff role.
4. Open Underwriting, review a submitted case, submit an allowed recommendation with reason code, and verify the timeline.
5. Verify API 403 for unauthorized staff and 409 for unverified approval.
