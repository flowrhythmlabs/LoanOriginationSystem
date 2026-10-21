# FineEdge LOS — Netlify browser-only demo

This is a **simulated demonstration**, not a production loan origination service. The Java backend is not deployed or needed.

## Deploy

1. Push the contents of the `LoanOriginationSystem` folder to a Git repository, keeping `netlify.toml` at repository root.
2. Import the repository in Netlify. Netlify should read `base = "frontend"`, `command = "npm run build"`, `publish = "dist"`.
3. Alternatively, run `cd frontend && npm ci && npm run build` and drag the `frontend/dist` folder into Netlify Deploys.
4. The SPA redirect in `netlify.toml` avoids 404s on page refresh.

## Demo access

- Applicant: any 10-digit mobile number, accept consent, click Continue, then enter **123456**. No SMS is sent.
- Staff: choose Staff login; username **demo.admin**, password **Demo@123**. These credentials are **public demo credentials**, not security controls.
- KYC, bureau results, credit score and interest rates are simulated.
- Drafts, application data and uploaded document metadata are stored in the current browser's localStorage. Document binary data is NOT stored; document previews are unavailable after upload. A different browser/device will not see the same data.
- PDF summary is generated entirely in the browser.
- Clear browser site data to reset the demo.

**Never enter actual PAN, Aadhaar, customer documents, passwords, or real financial details into this demonstration.** Do not use this version for real lending decisions. For real use, deploy secure backend authentication, databases, file storage, consent management, access controls and compliant third-party integrations.
