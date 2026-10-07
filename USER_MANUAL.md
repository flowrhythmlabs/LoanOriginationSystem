# FinEdge Bank
# Loan Origination System
# User Manual

## Introduction

FinEdge Bank's Loan Origination System (LOS) is a demonstration application for entering loan applicant information and supporting documents.

- **User access** is for entering and saving loan application information.
- **Admin access** is for viewing the application list, searching it, and opening an application.

This is a demo. It does not make real lending decisions or connect to a real credit bureau or KYC provider. The login choices are for demonstration and are not production security.

## 1. Login

Users enter exactly 10 digits, select **Send OTP**, and use the fixed demo OTP `123456`. No SMS is sent. Administrators select **Admin** and use the demo username `admin` and password `admin`.

> **DEMO ONLY:** The OTP and admin credentials are public test values and must not be used for a production service.

After successful login, the backend issues a temporary access token for the browser session. Do not share login details or tokens.

## 2. User Security

Users can access and modify only applications belonging to their logged-in mobile number. Users cannot open Admin Recent Applications, search all applications, or access another user's application or documents. The backend checks these permissions even if a URL or request is changed manually.

## 3. Admin Security

Only an authenticated Admin can view Recent Applications, search by LOS number, applicant name, or mobile number, open applications, and update application data. Admin access is enforced by the backend; hiding a screen does not grant permission.

## How to Log In

### Step 1 - Open the Application

Open the address printed by the person who started the application. The usual local address is `http://localhost:5173`. If that port is already being used, the application may start at a different port; use the address shown in the startup window.

### Step 2 - Select User

Choose **User** on the login screen.

### Step 3 - Enter a Mobile Number

Enter exactly 10 digits. Do not enter spaces, punctuation, letters, or the country code `+91`; the application rejects non-digit input.

### Step 4 - Send OTP

Select **Send OTP**. This demo does not send a text message; it displays the test OTP on the screen.

### Step 5 - Enter OTP

Enter `123456` and select **Verify OTP**.

> **DEMO / TEST ONLY:** `123456` is a fixed test code, not a real one-time password.

### Step 6 - Enter the Application

After login, the application form appears. Its sections are on one page. The numbered progress marker is an indicator, not a set of separate pages. Some fields contain sample values; replace those values with the information for the application you are preparing.

## Complete a User Application

### 1. Applicant Details

Enter the applicant's full name, date of birth, PAN, mobile number, email addresses, residential address, city, state, and pincode. PAN must use five letters, four digits, and one letter, for example `ABCDE1234F`. Use a 10-digit Indian mobile number beginning with 6, 7, 8, or 9 when entering applicant details.

The application may report a validation message if PAN, loan values, or monthly in-hand salary are invalid. Complete the displayed fields carefully; some missing values may be rejected by the backend without a field-specific message.

### 2. Employment & Income

Choose an employment type: Salaried, Self Employed, or Business Owner. Enter employer, designation, experience, monthly in-hand salary, and monthly gross salary as applicable. Monthly in-hand salary must be greater than zero.

### 3. Credit Score

Enter a whole-number credit score from 300 through 900. Credit Score is manually entered and validated against the configured 300-900 range. The status updates as you type: 300-649 is **POOR**, 650-749 is **FAIR**, and 750-900 is **GOOD**. The value is not fetched from a credit bureau.

### 4. KYC Verification

Confirm the customer name, choose **PAN Verification**, enter a PAN, and select **Validate KYC**. Lowercase letters are converted to uppercase. A valid format contains exactly five letters, four digits, and one letter, for example `ABCDE1234F`.

KYC currently uses manually entered PAN information with local format validation. No external KYC provider is currently connected. The button makes no API request. A valid result is shown as **PAN Format Valid** with status **VALID**; an invalid PAN is shown as **Invalid PAN Format** with status **INVALID**. This does not mean government or bureau verification. The backend independently validates these details during final submission. After reopening a draft, select **Validate KYC** again before submitting.

### 5. Loan Details

Select a loan type, then enter the requested amount, preferred tenure in months, annual interest rate, and purpose of the loan.

| Field | What to enter |
| --- | --- |
| Loan Type | Personal, Home, Car, or Education Loan |
| Requested Loan Amount | An amount greater than zero |
| Preferred Tenure | A positive whole number of months |
| Interest Rate | A percentage from 0% through the configured maximum; the default maximum is 30% per year |
| Purpose of Loan | A short explanation of the intended purpose |

The EMI estimate updates when the amount, interest rate, or tenure changes. EMI means **Equated Monthly Instalment**, the estimated monthly payment. The screen also shows estimated total interest and total amount payable. These are demo calculations, not an offer or financial advice.

### 6. Upload Documents

The application lists four required document types:

1. Bank Statement
2. Latest Salary Slip
3. Previous Salary Slip
4. PAN Document

