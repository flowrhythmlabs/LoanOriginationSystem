# LoanOriginationSystem

**FinEdge Bank - Loan Origination System**

## 1. Overview

FinEdge LOS is a development/demo application for capturing loan applicant, employment, and loan information; uploading supporting documents; running mock PAN, credit-score, and KYC flows; and storing applications in a local database. It is not connected to a real bank, credit bureau, or KYC provider and must not be used for lending or compliance decisions.

The frontend is a single-page application. Its progress indicator labels five stages, but the form sections are displayed together rather than as separate wizard pages.

## 2. Current Features

- A login screen with User and Admin choices. The backend issues expiring bearer sessions; development OTP is generated server-side and is displayed only while the development OTP setting is enabled.
- Applicant, employment/income, and loan detail forms.
- A live frontend EMI estimate based on amount, annual interest rate, and tenure.
- Mock credit-score and KYC endpoints.
- UI support to upload, replace, list, and view required documents; the backend also exposes a document-delete API.
- Draft creation and updates persisted by the backend.
- Backend submission logic that requires all four document types and a persisted credit-check record, then assigns an LOS number.
- An Admin Recent Applications table with the existing filtering and Open action; users automatically resume their latest saved draft after login.
- Local file-backed H2 persistence and filesystem document storage by default.

### Current integration gaps

- The first Applicant block captures Aadhaar/PAN numbers or PDF/JPG/PNG documents (maximum 5 MB), requires explicit consent, and supports drag-and-drop. Identity-fetch errors leave manual entry available and preserve entered values. Aadhaar is masked in the UI. Extraction displays a loading spinner and times out after 30 seconds with a retry/manual-entry message. Manual edits made during extraction are not overwritten by the response.
- `POST /api/kyc/identity` accepts authenticated multipart requests with `documentType` (`AADHAAR` or `PAN`), `consent=true`, and either `number` or `file`. It validates input before invoking the existing selected `KycProvider.fetchIdentityDetails`. A successful provider implementation must return nonempty applicant field names matching the existing form (`fullName`, ISO `dateOfBirth`, `gender`, `fatherName`, `residentialAddress`, `city`, `state`, `pincode`, `panNumber`, and other supported personal fields). The endpoint responds with `{"fields": {...}}`; Aadhaar is masked before returning it. The UI merges returned values into existing applicant state, marks unchanged fetched values, and counts actual populated fields. Source tags are saved with the draft in applicant additional details; manual changes no longer show a fetched tag or contribute to the summary.
- **Identity extraction in the default mock provider returns fixed demo details** (Rahul Sharma, 1995-05-15, Male, Suresh Sharma, 123 Main Street, Varanasi, UP, 221006, PAN ABCDE1234F) for any valid request; this is unverified demo data, not a live Aadhaar/PAN lookup. Aadhaar requests also return a masked number: the entered number's last four digits, or demo suffix 9012 for document-only requests. The fetched Aadhaar input displays only those last four digits and becomes read-only. PAN requests do not return an Aadhaar number. The live `SignzyKycProvider` (`kyc.provider=signzy`) still rejects identity fetching with HTTP 503 until a documented provider integration is implemented. Existing simulated KYC verification is unchanged.

- The **Run Credit Check** action now saves the current form and calls the application-specific backend credit-check endpoint, which persists the simulated result required for submission. The result is still mock data, not a live bureau result.
- The latest saved draft for a signed-in user is automatically reopened after login. Backend application listing is filtered to the signed-in user�s mobile number.
- The KYC mode selector shown in the form is included in a frontend request, but the KYC controller does not forward that value to the provider. The effective mock mode comes from backend configuration/provider behavior.
- The application-summary download button has no download action. There are no UI actions to approve or reject an application.

## 3. Technology Stack

