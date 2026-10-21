# FinEdge Bank
# Loan Origination System
# User Manual

## Introduction

FinEdge Bank's Loan Origination System (LOS) is a demonstration application for entering loan applicant information and supporting documents.

- **User access** is for entering and saving loan application information.
- **Admin access** is for viewing the application list, searching it, and opening an application.

This is a demo. It does not make real lending decisions or connect to a real credit bureau or KYC provider. The login choices are for demonstration and are not production security.

## How to Log In

### Step 1 - Open the Application

Open the address printed by the person who started the application. The usual local address is `http://localhost:5173`. If that port is already being used, the application may start at a different port; use the address shown in the startup window.

### Step 2 - Select User

Choose **User** on the login screen.

### Step 3 - Enter a Mobile Number

Enter a 10-digit mobile number using digits only. Do not include the country code `+91`. The application removes punctuation before checking the number, but entering digits only avoids confusion.

### Step 4 - Send OTP

Select **Send OTP**. In development mode, the backend generates a short-lived OTP and displays it on screen. This is for development only; production requires an SMS OTP provider.

### Step 5 - Enter OTP

Enter the six-digit OTP returned by the development screen and select **Verify OTP**.

> **DEVELOPMENT ONLY:** The generated OTP is exposed by the development configuration for local testing. No SMS is sent. Production must disable OTP exposure and integrate an SMS provider.

### Step 6 - Enter the Application

After login, the application form appears. Its sections are on one page. The numbered progress marker is an indicator, not a set of separate pages. Some fields contain sample values; replace those values with the information for the application you are preparing.

## Complete a User Application

### 1. Applicant Details

Enter the applicant's full name, date of birth, PAN, mobile number, email addresses, residential address, city, state, and pincode. The mock PAN check expects the format of five letters, four digits, and one letter, for example `ABCDE1234F`. Use a 10-digit Indian mobile number beginning with 6, 7, 8, or 9 when entering applicant details.

The application may report a validation message if PAN, loan values, or monthly in-hand salary are invalid. Complete the displayed fields carefully; some missing values may be rejected by the backend without a field-specific message.

### 2. Employment & Income

Choose an employment type: Salaried, Self Employed, or Business Owner. Enter employer, designation, experience, monthly in-hand salary, and monthly gross salary as applicable. Monthly in-hand salary must be greater than zero.

### 3. Credit Score

Select **Run Credit Check** to save the application and persist a simulated score. It is not a real bureau result and must not be used for a financial decision.

> **Current limitation:** The simulated result is now stored against the application. A real credit bureau integration is still required before production use.

### 4. KYC Verification

For an application that has already been created, select **Start KYC Verification** to request a mock PAN-verification result. This is separate from loan submission and is not required by the current submit service. The mode selector is displayed in the form, but its selection is not currently passed through to the backend provider; outcomes are controlled by backend mock behavior/configuration.

### 5. Loan Details

Select a loan type, then enter the requested amount, preferred tenure in months, and purpose of the loan. The annual interest rate is read-only and comes from backend configuration.

| Field | What to enter |
| --- | --- |
| Loan Type | Personal, Home, Car, or Education Loan |
| Requested Loan Amount | An amount greater than zero |
| Preferred Tenure | A positive whole number of months |
| Interest Rate | Read-only; set by backend product-rate configuration. Default prototype rates are not approved lending rates. |
| Purpose of Loan | A short explanation of the intended purpose |

The EMI estimate updates when the amount, interest rate, or tenure changes. EMI means **Equated Monthly Instalment**, the estimated monthly payment. The screen also shows estimated total interest and total amount payable. These are demo calculations, not an offer or financial advice.

### 6. Upload Documents

The application lists four required document types:

1. Bank Statement
2. Latest Salary Slip
3. Previous Salary Slip
4. PAN Document

For each item, select **Choose File**, choose a non-empty PDF, JPG/JPEG, or PNG file, and check that its status changes to **Uploaded**. Each file must be no larger than 10 MB. If a document is already uploaded, select **Replace** to upload a replacement. Use **View** to open a stored file.

All four document types must be uploaded before the backend accepts a submission. Uploaded files and their records are stored on the local server.

### 7. Save a Draft