For each item, select **Choose File**, choose a non-empty PDF, JPG/JPEG, or PNG file, and check that its status changes to **Uploaded**. Each file must be no larger than 10 MB. If a document is already uploaded, select **Replace** to upload a replacement. Use **View** to open a stored file.

All four document types must be uploaded before the backend accepts a submission. Document bytes are stored on the backend server's filesystem; document metadata is stored in PostgreSQL.

### 7. Save a Draft

Select **Save Draft** to store the current applicant, employment, and loan details in PostgreSQL. Uploaded documents are stored when each upload succeeds. Draft data remains available after browser refresh, logout, or backend restart as long as the backend reconnects to the same PostgreSQL database and the document-storage directory is retained.

There is no User-facing saved-application list in the current application, so a User cannot select and reopen a draft from the screen. An Admin can use **Recent Applications** and **Open** to reload a saved application. The application form itself does not automatically restore the last draft after a refresh.

### Where application data is stored

The running application uses the PostgreSQL database `loan_origination` by default. PostgreSQL stores applicant, loan, application, credit-check, KYC, and document metadata. Uploaded document files are stored separately on the backend filesystem, in `backend/data/documents/` by default. Both the database and document directory must be retained to preserve applications and their uploaded files. Existing records from the former H2 database are not imported automatically.

### 8. Submit the Application

Complete the required applicant and loan fields, enter a valid credit score, validate the PAN format, upload all four required document types, and select **Submit Application**. The backend validates these requirements again. If a required value or document is missing or invalid, submission is rejected with a validation message. **Save Draft** remains available without a credit score or completed KYC validation.

If submission succeeds, the confirmation panel shows the application status and LOS Number. The current application-summary download button does not perform a download.

## LOS Number

The LOS Number is the unique reference number assigned to your submitted loan application. It is generated by the backend only after the submission requirements pass, stored with the application, and shown on the confirmation panel. The Admin Recent Applications table also displays it.

The current format is `LOS-YYYY-########`, where `YYYY` is the year and the final eight digits are a sequence; for example, `LOS-2026-00000001`. Keep the number so an Admin can find the application. A number is assigned only after the backend accepts the submission.

# Administrator Guide

## Admin Login

1. Select **Admin** on the login screen.
2. Enter the admin username.
3. Enter the admin password.
4. Select **Login**.

> **DEMO / DEVELOPMENT ONLY:** The current demo credentials are username `admin` and password `admin`. Do not use these credentials for a real service.

The backend verifies these credentials and returns a temporary demo access token. This is not a secure production identity system.

## Admin Dashboard and Recent Applications

The Admin view is part of the same page as the application form. It shows Total Applications, Draft Applications, Under Review, and Submitted Applications counts, followed by the **Recent Applications** table. The counts and table data come from the backend; statuses that are not assigned by the current workflow may remain at zero. Search results do not change the dashboard totals.

## Search and Filter

Type part of an applicant name, LOS Number, or mobile number in the search field. Search ignores letter case for names and LOS numbers and matches a substring. Search and status filtering are performed by the backend against persisted PostgreSQL data. Use the status menu to show All Status, Draft, or Submitted applications.

Examples: searching `amit` can match an applicant named Amit Sharma; searching `LOS-2026` can match LOS numbers from that year; searching `9876` can match a mobile number containing those digits.

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
| Invalid OTP | Enter the demo code `123456`. No SMS is sent. |
| Required document not uploaded | Upload each of the four listed document types and confirm each shows **Uploaded**. |
| Application cannot be submitted | Correct the highlighted applicant, loan, or credit-score fields; validate PAN format; and confirm all four documents show **Uploaded**. Save Draft remains available if score or KYC details are not ready. |
| Unable to open application | Confirm the application still appears in Recent Applications and try again. If it continues, contact the application maintainer. |
| Session expired or returned to login | Log in again. The demo login is stored in the current browser session and the UI clears it after an API authorization error. |
| Upload failed | Choose a non-empty PDF/JPG/JPEG/PNG file up to 10 MB and retry. |
| Applications or documents are unavailable after a restart | Ask the application operator to confirm PostgreSQL is running and that the same database and document-storage directory are configured. |

## 7. Security Best Practices for Users

- Do not share demo login credentials or OTPs.
- Log out after completing work, especially on a shared computer.
- Upload only supported PDF, JPG/JPEG, or PNG files no larger than 10 MB.
- Do not attempt to open or modify applications or documents that do not belong to you.
- Do not enter real customer information into this demonstration environment unless it has been approved for that use.

## Important Notes

- This is a development/demo LOS application, not a production lending service.
- The OTP and Admin credentials are fixed demo values.
- Credit scores are manually entered and do not come from a credit bureau. PAN KYC checks only local input format; no external KYC provider is connected.
- Production login, authorization, workflow, and provider behavior may be different. Do not enter real sensitive customer data into an unapproved demo environment.