| Area | Technology |
| --- | --- |
| Backend | Java 17, Spring Boot 3.3.3, Spring Web, Spring Security, Spring Data JPA, Bean Validation |
| Backend build | Maven; no Maven Wrapper is included |
| Database | H2 2.x dependency, file-backed by default for local runs |
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
    security/     Bearer-token authentication filter
    service/      Application, document, mock credit, PAN, and KYC logic
  src/main/resources/  Runtime and test configuration
  data/                Local H2 database and uploaded documents at runtime
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
- PostgreSQL 14 or newer (the backend no longer uses H2 by default)
- Git, if cloning the repository

Check the tools with `java -version`, `mvn -version`, `node --version`, `npm --version`, and `psql --version`.

## 6. Install and Build

### 6.1 Create the database and staff accounts (first-time setup)

1. Create the database (the default name is `finedge`):

   ```bash
   psql -U postgres -c "CREATE DATABASE finedge;"
   ```

2. Tell the backend how to connect. Defaults are `jdbc:postgresql://localhost:5432/finedge`, user `finedge`, password `postgres`; override them if your server differs (PowerShell example):

   ```powershell
   $env:DB_USERNAME = "postgres"
   $env:DB_PASSWORD = "<your postgres password>"
   ```

3. Start the backend once (section 7) so Hibernate creates the applicant and loan tables, then stop it.
4. Create the staff, underwriting and maker-checker tables, then load the demo staff accounts (demo only, never in production):

   ```bash
   psql -U postgres -d finedge -f backend/ADMIN_PORTAL_SCHEMA.sql
   psql -U postgres -d finedge -f backend/DEMO_STAFF_SEED.sql
   ```

   The seed creates `superadmin`, `policyadmin`, `processor`, `underwriter`, `creditmanager`, `operations` and `auditor`, all with password `admin`. Staff sign in at `/staff/login` with the password and then a 6-digit authenticator code. Add each account's Base32 secret (`staff_account.totp_secret_encrypted`, listed in `backend/DEMO_STAFF_SEED.sql`) to Google or Microsoft Authenticator as a time-based entry. See [DEMO_STAFF_SETUP.md](DEMO_STAFF_SETUP.md). Re-running the seed resets passwords and MFA secrets.

   If staff login shows "Internal server error", these tables are missing; run step 4.

### 6.2 Install and build

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

Run each process in a separate terminal. Start Maven from `backend` so the default relative document path resolves beneath `backend/data/`. PostgreSQL must be running and the `DB_*` variables set as in section 6.1.

Backend:

```bash
cd backend
mvn spring-boot:run
```

The backend listens on `http://localhost:8080`.

Hibernate detects the SQL dialect from the configured datasource. Do not force the PostgreSQL dialect in shared configuration: the `test` profile uses H2, which cannot execute PostgreSQL-specific identity inserts. A mismatched dialect can cause the OTP consent insert to fail with HTTP 500 before SMS delivery.

For normal local use, run without the `test` profile to use PostgreSQL. The `test` profile uses an in-memory database that is discarded when the backend stops.

Frontend:

```bash
cd frontend
npm ci
npm run dev -- --host 0.0.0.0
```

Vite uses port `5173` by default and proxies `/api` requests to `http://localhost:8080`. If that port is busy, Vite automatically tries another port; use the URL printed in the terminal. Open `http://localhost:5173` when the default port is available.

## 8. Authentication and Limitations

The login page calls the backend authentication endpoints. Successful login receives an opaque bearer token stored for the current browser session. Protected API requests send `Authorization: Bearer <token>`; caller-supplied `X-Role`, `X-Mobile`, and `X-Username` headers are no longer trusted. Tokens expire after the configured session lifetime and logout revokes the token on the server.

