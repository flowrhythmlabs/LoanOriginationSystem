# Security Audit Summary

This document records the practical hardening completed for LoanOriginationSystem using the existing application stack. No Maven or npm dependencies were added. No application can be guaranteed to be completely vulnerability-free.

## Architecture

The API is stateless from the HTTP session perspective and uses short-lived, server-generated bearer tokens held in an in-memory token store. Spring Security authenticates the token and assigns `USER` or `ADMIN`. Application services then apply ownership checks for user operations. Documents remain on the configured backend filesystem, outside the frontend directory, while PostgreSQL stores metadata.

## Findings and Actions

| Severity | Finding and location | Risk | Fix | Test/evidence |
| --- | --- | --- | --- | --- |
| HIGH | Caller-controlled `X-Role`, `X-Mobile`, and `X-Username` in the former demo identity filter | An attacker could impersonate a user or admin and access applications | Added server-issued bearer tokens, token expiry, revocation, and fail-closed protected routes | Backend tests and frontend production build pass; direct caller headers are ignored |
| HIGH | Wildcard CORS on API controllers | Untrusted origins could call the API from a browser | Removed controller wildcards and allow only local Vite origins with explicit headers/methods | Security configuration compiles and frontend build passes |
| HIGH | Application/document access depended on caller-selected identity | ID changes could expose another user's data | Protected API routes and existing service ownership checks now operate against the authenticated token principal | Existing application service and persistence tests pass |
| MEDIUM | Upload validation relied mainly on MIME type and retained user filename text in storage keys | Spoofed extensions and filesystem/path metadata exposure | Require allowed MIME/extension pairs, enforce size limits, generate opaque UUID storage keys, and normalize storage resolution | Existing document upload, replacement, and retrieval tests pass |
| MEDIUM | Unbounded user text and search values | Excessive input could create validation, query, or storage pressure | Added DTO size/range constraints and a 100-character admin search limit | Backend test suite passes |
| MEDIUM | Security rejection responses could use default framework output | Clients could receive inconsistent or overly detailed errors | Added safe JSON 401/403 handlers and retained safe global error responses | Backend compilation and tests pass |
| LOW | Routine debug logs included original document names and storage keys | Logs could reveal sensitive metadata | Redacted names/keys and reduced runtime application logging to INFO | Source scan reviewed logging call sites |
| INFO | Credentials and database configuration were present as demo/config defaults | Demo values are unsafe for production | Retained compatibility, moved runtime database password to environment configuration, and documented the limitation | README and user manual updated |

## Implemented Controls

- Backend authentication with expiring, revocable bearer tokens.
- Backend role authorization for `USER` and `ADMIN`.
- Application ownership checks before user reads or writes.
- Protected document list, upload, replacement, download, and delete operations.
- Parameterized Spring Data JPA search queries.
- Bean Validation and service validation for mobile, PAN, email, text lengths, salary, amount, interest, and tenure.
- File size limits, allowed MIME types, extension agreement, generated names, and normalized path resolution.
- Restricted CORS, stateless CSRF decision, safe 401/403 responses, and security headers.
- Environment-based database and document-storage configuration.
- Reduced sensitive logging and Git exclusions for environment files, generated output, uploads, and local data.

## Known Limitations and Production Recommendations

- The fixed OTP `123456` and admin `admin` / `admin` credentials are demo-only.
- Tokens are stored in memory, so they are lost on restart and cannot support a multi-instance deployment without a shared session or identity service.
- There is no distributed rate limiting, robust OTP resend/attempt control, malware scanning, encryption at rest, or production HTTPS infrastructure.
- Local filesystem document storage needs protected operating-system permissions, backup controls, and a reviewed production storage design.
- Production deployment should use a dedicated least-privilege PostgreSQL account, a managed secret store, HTTPS, security monitoring, dependency updates, and a production identity provider.
- CSRF is disabled because the API uses bearer tokens rather than cookies. If authentication changes to cookies, CSRF protection must be enabled and tested.
- MIME checks are application-level checks, not malware or content-signature scanning.

These limitations are intentionally documented rather than hidden because the requested no-new-third-party-dependencies constraint prevents adding production-grade controls that require new infrastructure or libraries.
