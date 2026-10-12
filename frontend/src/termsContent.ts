export const CONSENT_VERSION = 'draft-1 (2026-10-12)';

export const CONSENT_DOCUMENTS = {
  terms: {
    title: 'Terms & Conditions',
    sections: [
      {
        heading: 'Accurate application information',
        paragraphs: [
          'Applicants are responsible for providing complete, accurate, and current information and for correcting material changes while an application is being considered.'
        ]
      },
      {
        heading: 'Collection and use of information',
        paragraphs: [
          'Information submitted through the loan portal may be used to create, administer, assess, and communicate about an application, subject to applicable law and the bank policies that apply to the service.'
        ]
      },
      {
        heading: 'KYC and document verification',
        paragraphs: [
          'Applicants should submit authentic documents only when requested. The bank may review information and documents for identity, eligibility, fraud-prevention, and compliance purposes. Uploading a document does not mean it has been verified or accepted.'
        ]
      },
      {
        heading: 'Personal information',
        paragraphs: [
          'Personal, contact, employment, financial, and document information should be handled only for purposes connected with the application and in accordance with applicable privacy requirements and approved bank policies. Information may be accessed by authorized personnel and service providers or disclosed where legally required.'
        ]
      },
      {
        heading: 'Responsible use of the portal',
        paragraphs: [
          'Use the portal only for lawful application-related activity. Do not submit information or documents on another person’s behalf without authority, attempt unauthorized access, or interfere with the service.'
        ]
      },
      {
        heading: 'OTP and account security',
        paragraphs: [
          'Keep login credentials and one-time passwords confidential, use a trusted device, and report suspected unauthorized access through the bank’s official support channels. The current demonstration may display a test OTP and is not a production authentication service.'
        ]
      },
      {
        heading: 'Application review',
        paragraphs: [
          'Submitting an application is not an offer, approval, or guarantee of credit. Any decision is subject to the bank’s applicable policies, verification checks, eligibility criteria, and required approvals.'
        ]
      },
      {
        heading: 'Withdrawal and questions',
        paragraphs: [
          'Consent may be withdrawn by contacting the bank through its official support channels. Withdrawal may affect continued processing and does not necessarily prevent processing already permitted by law or records the bank is required to retain. Use contact details published through official bank channels for questions or requests.'
        ]
      }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'Information in this demonstration',
        paragraphs: [
          'A loan application may include identity and contact details, employment and income information, requested loan details, and documents supplied for review. Do not enter real sensitive information into this demonstration unless its use has been approved.'
        ]
      },
      {
        heading: 'Purpose and access',
        paragraphs: [
          'In a production service, application information would be used for application administration, assessment, verification, security, and related legal or regulatory requirements. Access and disclosures must be governed by applicable law and approved bank policies.'
        ]
      },
      {
        heading: 'Security and retention',
        paragraphs: [
          'The applicable bank privacy notice should describe the safeguards, processors, retention periods, and individual rights for a production service. Those details have not been established by this demonstration text and require review by the bank.'
        ]
      },
      {
        heading: 'Requests and contact',
        paragraphs: [
          'For privacy questions, access requests, or consent withdrawal, use the contact details and process published through the bank’s official channels.'
        ]
      }
    ]
  }
} as const;