**SMS OTP:** user login requests a six-digit OTP through 2Factor (`SmsOtpSender`) using its existing `/API/V1/{key}/SMS/{mobile}/{otp}/{template}` endpoint. The configured 2Factor URL override, if used, must also target an SMS route; a 2Factor `/VOICE/` URL is rejected before any request is made. Set `SMS_API_KEY` in the backend process environment; this key is required and there is no in-code fallback. If it is missing, server logs record the safe diagnostic code `sms_api_key_missing`, while the browser receives only a generic retry message. A provider `Success` response means the request was accepted, not that the SMS was delivered. The login UI reports this distinction and keeps the OTP active when the request outcome is uncertain (for example, a timeout). Backend resend cooldown defaults to 30 seconds (`LOS_OTP_RESEND_COOLDOWN_SECONDS`); connect/read timeouts default to 3/8 seconds (`SMS_CONNECT_TIMEOUT_MS`, `SMS_READ_TIMEOUT_MS`). Set `SMS_TEMPLATE_ID` if needed. `LOS_DEMO_OTP_ENABLED` defaults to `false`; set it to `true` only for local testing to have the OTP returned in the API response. The OTP expires after `LOS_OTP_MINUTES` (default 5).

**Staff login:** `/staff/login` uses the staff accounts seeded in section 6.1: password, then a TOTP code.

This branch does not use Netlify. There are no Netlify functions, `netlify.toml` or browser-side mock API; the frontend always calls the Spring Boot backend through the Vite `/api` proxy.


**Admin credentials:** `LOS_ADMIN_USERNAME` and `LOS_ADMIN_PASSWORD` configure the backend admin login. The defaults `admin` / `admin` are for local development only and must be overridden before deployment. Use a strong secret and a secret manager in production. MFA, persistent user management, password hashing/rotation, and enterprise identity integration remain production hardening items.

`H2_CONSOLE_ENABLED` defaults to `false`. The local H2 database remains available to the application itself. This project is still a prototype: credit bureau and KYC results are simulated, and the default per-product interest rates are placeholders that must be replaced with approved policy rates.

## 9. User Application Workflow

The form contains these sections on one page:

1. **Applicant Details:** name, date of birth, PAN, mobile, personal/work email, address, city, state, and pincode.
2. **Employment & Income:** employment type, employer, designation, experience, and monthly in-hand/gross income.
3. **Credit Score:** the application-specific action saves a simulated credit-check record. The score is not from a real bureau.
4. **KYC Verification:** a mock KYC request can be started for an existing application. This is separate from submission and is not required by the submit service.
5. **Loan Details:** loan type, requested amount, tenure in months, annual interest rate, and loan purpose. The frontend recalculates an EMI estimate as amount, tenure, and the backend-configured rate change. The rate is read-only in the applicant UI.
6. **Document Upload:** upload Bank Statement, Latest Salary Slip, Previous Salary Slip, and PAN Document.
7. **Save Draft** or **Submit Application**.

The progress marker is presentational; it does not navigate between sections. The form starts with sample values, so replace them with the intended applicant's information.

### Validation enforced by the current service

- Applicant, employment, and loan-detail objects must be present.
- PAN is checked against the format `^[A-Z]{5}[0-9]{4}[A-Z]$` by the mock PAN service.
- Monthly in-hand salary must be greater than zero.
- Requested loan amount must be greater than zero.
- Interest rate is derived by the backend from the configured rate for the selected loan product; the configured rate must not exceed the configured maximum (default `30` percent per year).
- Preferred tenure must be a positive number of months.
- Submission requires every document type to have `UPLOADED` status and requires a persisted credit-check record.
- Document uploads must be non-empty PDF/JPG/JPEG/PNG files no larger than 10 MB each. The backend checks the uploaded content type.

The create/update request cascades Bean Validation into its nested applicant, employment, and loan-detail DTOs. Mobile numbers must contain exactly 10 digits.

### Save and reopen behavior

Save Draft creates an application if needed, then sends the current applicant, employment, and loan data to the backend. Uploaded document metadata is stored in H2 and document bytes are stored separately in the configured filesystem directory. Data remains after a browser refresh and backend restart with the default file-backed database.

The Admin **Recent Applications** table can open an application and reload its details and uploaded document list. A User automatically resumes their latest saved draft after login. The table's **Open** action is not a separate review/approval workflow.

