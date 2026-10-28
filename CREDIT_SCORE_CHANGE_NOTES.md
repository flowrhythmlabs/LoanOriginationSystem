# Targeted credit score and staff UI changes (not UAT certified)

- Manual credit scores now persist in `credit_checks` on application submission as `score_source=MANUAL`, `bureau=SELF_REPORTED`, `status=UNVERIFIED`.
- Online bureau check results now persist as `score_source=BUREAU_API`.
- Credit Manager consent requirement is conditional on BUREAU_API, with expiry validation. Existing approval policy gates remain intact; this does not authorize automatic approval of self-reported scores.
- Guarantor fields with `required` inputs show red asterisks; read-only status excluded.
- Recent Applications form has an Open Pending Reviews & Validation action that displays the existing underwriting workspace; the header Recent Applications shortcut was removed.
- Run backend/UAT_CREDIT_SCORE_MIGRATION.sql before startup. Existing manual submissions need resubmission/re-saving through the corrected application flow; do not fabricate historical score records.
- Outstanding: online consent capture from the applicant screen still requires integration; this draft does not fix it. The online provider is still mock-named. No live-provider verification was performed.
- Validation: Maven executable not available; frontend node_modules absent. No successful build or end-to-end test performed.
