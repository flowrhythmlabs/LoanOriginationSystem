# Provider onboarding and agreement checklist

No external provider contract, bureau access or sandbox credential is supplied by this package. Demo credentials are for the LOS's local staff accounts only.

For **each** of bureau, PAN/KYC, account verification, Account Aggregator, e-sign, mandate, messaging, disbursement and LMS providers, obtain:

1. Provider legal entity and approved service description; contract, DPA and applicable regulatory terms.
2. Written sandbox/production access approvals, test credentials, permitted endpoints, IP allowlists and webhook signing method.
3. Data-processing purpose, consent wording/version, retention/deletion and incident-response obligations.
4. SLA, rate limits, error/retry/idempotency and reconciliation requirements.
5. Security and compliance review, secrets management and go-live signoff.

**Example nonfunctional test-only placeholders** (not valid provider credentials):

```
BUREAU_MODE=disabled
BUREAU_BASE_URL=https://sandbox.invalid.example
BUREAU_API_KEY=REPLACE_WITH_PROVIDER_ISSUED_SANDBOX_KEY
KYC_MODE=disabled
KYC_API_KEY=REPLACE_WITH_PROVIDER_ISSUED_SANDBOX_KEY
BANK_MODE=disabled
ESIGN_MODE=disabled
MANDATE_MODE=disabled
DISBURSEMENT_MODE=disabled
LMS_MODE=disabled
MESSAGING_MODE=disabled
FINEDGE_DEMO_ENABLED=true
```

Do not switch an integration mode to live until an actual provider-specific adapter, signed agreement, security checks, tests and approval are completed. Configuration fields alone do not implement live provider integration.