### Submission and LOS number

The backend submit endpoint checks that all four required document types are uploaded and that a backend credit-check record exists. On successful submission it sets status `SUBMITTED` and assigns a server-generated reference if one has not already been assigned. The UI labels it **Application Number**; the internal database field remains `losNumber`. The format is `LOS-YYYY-########` (year and an eight-digit sequence).

The success panel displays the returned LOS number and status. The Admin table also shows LOS numbers, and its text search can match the number. However, the current frontend credit-score action does not create the record required by the backend submit endpoint, so the standard new-application UI path may not reach this success panel until that integration is fixed.

## 10. Admin Features

The Admin role displays summary counts and a **Recent Applications** table. The table can:

- Search case-insensitive substrings in applicant name, LOS number, or mobile number.
- Filter by All, Draft, or Submitted status.
- Open an application to restore its fields and document list.
- Edit fields and use the existing Save Draft control.

Mobile-number search is supported by the current table using the mobile number included in each application summary. There are no implemented approval/rejection actions or separate Admin pages; the navigation links are placeholders on the single page.

## 11. Application Statuses

The entity defines these values:

| Status | Current use |
| --- | --- |
| `DRAFT` | Assigned when the backend creates an application. |
| `DOCUMENTS_PENDING` | Used by frontend state when the user attempts submission with documents missing; it is not set by the backend submission service. |
| `CREDIT_CHECK_COMPLETED` | Set by the backend credit-check endpoint. The UI's mock score button only changes frontend state. |
| `SUBMITTED` | Set after the backend submission requirements pass. |
| `UNDER_REVIEW` | Defined in the enum; no current transition assigns it. |
| `APPROVED` | Defined in the enum; no current approval action assigns it. |
| `REJECTED` | Defined in the enum; no current rejection action assigns it. |

## 12. Database and File Storage

The default runtime database is PostgreSQL:

- JDBC URL: `jdbc:postgresql://localhost:5432/finedge` (override with `DB_URL`)
- Credentials: `DB_USERNAME` / `DB_PASSWORD` (defaults `finedge` / `postgres`)
- Applicant and loan tables: created by Hibernate (`ddl-auto: update`)
- Staff, underwriting and maker-checker tables: `backend/ADMIN_PORTAL_SCHEMA.sql`; demo staff accounts: `backend/DEMO_STAFF_SEED.sql` (see section 6.1)

The test profile uses an in-memory H2 database with `create-drop` and a test upload directory. Default credentials are development settings, not production settings.

Persisted JPA data includes applicants, loan applications, employment details, loan details, credit checks, documents' metadata, and KYC verifications. Application rows reference their applicant, employment, loan, credit-check, and document records. The LOS number is stored on the application. Uploaded bytes are written to `backend/data/documents/` by default; only their metadata/path is in the database.

Back up the PostgreSQL database (`pg_dump finedge`) and `backend/data/documents/` to preserve local records. If `DOCUMENT_STORAGE_PATH` is overridden, documents are stored there instead.

## 13. Backend API Overview

The frontend reaches the API through Vite's `/api` proxy. Protected endpoints require a server-issued bearer token. Admins can list all applications; users receive only applications matching their authenticated mobile number, and application detail access checks ownership. The standalone mock credit-score-by-PAN endpoint has been removed so users cannot query arbitrary PANs through that API.

