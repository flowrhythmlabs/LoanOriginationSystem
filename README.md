# LoanOriginationSystem

**FinEdge Bank - Loan Origination System**

## 1. Overview

FinEdge LOS is a development/demo application for capturing loan applicant, employment, and loan information; manually entering and validating a credit score; checking PAN input format; uploading supporting documents; and storing applications in a local database. It is not connected to a real bank, credit bureau, or KYC provider and must not be used for lending or compliance decisions.

The frontend is a single-page application. Its progress indicator labels five stages, but the form sections are displayed together rather than as separate wizard pages.

# Security

This project implements practical security hardening with the existing Spring Boot, Spring Security, JPA, PostgreSQL, and React stack. No new Maven or npm dependencies were added. No application can be guaranteed to be completely vulnerability-free.

## Authentication Security

- User login validates a 10-digit mobile number and the fixed demo OTP.
- Admin login validates the fixed demo `admin` / `admin` credentials.
- Successful login issues a short-lived, server-generated bearer token held in browser `sessionStorage`.
- Logout revokes the token and clears the browser session.
- The token store is in memory and is lost on backend restart; this is suitable only for this demo.

## Authorization

- `USER` and `ADMIN` roles are assigned by the backend after credential validation.
- Protected APIs require a valid bearer token; caller-supplied role, mobile, and username headers are not trusted.
- Admin listing, counts, and search are restricted to `ADMIN`.
- Application and document operations perform application ownership checks for users; admins may manage applications.

## Data Protection

- PostgreSQL connection values are supplied through environment variables.
- Document storage is configured through `DOCUMENT_STORAGE_PATH` and is outside the frontend public directory by default.
- API error responses do not return stack traces, filesystem paths, SQL, or secrets.

## Document Security

- Uploads are limited to 10 MB per file and 20 MB per request.
- PDF, JPG/JPEG, and PNG MIME types must agree with the filename extension.
- Storage uses opaque generated filenames; path traversal and arbitrary storage keys are rejected.
- Download, list, replace, and delete operations require authorization through the owning application.

## API Security

- Backend Bean Validation and service validation cover mobile, PAN, email, text lengths, salary, loan amount, interest rate, and tenure.
- Admin search uses parameterized Spring Data JPA queries and has a length limit.
- CORS allows only local frontend origins on port 5173; wildcard origins are not enabled.
- CSRF is disabled because the API is stateless bearer-token authentication rather than cookie authentication. Production HTTPS and a reviewed token/session design remain necessary.
- Spring Security adds content-type, frame, and referrer protections. HSTS is disabled for local HTTP development.

## Logging Security

Routine logging does not include passwords, OTPs, bearer tokens, document contents, original document names, or storage keys. Error diagnostics remain server-side and should be reviewed before production logging is enabled.

## Secrets Management

Use environment variables such as `DB_USERNAME`, `DB_PASSWORD`, and `DOCUMENT_STORAGE_PATH`. `.env` files, generated files, uploads, `target`, and `node_modules` are ignored by Git. Do not commit real passwords, API keys, private keys, uploaded documents, or local databases.

## Security Controls Checklist

- [x] Backend authentication with server-issued tokens
- [x] Role-based authorization and application ownership checks
- [x] Document authorization and secure file path handling
- [x] Backend input and upload validation
- [x] Parameterized database search
- [x] Safe error responses and reduced sensitive logging
- [x] Environment-based database configuration
- [x] Restricted CORS and documented stateless CSRF strategy
- [x] Security headers appropriate for local HTTP development
- [ ] Production-grade OTP provider and password management
- [ ] Distributed rate limiting and account lockout
- [ ] Malware/content scanning for uploads
- [ ] Encryption at rest and production HTTPS infrastructure

## Security Limitations

The OTP and admin credentials are demo values and are intentionally retained for compatibility. Tokens are in-memory and not suitable for a multi-instance deployment. Robust distributed rate limiting, malware scanning, encryption at rest, production identity management, and HTTPS infrastructure require operational controls or additional components and were not added under the no-new-dependencies requirement.

## 2. Current Features

