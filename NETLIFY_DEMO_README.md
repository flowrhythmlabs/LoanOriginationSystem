# FineEdge LOS — Netlify browser-only demo

This is a **simulated demonstration**, not a production loan origination service. The Java backend is not deployed or needed.

## Deploy

1. Push the contents of the `LoanOriginationSystem` folder to a Git repository, keeping `netlify.toml` at repository root.
2. Import the repository in Netlify. Netlify should read `base = "frontend"`, `command = "npm run build"`, `publish = "dist"`.
3. Deploy through the Git-connected Netlify build so both the frontend and `frontend/netlify/functions` are deployed. Uploading only `frontend/dist` does not deploy the OTP functions required for applicant login.
4. The SPA redirect in `netlify.toml` avoids 404s on page refresh.

## Demo access

- Applicant: configure `TWOFACTOR_API_KEY` and `OTP_CHALLENGE_SECRET` as server-side Netlify environment variables (see `frontend/.env.example`). Enter an Indian mobile number beginning with 6–9 that you control, accept consent, click Continue, and enter the six-digit OTP delivered by SMS through 2Factor. There is no fixed demo OTP.
- Staff: choose Staff login; username **demo.admin**, password **Demo@123**. These credentials are **public demo credentials**, not security controls.
- KYC, bureau results, credit score and interest rates are simulated.
- Drafts, application data and uploaded document metadata are stored in the current browser's localStorage. Document binary data is NOT stored; document previews are unavailable after upload. A different browser/device will not see the same data.
- PDF summary is generated entirely in the browser.
- Clear browser site data to reset the demo.

**Never enter actual PAN, Aadhaar, customer documents, passwords, or real financial details into this demonstration.** Do not use this version for real lending decisions. For real use, deploy secure backend authentication, databases, file storage, consent management, access controls and compliant third-party integrations.
