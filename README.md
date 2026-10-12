# Bluewaves Distributors Private Limited | BDPL Corporate Website

This project contains a responsive, enterprise-style corporate website for Bluewaves Distributors Private Limited (BDPL). It was built as a static React + Vite frontend and is aligned to the supplied business-content guidance for a public B2B website.

## Overview

The site presents BDPL as a technology-enabled retail commerce and distribution business focused on:

- telecom distribution and recharge services
- retailer and distributor enablement
- digital financial services distribution
- bill payments and consumer connectivity
- merchant services
- advertising and brand-related services

The implementation intentionally excludes future growth plans, future strategic proposals, investment asks, roadmap language, and Moneytray-related metrics or references.

## Technology Stack

- Frontend: React 18 + TypeScript + Vite
- Styling: custom responsive CSS, no heavy UI framework
- Deployment target: Netlify static site
- Contact form: Netlify Forms with a standard HTML form

## Project Structure

```text
frontend/
  src/App.tsx         Corporate website and Netlify-ready contact form
  src/styles.css      Full responsive styling for the site
  index.html          Page metadata and SEO tags
  public/
    404.html          Custom fallback page for direct URL loads
    privacy-policy.html  Privacy policy draft
    favicon.svg        BDPL wordmark favicon
    robots.txt         Search engine crawler guidance
    sitemap.xml       Placeholder sitemap for production domain
```

## Local Development

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

The site will be available on the Vite local URL, typically http://localhost:5173.

## Production Build

```bash
cd frontend
npm run build
```

## Deployment

This project is configured for Netlify static deployment.

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"
```

When deploying to Netlify, configure the repository to use the frontend directory as the app root and the dist folder as the publish directory.

## Contact Form Setup

The contact form is implemented as a Netlify Forms submission and is intentionally not a placeholder.

### Required Netlify configuration

1. Push the repository to GitHub.
2. Import the repository to Netlify.
3. Use the existing build configuration in netlify.toml.
4. After deployment, open the Netlify dashboard and confirm the form is detected as `bdpl-contact`.
5. Enable form notifications or email delivery in the Netlify dashboard, if required.

### Important note

No email, SMTP, or secret credentials are stored in the frontend code. Notifications are created inside the Netlify dashboard after deployment. This project does not claim live email delivery until that configuration is completed and verified.

## Environment Variables

No frontend environment variables are required for the static site.

If the site is later moved to a custom backend or different form provider, add the configuration through that platform and keep secrets out of the frontend source code.

## Privacy Policy

A draft privacy policy page is included at `/privacy-policy.html` and linked from the footer. It explains the information collected through the inquiry form, the business purpose of collection, retention handling, and the need for BDPL to confirm final retention and sharing practices before production.

## Business details BDPL should confirm before production

Before launch, the business should confirm:

- final public contact details and inquiry-routing destination
- whether Netlify form notifications should be enabled
- the official website domain and final canonical URL
- any retention period for submitted inquiries
- any sharing or internal escalation workflow for inbound business enquiries
- whether a dedicated privacy policy review is required by legal/compliance teams

## Quality checks performed

- build verification with `npm run build`
- review of page metadata and accessibility basics
- confirmation that the project does not include Moneytray references, future strategy claims, or fabricated financial metrics
- mobile-first responsive layout implemented for common viewport widths

## Final notes

The site is designed to be credible, mobile-friendly, and straightforward to deploy without introducing a custom backend. The enquiry form remains intentionally simple and production-ready for a Netlify static deployment model.

The progress marker is presentational; it does not navigate between sections. The form starts with sample values, so replace them with the intended applicant's information.

### Validation enforced by the current service

- Applicant, employment, and loan-detail objects must be present.
- Applicant PAN is checked against the format `^[A-Z]{5}[0-9]{4}[A-Z]$`. KYC validation accepts lowercase input by normalizing it to uppercase.
- Credit Score is a required whole number from 300 through 900. Status is `POOR` (300-649), `FAIR` (650-749), or `GOOD` (750-900).
- Monthly in-hand salary must be greater than zero.
- Requested loan amount must be greater than zero.
- Interest rate must be from 0 through the configured maximum, default `30` percent per year.
- Preferred tenure must be a positive number of months.
- Submission requires every document type to have `UPLOADED` status, a valid credit score, and a persisted `VALIDATION_PASSED` PAN-format validation.
- Document uploads must be non-empty PDF/JPG/JPEG/PNG files no larger than 10 MB each. The backend checks the uploaded content type.

The create/update request cascades Bean Validation into its nested applicant, employment, and loan-detail DTOs. Mobile numbers must contain exactly 10 digits.

### Save and reopen behavior

Save Draft creates an application if needed, then sends the current applicant, employment, and loan data to the backend. Application and document metadata are stored in PostgreSQL; document bytes are stored separately in the configured filesystem directory. Data remains after a browser refresh and backend restart when PostgreSQL and the document directory are retained.

There is no User-facing list or resume control. The Admin Recent Applications table can open an application and reload its details and uploaded document list. The table's **Open** action is not a separate review/approval workflow.

### Submission and LOS number

The backend submit endpoint checks required applicant/loan details, all four required document types, a whole-number credit score from 300 through 900, and successful local PAN format validation. On successful submission it sets status `SUBMITTED` and assigns a server-generated LOS number if one has not already been assigned. The format is `LOS-YYYY-########` (year and an eight-digit sequence). The LOS number is stored in the `loan_applications` row with a database unique constraint and is not replaced on later submissions or edits.