| Method and endpoint | Purpose and request/response |
| --- | --- |
| `POST /api/auth/otp/request` | Requests a short-lived OTP. In development mode, returns the generated `demoOtp`; production SMS delivery is not integrated. |
| `POST /api/auth/login/user` | Verifies `mobileNumber` and `otp`, then returns a bearer `accessToken`; invalid or expired OTP returns 401. |
| `POST /api/auth/login/admin` | Validates backend-configured admin credentials and returns a bearer `accessToken`; invalid credentials return 401. |
| `POST /api/auth/logout` | Revokes the bearer token supplied in the Authorization header. |
| `GET /api/applications` | Lists all application summaries for Admin or only the authenticated user's own applications. Returns ID, reference number, applicant name/mobile, loan type, status, creation time, score, and amount. |
| `POST /api/applications` | Creates a draft. JSON body has `applicant`, `employment`, and `loanDetails`; returns application details including ID, status, and any LOS number. |
| `GET /api/applications/{id}` | Returns application fields, status, persisted credit score if available, and application reference; access is checked against the authenticated principal. |
| `PUT /api/applications/{id}` | Updates applicant, employment, and loan details. Uses the same JSON body shape as create. |
| `POST /api/applications/{id}/credit-check` | Runs and persists a mock credit check for the owned application; returns application details. The current UI calls this endpoint. |
| `POST /api/applications/{id}/documents` | Multipart form: `file`, `documentType`, `documentName`. Stores bytes and metadata; returns the saved document. |
| `GET /api/applications/{id}/documents` | Returns the application's document metadata. |
| `GET /api/applications/{id}/documents/{documentId}` | Streams the stored document inline. |
| `DELETE /api/applications/{id}/documents/{documentId}` | Deletes document metadata and stored bytes; returns no content. |
| `POST /api/applications/{id}/submit` | Submits only when all required document types and a persisted credit-check record exist. Returns application details including LOS number and status. |
| `POST /api/mock/pan/verify` | Authenticated mock PAN-format check. JSON body is applicant data; returns verification result. |
| `POST /api/applications/{id}/kyc` | Starts mock KYC for an application. Request includes a verification type; returns the persisted verification. Existing KYC for the application is rejected. |
| `GET /api/applications/{id}/kyc` | Returns the application's KYC verification. |
| `POST /api/applications/{id}/kyc/retry` | Retries an existing non-verified mock verification and returns its updated record. |

There is no `/api/admin` controller or search API in the current source. Admin table filtering is performed in the browser after loading the application list.

## 14. KYC and Mock Services

PAN validation, credit scores, and KYC responses are simulated. No real bureau or Signzy HTTP integration is implemented: the `SignzyKycProvider` currently simulates provider responses even when Signzy configuration values are supplied. The default selected provider is `mock-signzy`. The form's mock-mode selector is not propagated by the current KYC controller, so do not rely on that selector to choose a KYC outcome.

KYC state values are `INITIATED`, `PENDING`, `VERIFIED`, `FAILED`, and `MANUAL_REVIEW`. One KYC record is allowed per application by the service and entity constraint. These KYC states are separate from loan application statuses.

## 15. Configuration

Runtime settings are in [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml); test settings are in [backend/src/main/resources/application-test.yml](backend/src/main/resources/application-test.yml).

