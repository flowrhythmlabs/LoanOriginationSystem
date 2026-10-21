# FineEdge loan-pricing increment (not full admin portal completion)

Implemented in this increment:
- PostgreSQL product pricing endpoint now returns the configured interest rate and minimum/maximum amount for the selected product.
- Loan amount entry uses Indian grouping, with presets and a range slider when database limits are available.
- Tenure selection displays month/year equivalents. EMI uses the same `preferredTenure` state as the loan form.
- Interest rate is read-only and initially blank until retrieved from the backend.
- EMI area includes principal/interest breakdown, fee summary and an illustrative month-by-month amortisation table.

Important limitations:
- Backend validation of configured minimum/maximum amounts is not yet implemented. Do not rely on frontend range controls for enforcement.
- Rate exceptions, maker-checker, role-specific secure staff access, MFA, workflow queues, and assisted origination are NOT implemented in this increment.
- The repayment schedule is illustrative, with rounding differences possible. It is not a sanction letter or contractual amortisation schedule.
- No complete Maven or React build was verified. Dependency installation is unavailable in this environment.
- SMS/bureau integration remains provider-dependent.