Select **Save Draft** to store the current applicant, employment, and loan details. Uploaded documents are stored when each upload succeeds. The data remains in the local application database after a browser refresh or backend restart. When you log in again, the latest saved draft is automatically reopened if one exists.



### 8. Submit the Application

Complete the fields, upload all four required document types, and select **Submit Application**. The backend also requires a persisted credit-check record. The current screen now creates that record through the application-specific endpoint. The score remains simulated until a real bureau integration is configured. If required documents are missing, the page asks you to upload them first.

If submission succeeds, the confirmation panel shows the application status and Application Number. The current application-summary download button does not perform a download.

## Application Number

The Application Number (stored internally as the LOS Number in this prototype) is the unique reference number assigned to your submitted loan application. It is generated by the backend only after the submission requirements pass, stored with the application, and shown on the confirmation panel. The Admin Recent Applications table also displays it.

The current format is `LOS-YYYY-########`, where `YYYY` is the year and the final eight digits are a sequence; for example, `LOS-2026-00000001`. Keep the number so an Admin can find the application. Because the current credit-check integration can block submission, a number will not appear unless the backend accepts the submission.

# Administrator Guide

## Admin Login

1. Select **Admin** on the login screen.
2. Enter the admin username.
3. Enter the admin password.
4. Select **Login**.

> **DEMO / DEVELOPMENT ONLY:** The current demo credentials are username `admin` and password `admin`. Do not use these credentials for a real service.

Admin credentials are validated by the backend and a server-issued bearer token is required for protected APIs. Configure `LOS_ADMIN_USERNAME` and `LOS_ADMIN_PASSWORD` before use; the default `admin/admin` values are development-only and must not be used in production.

## Admin Dashboard and Recent Applications

The Admin view is part of the same page as the application form. It shows counts for Total Applications, Draft Applications, Under Review, and Submitted Applications, followed by the **Recent Applications** table. These are counts and rows from the backend application list; statuses that are not assigned by the current workflow may remain at zero.

## Search and Filter

Type part of an applicant name, Application Number, or mobile number in the search field. Search ignores letter case and matches a substring. Use the status menu to show All Status, Draft, or Submitted applications.

Examples: searching `amit` can match an applicant named Amit Sharma; searching `LOS-2026` can match LOS numbers from that year.

## Open and Update an Application

1. Find the application in **Recent Applications**.
2. Select **Open**.
3. The application details and uploaded-document list are loaded into the form.
4. Review the displayed information and documents. The fields are editable.
5. Use **Save Draft** to send edited applicant, employment, and loan fields to the backend.

The current Admin screen does not provide approve, reject, or dedicated decision controls. Its navigation labels do not open separate pages.

## Log Out

Both User and Admin can select **Logout** in the top navigation. This clears the browser's current demo login and returns to the login screen. Use Logout when finished, especially on a shared computer. Closing the browser is not a substitute for a production sign-out mechanism.

## Common Errors

| Message or situation | What to do |
| --- | --- |
| Invalid mobile number | Enter 10 digits. For applicant details, use an Indian mobile number beginning with 6-9. Do not include `+91`. |
| Invalid OTP | Request a new OTP and enter the six-digit code shown in development mode. No SMS is sent by the current prototype. |
| Required document not uploaded | Upload each of the four listed document types and confirm each shows **Uploaded**. |
| Application cannot be submitted | Confirm all four documents are uploaded. The backend also requires a persisted credit check; the current UI does not save its displayed mock score, so this error may persist. Contact the application maintainer. |
| Unable to open application | Confirm the application still appears in Recent Applications and try again. If it continues, contact the application maintainer. |
| Session expired or returned to login | Log in again. The backend bearer token expires after the configured session lifetime and the UI clears it after an API authorization error. |
| Upload failed | Choose a non-empty PDF/JPG/JPEG/PNG file up to 10 MB and retry. |

## Important Notes

- This is a development/demo LOS application, not a production lending service.
- Development OTPs are generated by the backend and shown in the UI only when `LOS_DEMO_OTP_ENABLED=true`; no SMS is sent. Admin credentials are backend-configured, and the defaults are development-only.
- Mock credit and KYC results are not real verification results.
- Production login, authorization, workflow, and provider behavior may be different. Do not enter real sensitive customer data into an unapproved demo environment.