The success panel displays the returned LOS number and status. The Admin table also shows LOS numbers, and its text search can match the number.

## 10. Admin Features

The Admin role displays summary counts and a **Recent Applications** table. The table can:

- Search case-insensitive substrings in applicant name, LOS number, or mobile number. Search and status filtering run in PostgreSQL through Spring Data JPA queries.
- Filter by All, Draft, or Submitted status.
- Open an application to restore its fields and document list.
- Edit fields and use the existing Save Draft control.

The dashboard totals are loaded separately from the filtered table results. There are no implemented approval/rejection actions or separate Admin pages; the navigation links are placeholders on the single page.

## 11. Application Statuses

The entity defines these values:

| Status | Current use |
| --- | --- |
| `DRAFT` | Assigned when the backend creates an application. |
| `DOCUMENTS_PENDING` | Used by frontend state when the user attempts submission with documents missing; it is not set by the backend submission service. |
| `CREDIT_CHECK_COMPLETED` | Set when a valid manually entered credit score is saved. |
| `SUBMITTED` | Set after the backend submission requirements pass. |
| `UNDER_REVIEW` | Defined in the enum; no current transition assigns it. |
| `APPROVED` | Defined in the enum; no current approval action assigns it. |
| `REJECTED` | Defined in the enum; no current rejection action assigns it. |

## 12. PostgreSQL Setup and File Storage

PostgreSQL is the runtime database. The default JDBC URL is `jdbc:postgresql://localhost:5432/loan_origination`; the username defaults to `postgres`, and the password must be configured locally. Hibernate uses `ddl-auto: update`, which creates or updates the schema without dropping existing data. The database must exist before backend startup.

1. Install PostgreSQL and start its service.
2. Create the application database as a PostgreSQL administrator:

```sql
CREATE DATABASE loan_origination;
```

3. Set connection variables in the backend process environment. In PowerShell:

```powershell
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "loan_origination"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "your-local-password"
```

`.env.example` lists the variable names and safe defaults. Spring Boot does not load `.env` files automatically; export variables in the process environment or use a local tool that does so. Do not commit `.env` files or real passwords.

4. From `backend/`, start the service:

```powershell
mvn spring-boot:run
```

Application data stored in PostgreSQL includes applicants, loan applications, employment and loan details, credit checks, document metadata, and KYC verifications. Drafts remain available after browser refresh, logout, and backend restart as long as the same PostgreSQL database is retained. There is no User-facing draft picker; Admin can open saved applications from Recent Applications.

Document bytes are stored on the filesystem under `backend/data/documents/` by default; PostgreSQL stores their metadata and paths. Keep this directory along with the database to preserve uploaded files. `DOCUMENT_STORAGE_PATH` can override the file location. Existing H2 records are not imported automatically. H2 is retained only for the in-memory test profile, which uses `create-drop` and a test upload directory.

## 13. Backend API Overview

The frontend reaches the API through Vite's `/api` proxy. Protected application, document, credit-score, and submission endpoints require a valid server-issued bearer token. Admin listing is restricted by the service to the Admin role; application detail access checks the authenticated User mobile against the applicant. KYC format validation in the UI is local; the authenticated submission endpoint independently validates the submitted KYC fields.

