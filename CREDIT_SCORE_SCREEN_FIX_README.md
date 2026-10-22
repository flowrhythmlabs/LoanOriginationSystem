# Credit score screen update

- Credit consent checkbox and its text display in one horizontal row.
- Consent checkbox is controlled and shows feedback when selected or deselected.
- The screen displays `DRAFT-{applicationId}` and attempts to create a draft when the credit step opens.
- Select **Enter Manually** for an indicative self-reported score (300–900) and classification: Excellent >=750, Good >=700, Fair >=650, Poor <650.
- Manual and fetched score classifications use matching bordered badges: emerald for Excellent, green for Good, amber for Fair, and rose for Poor. The self-reported disclaimer stays beside the badge or wraps below it on narrow screens.
- Select **Check Online** to enable the explicit **Fetch Credit Score from Bureau** button after consent. Checkbox selection alone never invokes the bureau API.
- Manual scores are stored in applicant `additionalDetails.selfReportedCreditScore` (and mode in `creditScoreMode`) via the existing draft payload, not in the bureau verification record. A manual score is not bureau verified and must not be used to auto-approve a loan.
- Existing `/api/applications/{id}/credit-check` integration remains; its provider behavior depends on backend configuration.

## Validation
Static source checks completed. Full React build could not be run because frontend dependencies (`react` and types) are not installed in this runtime. Test with `npm install && npm run build` and check the browser journey.