- A browser login screen with User and Admin choices. Login is currently simulated in the frontend; see [Authentication and limitations](#8-authentication-and-limitations).
- Applicant, employment/income, and loan detail forms.
- A live frontend EMI estimate based on amount, annual interest rate, and tenure.
- Manual credit-score entry with backend range validation and automatically calculated status.
- Local PAN format validation for KYC input; no external KYC provider is connected.
- UI support to upload, replace, list, and view required documents; the backend also exposes a document-delete API.
- Draft creation and updates persisted by the backend.
- Backend submission logic that requires all four document types, a valid persisted credit score, and successful local PAN format validation, then assigns an LOS number.
- An Admin-only Recent Applications table with applicant-name/LOS-number/mobile text filtering, status filtering, and an Open action.
- PostgreSQL persistence and filesystem document storage by default; H2 is used for backend tests.

### Current limitations

- Credit Score is manually entered and validated against the configured 300-900 range.
- KYC currently performs local input/format validation. No external KYC provider is connected yet.
- User login does not provide a saved-application picker. Persisted applications can be opened from the Admin-only Recent Applications table.
- The application-summary download button has no download action. There are no UI actions to approve or reject an application.

## 3. Technology Stack

| Area | Technology |
| --- | --- |
| Backend | Java 17, Spring Boot 3.3.3, Spring Web, Spring Security, Spring Data JPA, Bean Validation |
| Backend build | Maven; no Maven Wrapper is included |
| Database | PostgreSQL for runtime; H2 in-memory database for tests |
| Frontend | React 18, TypeScript 5, Vite 5 |
| Document bytes | Local filesystem |
| Automated tests | Spring Boot Test / JUnit via Maven; TypeScript build via npm |

Dependency versions and ranges are declared in [backend/pom.xml](backend/pom.xml) and [frontend/package.json](frontend/package.json). The project does not pin a Node.js or Maven version in its build configuration. Vite 5 requires Node.js 18 or newer; Java 17 is configured for the backend.

## 4. Project Structure

```text
backend/
  src/main/java/com/finedge/los/
    config/       Spring Security and KYC provider selection
    controller/   REST API controllers
    dto/          API request and response objects
    entity/       JPA-persisted application data
    exception/    API exception handling
    repository/   Spring Data repositories
    security/     Server-issued demo token authentication
    service/      Application, document, manual credit, PAN format, and KYC validation logic
  src/main/resources/  Runtime and test configuration
  data/documents/      Uploaded document files at runtime
frontend/
  src/App.tsx           LOS form, Admin table, and page-level login gate
  src/LoginPage.tsx     Demo login screen
  src/auth.ts           Browser session storage and request headers
  vite.config.ts        Frontend port and backend API proxy
USER_MANUAL.md          Non-technical end-user guide
```

## 5. Prerequisites

- Java 17
- Maven installed and available as `mvn` in the terminal
- Node.js 18 or newer and npm
- Git, if cloning the repository

Check the tools with `java -version`, `mvn -version`, `node --version`, and `npm --version`.

## 6. Install and Build

From the repository root, install frontend dependencies and build the frontend:

```bash
cd frontend
npm ci
npm run build
```

Build and test the backend:

```bash
cd backend
mvn test
mvn package
```

## 7. Run the Application

Run each process in a separate terminal. Start Maven from `backend` so the relative document path resolves beneath `backend/data/`. Configure the PostgreSQL environment variables before starting the backend; the default database is `loan_origination` on `localhost:5432`.

Backend:

```bash
cd backend
mvn spring-boot:run
```

On PowerShell, configure the PostgreSQL password in the process environment before starting. Do not put the real password in `application.yml` or commit it to the repository:

```powershell 
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "loan_origination"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "LOS123"
mvn spring-boot:run
```

If `DB_PASSWORD` is missing, startup stops with a configuration error instead of attempting an empty-password database connection. If Maven cannot resolve the `spring-boot` prefix, run the command from `backend/` or use `mvn org.springframework.boot:spring-boot-maven-plugin:3.3.3:run`.

The backend listens on `http://localhost:8080`.

Frontend:

```bash
cd frontend
npm ci
npm run dev -- --host 0.0.0.0
```

Vite uses port `5173` by default and proxies `/api` requests to `http://localhost:8080`. If that port is busy, Vite automatically tries another port; use the URL printed in the terminal. Open `http://localhost:5173` when the default port is available.

## 8. Authentication and Limitations

The visible login screen calls the backend demo login endpoints and stores the returned server-issued bearer token in browser `sessionStorage`.

**User demo login:** enter exactly 10 digits and use OTP `123456`. Non-digit input and invalid pasted values are rejected. The OTP is hardcoded for the demo; no SMS is sent.

**Admin demo login:** username `admin`, password `admin`. These values are hardcoded in the frontend and backend demo service.

The backend login endpoints return role/user information and a short-lived token. Application API requests use `Authorization: Bearer ...`; caller-supplied identity headers are ignored. Role selection in the UI remains a demo convenience, not a production identity system.

Logout revokes the in-memory bearer token where the backend is available, clears the browser session value, and returns the UI to the login screen.
## 9. User Application Workflow

The form contains these sections on one page:

1. **Applicant Details:** name, date of birth, PAN, mobile, personal/work email, address, city, state, and pincode.
2. **Employment & Income:** employment type, employer, designation, experience, and monthly in-hand/gross income.
3. **Credit Score:** enter a whole number from 300 through 900. The status updates immediately: 300-649 is `POOR`, 650-749 is `FAIR`, and 750-900 is `GOOD`.
4. **KYC Verification:** confirm the customer name and PAN Verification type, enter a PAN, and select **Validate KYC**. This performs local format validation only and does not call an API or verify government records.
5. **Loan Details:** loan type, requested amount, tenure in months, annual interest rate, and loan purpose. The frontend recalculates an EMI estimate as these values change.
6. **Document Upload:** upload Bank Statement, Latest Salary Slip, Previous Salary Slip, and PAN Document.
7. **Save Draft** or **Submit Application**.

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