| Method and endpoint | Purpose and request/response |
| --- | --- |
| `POST /api/auth/login/user` | Public demo login. JSON body: `mobileNumber`, `otp`. Returns role, normalized mobile number, a short-lived bearer token, and message; invalid credentials return 401. |
| `POST /api/auth/login/admin` | Public demo login. JSON body: `username`, `password`. Returns role, username, a short-lived bearer token, and message; invalid credentials return 401. |
| `POST /api/auth/logout` | Revokes the bearer token supplied in the `Authorization` header. |
| `GET /api/applications?search={term}&status={status}` | Lists matching application summaries; intended for Admin. Search is optional and matches LOS number, applicant name, or mobile. Status is optional (`ALL`, `DRAFT`, or `SUBMITTED`). Returns an array with ID, LOS number, applicant name and mobile, loan type, status, creation time, score, and amount. |
| `GET /api/applications/counts` | Returns total, draft, under-review, and submitted application counts for the dashboard. |
| `POST /api/applications` | Creates a draft. JSON body has `applicant`, `employment`, and `loanDetails`; returns application details including ID, status, and any LOS number. |
| `GET /api/applications/{id}` | Returns application fields, status, credit score if persisted, and LOS number; access is checked against the demo principal. |
| `PUT /api/applications/{id}` | Updates applicant, employment, and loan details. Uses the same JSON body shape as create. |
| `POST /api/applications/{id}/credit-check` | JSON body: `creditScore` as digits; validates and persists the manual score and its calculated status. |
| `POST /api/applications/{id}/documents` | Multipart form: `file`, `documentType`, `documentName`. Stores bytes and metadata; returns the saved document. |
| `GET /api/applications/{id}/documents` | Returns the application's document metadata. |
| `GET /api/applications/{id}/documents/{documentId}` | Streams the stored document inline. |
| `DELETE /api/applications/{id}/documents/{documentId}` | Deletes document metadata and stored bytes; returns no content. |
| `POST /api/applications/{id}/submit` | JSON body: `creditScore`, `customerName`, `verificationType`, and `panNumber`; independently validates these with required details and documents, then persists the existing per-application KYC record and returns the LOS number/status. |


## 14. Credit Score and KYC Validation

Credit Score is manually entered and validated against the configured 300-900 range. The application calculates `POOR`, `FAIR`, or `GOOD` from the entered score; it does not query a credit bureau.

KYC currently uses manually entered PAN information with local format validation. No external KYC provider is currently connected. The **Validate KYC** button makes no HTTP request; final submission independently validates the customer name, verification type, and PAN on the backend. A valid submission updates the existing unique per-application KYC record to `VALIDATION_PASSED`; this means only that the PAN text matches the expected format, not government or provider verification.

## 15. Configuration

Runtime settings are in [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml); test settings are in [backend/src/main/resources/application-test.yml](backend/src/main/resources/application-test.yml).

| Environment variable | Default/use |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `loan_origination` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | PostgreSQL user password; configure locally |
| `DOCUMENT_STORAGE_PATH` | `./data/documents` |
| `LOAN_MAX_INTEREST_RATE` | `30` percent |

The backend uses port 8080. Frontend development port and API proxy are configured in [frontend/vite.config.ts](frontend/vite.config.ts). The frontend has no separate API base URL setting; it uses relative `/api` paths.

## 16. Tests and Development Commands

Backend tests:

```bash
cd backend
mvn test
```

Frontend type-check and production build:

```bash
cd frontend
npm run build
```

Maven tests activate the `test` profile, which uses test-scoped in-memory H2 and `backend/target/test-uploads`. The frontend package does not define a separate automated test script.

## 17. Troubleshooting

### Maven is not recognized

Run `mvn -version`. Install Maven and add its `bin` directory to `PATH`, or use a terminal where Maven is already configured. The repository does not include Maven Wrapper scripts.

### Backend cannot connect to PostgreSQL

Confirm PostgreSQL is running, the configured database exists, and `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, and `DB_PASSWORD` match a user allowed to connect to it. Hibernate creates or updates the application schema after connecting. The old H2 file is not used by the runtime configuration.

### Frontend does not start

Run `npm ci` from `frontend/` and then `npm run dev -- --host 0.0.0.0`. Check the Vite terminal for the actual port; Vite selects a later port if 5173 is occupied.

On Windows, stop the Vite dev server with `Ctrl+C` before running `npm ci`. The running server can hold `node_modules/@esbuild/win32-x64/esbuild.exe`, causing npm to fail with `EPERM` while replacing dependencies. Restart Vite after installation completes.

### Frontend cannot reach the backend

Confirm the backend is listening on port 8080. Vite proxies `/api` to `http://localhost:8080`; update [frontend/vite.config.ts](frontend/vite.config.ts) if the backend is intentionally running elsewhere.

### Upload or submission fails

Uploads must be non-empty PDF/JPG/JPEG/PNG files up to 10 MB. All four required document types are needed. Final submission also requires a valid manually entered credit score and successful local PAN format validation; Save Draft does not require either value.

## 18. Security Notes

This is a demo application. The static OTP, hardcoded Admin credentials, in-memory token store, and client-side role selection are not suitable for production. The backend requires server-issued bearer tokens and ignores the old caller-supplied identity headers, but production still needs a real identity provider, durable session/token management, and operational security controls.

No external KYC provider is configured. Integrate an approved provider behind the KYC provider interface before representing a customer as externally verified.

## 19. Future Enhancements

These are not currently implemented: secure server-verified authentication; a User-facing saved-application/resume list; real bureau/KYC integrations; Admin approval/rejection actions; and application-summary download. A production database migration and protected document storage would also be needed before production use.