| Environment variable | Default/use |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/finedge` |
| `DB_DRIVER_CLASS_NAME` | `org.postgresql.Driver` |
| `DB_USERNAME` | `finedge` |
| `DB_PASSWORD` | `postgres` |
| `SMS_API_KEY` | 2Factor API key for OTP SMS |
| `SMS_TEMPLATE_ID` | Optional 2Factor template name |
| `LOS_OTP_RESEND_COOLDOWN_SECONDS` | Backend OTP resend cooldown in seconds (default `30`) |
| `SMS_CONNECT_TIMEOUT_MS`, `SMS_READ_TIMEOUT_MS` | 2Factor connection/read timeout in milliseconds (defaults `3000`/`8000`) |
| `LOS_DEMO_OTP_ENABLED` | `false`; `true` returns the OTP in the API response (local testing only) |
| `DOCUMENT_STORAGE_PATH` | `./data/documents` |
| `LOAN_MAX_INTEREST_RATE` | `30` percent |
| `MOCK_KYC_MODE` | `SUCCESS` |
| `SIGNZY_BASE_URL`, `SIGNZY_API_KEY`, `SIGNZY_AUTH_TOKEN`, `SIGNZY_CLIENT_ID`, `SIGNZY_CLIENT_SECRET` | Optional configuration placeholders; no real Signzy client currently uses them to make requests. |

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

Maven tests activate the `test` profile, which uses in-memory H2 and `backend/target/test-uploads`. The frontend package does not define a separate automated test script.

## 17. Troubleshooting

### Maven is not recognized

Run `mvn -version`. Install Maven and add its `bin` directory to `PATH`, or use a terminal where Maven is already configured. The repository does not include Maven Wrapper scripts.

### Backend fails with a PostgreSQL error

Make sure PostgreSQL is running, the `finedge` database exists, and `DB_USERNAME` / `DB_PASSWORD` are correct (section 6.1). Maven's `Process terminated with exit code: 1` usually means the database is missing or the credentials are wrong; see the first exception above that line.

### Backend does not start or reports the database is in use

Check the Maven/Spring logs and confirm no other backend process is using port 8080 or `backend/data/losdb.mv.db`. Run the backend from `backend/` so its relative data path is consistent. Stop the existing backend cleanly before starting another one; do not delete database files while it is running.

### Frontend does not start

Run `npm ci` from `frontend/` and then `npm run dev -- --host 0.0.0.0`. Check the Vite terminal for the actual port; Vite selects a later port if 5173 is occupied.

### Frontend cannot reach the backend

Confirm the backend is listening on port 8080. Vite proxies `/api` to `http://localhost:8080`; update [frontend/vite.config.ts](frontend/vite.config.ts) if the backend is intentionally running elsewhere.

### Upload or submission fails

Uploads must be non-empty PDF/JPG/JPEG/PNG files up to 10 MB. All four required document types are needed. The UI now persists the simulated credit-check result against the application before submission. Real bureau integration remains outstanding.

## 18. Security Notes

This is still a prototype. The development OTP is intentionally exposed by the backend when `LOS_DEMO_OTP_ENABLED=true`; disable it and integrate an SMS provider before production. Override default admin credentials. Replace mock credit/KYC checks with contracted providers, and complete MFA, rate limiting, persistent user/session management, production database configuration, audit controls, and security testing before handling real customer data.

Do not put real Signzy credentials or other secrets in source control. Store secrets in an appropriate secret manager/environment and implement a real provider integration before using external KYC. Current Signzy configuration values do not activate a real integration.

## 19. Future Enhancements

These are not currently implemented: real SMS delivery for OTP; real bureau/KYC integrations; functional KYC mode selection; Admin approval/rejection actions; and application-summary download. A production database migration and protected document storage would also be needed before production use.
## Updated change-request implementation
- The applicant now lands on a dashboard after OTP login. Start a new application or resume a saved draft from there.
- New drafts use a temporary ID (`DRAFT-<id>`). The final Application Number is assigned only after successful submission.
- Incomplete drafts are saved on field blur and can be saved manually. The application form starts without sample applicant/employer/loan amounts; the mobile number is populated from the authenticated session.
- `VITE_DEMO_MODE=true` displays the Demo environment ribbon and the development OTP. Use this only locally, together with `LOS_DEMO_OTP_ENABLED=true`. For production, configure a real SMS OTP provider and keep both demo flags disabled.
- The updated backend schema migration makes draft-only fields nullable for H2/PostgreSQL so partially completed drafts can be saved. Back up the database before upgrading an existing deployment.
- Documents are limited to PDF/JPG/PNG up to 5 MB. Uploads are checked on the client and server; admins can verify, reject with a reason, or raise a deficiency. Submission requires required documents to be verified.
- The frontend build and Maven test suite could not be run in this workspace because the project dependencies are not installed and Maven is unavailable. Install dependencies locally and run `npm ci && npm run build` in `frontend`, then `mvn test` in `backend` before deployment.
Live SMS, production KYC/bureau providers, selfie liveness, OCR-based document-to-applicant matching, IFSC lookup, and percentage-based upload progress still require provider/infrastructure integration.
