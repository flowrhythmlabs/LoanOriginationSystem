import { StaffAuditPortal } from './StaffAuditPortal';
import { PolicyCheckerPortal } from './PolicyCheckerPortal';
/// <reference types="vite/client" />
import { UnderwritingWorkspace } from './UnderwritingWorkspace';
import { StaffAdminPortal } from './StaffAdminPortal';
import { PolicyAdminPortal } from './PolicyAdminPortal';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LoginPage } from './LoginPage';
import { canUseLocalCreditFallback, creditServiceError, CreditServiceUnavailableError, withDevelopmentTimeout } from './creditDevelopment';
import { buildAuthHeaders, clearAuth, readStoredAuth, type AuthSession } from './auth';
import { clearLoanDraft, readLoanDraft, writeLoanDraft } from './draftStorage';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, maskAadhaar, maskAadhaarEntry, editAadhaarEntry, extractIdentityFromDocument, readIdentityFields, validateIdentity, validateIdentityFile, type IdentityFields, type IdentityField, type IdentityType } from './identity';
function CreditScoreRating({ score }: { score: number }) {
  const rating = score >= 750 ? 'Excellent' : score >= 700 ? 'Good' : score >= 650 ? 'Fair' : 'Poor';
  return <span className={`credit-score-rating credit-score-rating--${rating.toLowerCase()}`}>{rating}</span>;
}

type Applicant = {
  fullName: string;
  dateOfBirth: string;
  panNumber: string;
  mobileNumber: string;
  email: string;
  workEmail: string;
  residentialAddress: string;
  city: string;
  state: string;
  pincode: string;
  additionalDetails?: Record<string, string>;
};

const formatIndianIncome = (value: number | string) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-IN') : '';
};

type Employment = {
  employmentType: string;
  employerName: string;
  designation: string;
  totalWorkExperienceYears: number | string;
  currentEmployerExperienceYears: number | string;
  monthlyInHandSalary: number | string;
  monthlyGrossSalary: number | string;
  additionalDetails?: Record<string, string>;
};

type LoanDetails = {
  loanType: string;
  requestedLoanAmount: number | string;
  interestRate: number | string;
  preferredTenure: number | string;
  purposeOfLoan: string;
  additionalDetails?: Record<string, string>;
};

type LocalDraftSnapshot = {
  applicationId: number | null;
  localDraftId: string | null;
  currentStep: number;
  highestUnlockedStep: number;
  applicant: Applicant;
  employment: Employment;
  loanDetails: LoanDetails;
  identityType: IdentityType;
  identityPanNumber: string;
  identityConsent: boolean;
  identityFetched: IdentityFields;
  creditMode: 'MANUAL' | 'ONLINE';
  manualCreditScore: string;
  creditScore: number | null;
};

const ACTIVE_DRAFT_STATUSES = ['DRAFT', 'DOCUMENTS_PENDING', 'CREDIT_CHECK_COMPLETED'];

const clampStep = (value: unknown) => {
  const step = Number(value);
  return Number.isInteger(step) && step >= 1 && step <= 5 ? step : 0;
};

type ApplicationRow = {
  id: number;
  losNumber: string | null;
  applicantName: string | null;
  applicantMobile?: string;
  loanType: string | null;
  requestedAmount: number | null;
  creditScore: number | null;
  status: string;
  createdAt: string;
};

type DocumentType = 'BANK_STATEMENT' | 'LATEST_SALARY_SLIP' | 'PREVIOUS_SALARY_SLIP' | 'PAN_DOCUMENT' | 'SALARY_SLIPS' | 'EMPLOYMENT_PROOF' | 'FORM_16' | 'ITR' | 'BUSINESS_PROOF' | 'GST_DOCUMENT' | 'QUALIFICATION_PROOF' | 'PHOTOGRAPH' | 'SIGNATURE' | 'CANCELLED_CHEQUE' | 'VOTER_ID' | 'AADHAAR_DOCUMENT' | 'ADDRESS_PROOF' | 'EXISTING_LOAN_STATEMENTS' | 'PROPERTY_DOCUMENTS' | 'VEHICLE_DOCUMENTS' | 'EDUCATION_DOCUMENTS' | 'BUSINESS_FINANCIALS' | 'COAPPLICANT_PAN' | 'COAPPLICANT_KYC' | 'COAPPLICANT_BANK_STATEMENT' | 'COAPPLICANT_PHOTOGRAPH' | 'COAPPLICANT_SIGNATURE' | 'GUARANTOR_PAN' | 'GUARANTOR_KYC' | 'GUARANTOR_BANK_STATEMENT' | 'GUARANTOR_PHOTOGRAPH' | 'GUARANTOR_SIGNATURE';
type DocumentStatus = 'NOT_UPLOADED' | 'UPLOADING' | 'UPLOADED' | 'UPLOAD_FAILED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'DEFICIENCY_RAISED';

type DocumentEntry = {
  id: number | null;
  documentType: DocumentType;
  documentName: string;
  status: DocumentStatus;
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  error: string | null;
  verificationRemarks?: string | null;
};

const initialApplicant: Applicant = {
  fullName: '',
  dateOfBirth: '',
  panNumber: '',
  mobileNumber: '',
  email: '',
  workEmail: '',
  residentialAddress: '',
  city: '',
  state: '',
  pincode: '',
  additionalDetails: { nationality: '', residentialStatus: '', maritalStatus: '', gender: '', fatherName: '', motherName: '', spouseName: '', education: '', alternateMobile: '', aadhaarNumber: '', alternateIdType: '', alternateIdNumber: '', currentResidenceType: '', yearsAtAddress: '', monthlyRent: '', permanentAddress: '', sameAsCurrentAddress: 'true', addressProofType: '', accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', bankBranch: '', accountType: '', salaryAccount: '', coApplicantName: '', coApplicantRelationship: '', coApplicantType: '', coApplicantPan: '', coApplicantMobile: '', coApplicantEmail: '', coApplicantAddress: '', guarantorName: '', guarantorRelationship: '', guarantorPan: '', guarantorMobile: '', guarantorEmail: '', guarantorAddress: '', guarantorConsent: 'false' }
};

const initialEmployment: Employment = {
  employmentType: '',
  employerName: '',
  designation: '',
  totalWorkExperienceYears: '',
  currentEmployerExperienceYears: '',
  monthlyInHandSalary: '',
  monthlyGrossSalary: '',
  additionalDetails: { employerAddress: '', officialEmail: '', employeeId: '', employmentContractType: '', employerCategory: '', totalAnnualIncome: '', salaryCreditMode: '', otherIncome: '0', profession: '', qualification: '', practiceBusinessName: '', constitution: '', registrationNumber: '', practiceVintage: '', yearsInProfession: '', businessAddress: '', natureOfWork: '', grossReceipts: '', netProfit: '', businessPan: '', industry: '', registeredAddress: '', incorporationDate: '', premises: '', businessPhone: '', businessEmail: '', employeeCount: '', ownersPartnersDirectors: '', authorizedSignatory: '', annualTurnover: '', monthlyAverageTurnover: '', netWorth: '', gstRegistered: '', gstin: '', gstFilingStatus: '', itrNumber: '', existingLoans: '', monthlyObligations: '0', accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' }
};

const DEFAULT_PERSONAL_LOAN_INTEREST_RATE = 10.5;

const resolveInterestRate = (loanType: string, rate: number | string | null | undefined): number | string => {
  if (loanType === 'PERSONAL_LOAN' && (rate == null || String(rate).trim() === '' || Number(rate) === 0)) {
    return DEFAULT_PERSONAL_LOAN_INTEREST_RATE;
  }
  return rate ?? '';
};

const initialLoanDetails: LoanDetails = {
  loanType: 'PERSONAL_LOAN',
  requestedLoanAmount: '',
  interestRate: DEFAULT_PERSONAL_LOAN_INTEREST_RATE,
  preferredTenure: 36,
  purposeOfLoan: '',
  additionalDetails: { processingFees: '0', gstOnFees: '0', insuranceCharges: '0', scheduledDisbursalDate: '', coApplicantRequired: 'false', guarantorRequired: 'false' }
};

const MAX_INTEREST_RATE = 30;

const formatCurrency = (value: number | string) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(numericValue);
};

const formatInterestRate = (value: number | string) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return '0.00% p.a.';
  }
  return `${numericValue.toFixed(2)}% p.a.`;
};

const parseNumericValue = (value: number | string) => {
  if (value === '' || value === null || value === undefined) {
    return NaN;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : NaN;
};

const describeApiError = (payload: any, fallback: string) => {
  if (payload?.errors && typeof payload.errors === 'object') {
    const details = Object.entries(payload.errors).map(([field, message]) => `${field}: ${String(message)}`).join(' · ');
    return details || payload.message || fallback;
  }
  return payload?.message || fallback;
};
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPan = (value: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
const validName = (value: string) => /^[A-Za-z .'-]+$/.test(value.trim());
const calculateAge = (date: string) => { if (!date) return ''; const born = new Date(date); if (Number.isNaN(born.getTime())) return ''; const today = new Date(); let age = today.getFullYear() - born.getFullYear(); const monthDiff = today.getMonth() - born.getMonth(); if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age--; return age >= 0 ? String(age) : ''; };
const getVisibleInvalidRequiredFields = () => Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
  'input:invalid, select:invalid, textarea:invalid'
)).filter(field => field.getClientRects().length > 0 && !field.disabled)
  .map(field => ({
    field: field.labels?.[0]?.innerText.replace(/\s+/g, ' ').trim() || field.name || field.id || field.type,
    message: field.validationMessage
  }));

const getMissingRequiredContactDetails = () => Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
  '.required-contact-block [required]'
)).filter(field => field.getClientRects().length > 0 && !field.disabled && !field.checkValidity())
  .map(field => field.labels?.[0]?.innerText.replace(/\s+/g, ' ').trim() || field.name || field.id || 'Required contact field');

const validateMobileNumber = (mobile: string) => {
  if (/\D/.test(mobile)) {
    return 'Mobile number must contain digits only.';
  }
  return /^\d{10}$/.test(mobile) ? '' : 'Please enter a valid 10-digit mobile number.';
};

const calculateEmi = (principal: number, annualRate: number, tenureMonths: number) => {
  if (!Number.isFinite(principal) || principal <= 0) {
    return 0;
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    return 0;
  }
  if (!Number.isFinite(tenureMonths) || tenureMonths <= 0) {
    return 0;
  }
  if (annualRate === 0) {
    return principal / tenureMonths;
  }

  const monthlyRate = annualRate / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
};

const DOCUMENTS_BY_EMPLOYMENT: Record<string, Array<{ key: DocumentType; label: string; required: boolean }>> = {
  SALARIED: [{key:'PAN_DOCUMENT',label:'PAN',required:true},{key:'AADHAAR_DOCUMENT',label:'Aadhaar',required:true},{key:'BANK_STATEMENT',label:'Bank statements (3 months)',required:true},{key:'SALARY_SLIPS',label:'Latest 3 months salary slips',required:true},{key:'EMPLOYMENT_PROOF',label:'Employer certificate / employment proof',required:true},{key:'FORM_16',label:'Form 16 (latest financial year)',required:true},{key:'ITR',label:'ITR',required:false},{key:'PHOTOGRAPH',label:'Passport-size photograph',required:true},{key:'SIGNATURE',label:'Signature / e-sign',required:true},{key:'CANCELLED_CHEQUE',label:'Cancelled cheque / bank proof',required:true},{key:'VOTER_ID',label:'Voter ID (alternate ID)',required:false}],
  SELF_EMPLOYED: [{key:'PAN_DOCUMENT',label:'PAN',required:true},{key:'AADHAAR_DOCUMENT',label:'Aadhaar',required:true},{key:'BANK_STATEMENT',label:'Bank statements (3 months)',required:true},{key:'ITR',label:'ITR (last 2 years with computation)',required:false},{key:'BUSINESS_PROOF',label:'Business / professional proof',required:true},{key:'GST_DOCUMENT',label:'GST registration / returns (if applicable)',required:false},{key:'QUALIFICATION_PROOF',label:'Professional qualification proof',required:true},{key:'PHOTOGRAPH',label:'Passport-size photograph',required:true},{key:'SIGNATURE',label:'Signature / e-sign',required:true},{key:'CANCELLED_CHEQUE',label:'Cancelled cheque / bank proof',required:true},{key:'VOTER_ID',label:'Voter ID (alternate ID)',required:false}],
  BUSINESS_OWNER: [{key:'PAN_DOCUMENT',label:'PAN',required:true},{key:'AADHAAR_DOCUMENT',label:'Aadhaar',required:true},{key:'BANK_STATEMENT',label:'Business bank statements (3 months)',required:true},{key:'ITR',label:'ITR (last 2 years with computation)',required:false},{key:'BUSINESS_PROOF',label:'Business registration / entity documents',required:true},{key:'GST_DOCUMENT',label:'GST registration / returns',required:true},{key:'PHOTOGRAPH',label:'Passport-size photograph',required:true},{key:'SIGNATURE',label:'Signature / e-sign',required:true},{key:'CANCELLED_CHEQUE',label:'Cancelled cheque / bank proof',required:true},{key:'VOTER_ID',label:'Voter ID (alternate ID)',required:false}]
};
const REQUIRED_DOCUMENTS = DOCUMENTS_BY_EMPLOYMENT.SALARIED;
const INDIA_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];

const createInitialDocuments = (): Record<DocumentType, DocumentEntry> => ({
  BANK_STATEMENT: { id: null, documentType: 'BANK_STATEMENT', documentName: 'Bank Statement', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  LATEST_SALARY_SLIP: { id: null, documentType: 'LATEST_SALARY_SLIP', documentName: 'Latest Salary Slip', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  PREVIOUS_SALARY_SLIP: { id: null, documentType: 'PREVIOUS_SALARY_SLIP', documentName: 'Previous Salary Slip', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  PAN_DOCUMENT: { id: null, documentType: 'PAN_DOCUMENT', documentName: 'PAN Document', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  SALARY_SLIPS: { id: null, documentType: 'SALARY_SLIPS', documentName: 'Latest 3 months salary slips', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  EMPLOYMENT_PROOF: { id: null, documentType: 'EMPLOYMENT_PROOF', documentName: 'Employer certificate / employment proof', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  FORM_16: { id: null, documentType: 'FORM_16', documentName: 'Form 16', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  ITR: { id: null, documentType: 'ITR', documentName: 'ITR', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  BUSINESS_PROOF: { id: null, documentType: 'BUSINESS_PROOF', documentName: 'Business / professional proof', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  GST_DOCUMENT: { id: null, documentType: 'GST_DOCUMENT', documentName: 'GST registration / returns', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  QUALIFICATION_PROOF: { id: null, documentType: 'QUALIFICATION_PROOF', documentName: 'Professional qualification proof', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  PHOTOGRAPH: { id: null, documentType: 'PHOTOGRAPH', documentName: 'Passport-size photograph', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  SIGNATURE: { id: null, documentType: 'SIGNATURE', documentName: 'Signature / e-sign', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  CANCELLED_CHEQUE: { id: null, documentType: 'CANCELLED_CHEQUE', documentName: 'Cancelled cheque / bank proof', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  VOTER_ID: { id: null, documentType: 'VOTER_ID', documentName: 'Voter ID', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  ADDRESS_PROOF: { id: null, documentType: 'ADDRESS_PROOF', documentName: 'Address proof', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  EXISTING_LOAN_STATEMENTS: { id: null, documentType: 'EXISTING_LOAN_STATEMENTS', documentName: 'Existing loan statements', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  PROPERTY_DOCUMENTS: { id: null, documentType: 'PROPERTY_DOCUMENTS', documentName: 'Property documents', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  VEHICLE_DOCUMENTS: { id: null, documentType: 'VEHICLE_DOCUMENTS', documentName: 'Vehicle documents', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  EDUCATION_DOCUMENTS: { id: null, documentType: 'EDUCATION_DOCUMENTS', documentName: 'Education loan documents', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  BUSINESS_FINANCIALS: { id: null, documentType: 'BUSINESS_FINANCIALS', documentName: 'Balance sheet and profit & loss statements', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  AADHAAR_DOCUMENT: { id: null, documentType: 'AADHAAR_DOCUMENT', documentName: 'Aadhaar', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  COAPPLICANT_PAN: { id: null, documentType: 'COAPPLICANT_PAN', documentName: 'Co-applicant PAN', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  COAPPLICANT_KYC: { id: null, documentType: 'COAPPLICANT_KYC', documentName: 'Co-applicant KYC document', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  COAPPLICANT_BANK_STATEMENT: { id: null, documentType: 'COAPPLICANT_BANK_STATEMENT', documentName: 'Co-applicant bank statement', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  COAPPLICANT_PHOTOGRAPH: { id: null, documentType: 'COAPPLICANT_PHOTOGRAPH', documentName: 'Co-applicant photograph', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  COAPPLICANT_SIGNATURE: { id: null, documentType: 'COAPPLICANT_SIGNATURE', documentName: 'Co-applicant signature / e-sign', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  GUARANTOR_PAN: { id: null, documentType: 'GUARANTOR_PAN', documentName: 'Guarantor PAN', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  GUARANTOR_KYC: { id: null, documentType: 'GUARANTOR_KYC', documentName: 'Guarantor KYC document', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  GUARANTOR_BANK_STATEMENT: { id: null, documentType: 'GUARANTOR_BANK_STATEMENT', documentName: 'Guarantor bank statement', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  GUARANTOR_PHOTOGRAPH: { id: null, documentType: 'GUARANTOR_PHOTOGRAPH', documentName: 'Guarantor photograph', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  GUARANTOR_SIGNATURE: { id: null, documentType: 'GUARANTOR_SIGNATURE', documentName: 'Guarantor signature / e-sign', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null }
});

const statusColors: Record<string, string> = {
  DRAFT: 'neutral',
  DOCUMENTS_PENDING: 'warning',
  CREDIT_CHECK_COMPLETED: 'info',
  UNDER_REVIEW: 'primary',
  SUBMITTED: 'success',
  APPROVED: 'success',
  REJECTED: 'danger'
};

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredAuth());
  const [applicant, setApplicant] = useState<Applicant>(initialApplicant);
  const [identityType, setIdentityType] = useState<IdentityType>('');
  const [identityPanNumber, setIdentityPanNumber] = useState('');
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [identityConsent, setIdentityConsent] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState('');
  const [identityUsingMock, setIdentityUsingMock] = useState(false);
  const [pincodeMessage, setPincodeMessage] = useState('');
  const pincodeCacheRef = useRef(new Map<string, { city: string; state: string }>());
  const [identityFetched, setIdentityFetched] = useState<IdentityFields>({});
  const identityRequestRef = useRef<AbortController | null>(null);
  const identityFileRef = useRef<HTMLInputElement | null>(null);
  const coApplicantSectionRef = useRef<HTMLElement | null>(null);
  const shouldScrollToCoApplicantRef = useRef(false);
  const [applicantMobileError, setApplicantMobileError] = useState('');
  const [employment, setEmployment] = useState<Employment>(initialEmployment);
  const [loanDetails, setLoanDetails] = useState<LoanDetails>(initialLoanDetails);
  const [showRepaymentSchedule, setShowRepaymentSchedule] = useState(false);
  const [pricingPolicy, setPricingPolicy] = useState<{minAmount?:number;maxAmount?:number;minTenure?:number;maxTenure?:number;processingFeePercent?:number;gstPercent?:number;insurancePremium?:number;rateType?:string}>({});
  const [staffApplicationOpen, setStaffApplicationOpen] = useState(false);
  const [showUnderwriting, setShowUnderwriting] = useState(false);
  const [staffRoles,setStaffRoles] = useState<string[]>([]);
  const [staffView,setStaffView] = useState<'loading'|'administration'|'policy'|'checker'|'audit'|'recent'|'review'|'assisted'>('loading');
  useEffect(()=>{
    if(session?.role!=='ADMIN'){setStaffRoles([]);setStaffView('recent');return;}
    let cancelled=false;
    fetch('/api/staff/portal/context',{headers:buildAuthHeaders(session)})
      .then(async r=>{if(!r.ok)throw new Error(`Staff role lookup failed (${r.status})`);return r.json();})
      .then(data=>{if(cancelled)return;const roles=Array.isArray(data.roles)?data.roles.map(String):[];setStaffRoles(roles);setStaffView(roles.includes('SUPER_ADMIN')?'administration':roles.includes('PRODUCT_POLICY_ADMIN')?'policy':'recent');})
      .catch(()=>{if(!cancelled){setStaffRoles([]);setStaffView('loading');}});
    return ()=>{cancelled=true;};
  },[session?.accessToken,session?.role]);
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [creditUsingMock, setCreditUsingMock] = useState(false);
  const [creditMode, setCreditMode] = useState<'MANUAL' | 'ONLINE'>('MANUAL');
  const [manualCreditScore, setManualCreditScore] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [submittedApplication, setSubmittedApplication] = useState<{ losNumber?: string; status?: string; createdAt?: string } | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentEntry>>(createInitialDocuments());
  const [currentStep, setCurrentStep] = useState(1);
  const [showUserDashboard, setShowUserDashboard] = useState(true);
  const [newApplicationLoanType, setNewApplicationLoanType] = useState('PERSONAL_LOAN');
  const autoSaveTimerRef = useRef<number | null>(null);
  const [kycStatus, setKycStatus] = useState('Not Started');
  const [kycMessage, setKycMessage] = useState('');
  const [isCheckingCredit, setIsCheckingCredit] = useState(false);
  const [ifscMessages, setIfscMessages] = useState<Record<string, {text: string; error: boolean}>>({});
  const [highestUnlockedStep, setHighestUnlockedStep] = useState(1);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [localDraftId, setLocalDraftId] = useState<string | null>(null);
  const localDraftIdRef = useRef<string | null>(null);
  const [isCreatingApplication, setIsCreatingApplication] = useState(false);
  const applicationCreationRef = useRef<Promise<number> | null>(null);
  const autoResumeAttemptedRef = useRef<string | null>(null);
  // Mobile number whose saved draft has been checked; local persistence stays off until then so an empty form cannot overwrite it.
  const draftHydratedRef = useRef<string | null>(null);
  const [mockKycMode, setMockKycMode] = useState('SUCCESS');
  const [validationMessage, setValidationMessage] = useState('');
  const [saveIndicator, setSaveIndicator] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<DocumentType, string>>(() => Object.fromEntries(Object.keys(createInitialDocuments()).map((key) => [key, ''])) as Record<DocumentType, string>);

  useEffect(() => {
    if (!shouldScrollToCoApplicantRef.current || applicant.additionalDetails?.coApplicantRequired !== 'true') return;
    shouldScrollToCoApplicantRef.current = false;
    coApplicantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [applicant.additionalDetails?.coApplicantRequired]);

  const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const authSession = readStoredAuth();
    const headers = new Headers(init.headers ?? {});
    if (authSession) {
      const authHeaders = buildAuthHeaders(authSession);
      authHeaders.forEach((value, key) => headers.set(key, value));
    }

    const response = await fetch(input, { ...init, headers });
    // Do not clear the applicant session on an individual API error. In particular, a
    // submit/validation 401/403 must be shown as an error, not look like a logout.
    return response;
  };

  useEffect(() => {
    setPincodeMessage('');
    if (!session || !/^[1-9][0-9]{5}$/.test(applicant.pincode)) return;
    const controller = new AbortController();
    const { pincode, city, state } = applicant;
    let timeout: number | undefined;
    const timer = window.setTimeout(async () => {
      setPincodeMessage('Looking up City and State...');
      try {
        let location = pincodeCacheRef.current.get(pincode);
        if (!location) {
          timeout = window.setTimeout(() => controller.abort(), 10000);
          const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Postal lookup unavailable.');
          const payload: unknown = await response.json();
          const result: unknown = Array.isArray(payload) ? payload[0] : null;
          const offices: unknown = result && typeof result === 'object'
            && 'Status' in result && result.Status === 'Success' && 'PostOffice' in result ? result.PostOffice : null;
          const office = Array.isArray(offices) ? offices.find((entry: unknown): entry is { District: string; State: string } =>
            entry !== null && typeof entry === 'object' && 'District' in entry && 'State' in entry
            && typeof entry.District === 'string' && Boolean(entry.District.trim())
            && typeof entry.State === 'string' && Boolean(entry.State.trim())) : null;
          if (!office) throw new Error('No postal location returned.');
          const matchedState = INDIA_STATES.find(value => value.toLowerCase() === office.State.toLowerCase());
          if (!matchedState) throw new Error('Postal State is not supported.');
          location = { city: office.District.trim(), state: matchedState };
          pincodeCacheRef.current.set(pincode, location);
        }
        if (controller.signal.aborted) return;
        const resolved = location;
        setApplicant(previous => previous.pincode !== pincode ? previous : {
          ...previous,
          city: previous.city === city ? resolved.city : previous.city,
          state: previous.state === state ? resolved.state : previous.state
        });
        setPincodeMessage('Postal City/district and State found. Please review; both remain editable.');
      } catch {
        if (!controller.signal.aborted || timeout !== undefined) {
          setPincodeMessage('City and State could not be looked up. Please enter them manually.');
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }, 500);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      timeout = undefined;
      controller.abort();
    };
  }, [applicant.pincode, applicationId, session]);

  const resetIdentity = () => {
    identityRequestRef.current?.abort();
    identityRequestRef.current = null;
    setIdentityType('');
    setIdentityPanNumber('');
    setIdentityFile(null);
    setIdentityConsent(false);
    setIdentityLoading(false);
    setIdentityError('');
    setIdentityUsingMock(false);
    setIdentityFetched({});
    if (identityFileRef.current) identityFileRef.current.value = '';
  };
  useEffect(() => () => identityRequestRef.current?.abort(), []);

  const identityValue = (key: IdentityField) =>
    key in initialApplicant
      ? String(applicant[key as keyof Applicant] || '')
      : applicant.additionalDetails?.[key] || '';
  const isIdentityFetched = (key: IdentityField) => Boolean(identityFetched[key] && identityFetched[key] === identityValue(key));
  const identityTag = (key: IdentityField) => isIdentityFetched(key)
    ? <small className="field-success identity-source-tag">Fetched from Aadhaar / PAN</small> : null;
  const identityFilledCount = (Object.keys(identityFetched) as IdentityField[]).filter(isIdentityFetched).length;

  const chooseIdentityFile = (files: FileList | null) => {
    setIdentityConsent(false);
    setIdentityError('');
    setIdentityFile(null);
    if (!files?.length) return;
    if (files.length !== 1) {
      setIdentityError('Please select one Aadhaar or PAN document.');
      return;
    }
    const error = validateIdentityFile(files[0]);
    if (error) setIdentityError(error);
    else setIdentityFile(files[0]);
    if (identityFileRef.current) identityFileRef.current.value = '';
  };

  const fetchIdentity = async () => {
    if (identityRequestRef.current) return;
    const number = identityType === 'PAN' ? identityPanNumber : applicant.additionalDetails?.aadhaarNumber || '';
    const error = validateIdentity(identityType, number, identityFile, identityConsent);
    setIdentityError(error);
    if (error) return;
    const controller = new AbortController();
    identityRequestRef.current = controller;
    setIdentityLoading(true);
    setIdentityUsingMock(false);
    const applicantAtFetch = applicant;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);
    try {
      let fields: IdentityFields;
      if (identityFile) {
        fields = await extractIdentityFromDocument(identityFile, identityType, controller.signal, {
          fullName: applicantAtFetch.fullName,
          dateOfBirth: applicantAtFetch.dateOfBirth
        });
      } else {
      const body = new FormData();
      body.append('documentType', identityType);
      body.append('consent', 'true');
        body.append('number', number);
        const response = await apiFetch('/api/kyc/identity', { method: 'POST', body, signal: controller.signal });
        if (controller.signal.aborted) throw new Error('Identity request cancelled.');
        if (!response.ok) {
          throw new Error(response.status === 401
          ? 'Your session expired. Please sign in again. Your entered details have not been cleared.'
          : response.status === 503
            ? 'Aadhaar/PAN identity fetching is currently unavailable. Please enter your details manually. Your entered details have not been cleared.'
            : 'Identity details could not be fetched. Please try again later or enter your details manually. Your entered details have not been cleared.');
        }
        fields = readIdentityFields(await response.json());
      }
      if (controller.signal.aborted && !timedOut) return;
      setApplicant(previous => {
        const next = { ...previous, additionalDetails: { ...previous.additionalDetails } };
        if (fields.fullName && previous.fullName === applicantAtFetch.fullName) {
          next.fullName = fields.fullName;
        }
        if (fields.dateOfBirth && previous.dateOfBirth === applicantAtFetch.dateOfBirth) {
          next.dateOfBirth = fields.dateOfBirth;
          next.additionalDetails.age = calculateAge(next.dateOfBirth);
        }
        for (const [key, value] of Object.entries(fields)) {
          if (key === 'fullName' || key === 'dateOfBirth') continue;
          if (key in initialApplicant && key !== 'additionalDetails') {
            // Do not overwrite manual edits made while extraction was in flight.
            if (Reflect.get(previous, key) === Reflect.get(applicantAtFetch, key)) {
              Object.assign(next, { [key]: value });
            }
          } else if (previous.additionalDetails?.[key] === applicantAtFetch.additionalDetails?.[key]) {
            next.additionalDetails[key] = value;
          }
        }
        if (fields.permanentAddress && next.additionalDetails.permanentAddress === fields.permanentAddress
          && fields.permanentAddress !== next.residentialAddress
          && previous.additionalDetails?.sameAsCurrentAddress === applicantAtFetch.additionalDetails?.sameAsCurrentAddress) {
          next.additionalDetails.sameAsCurrentAddress = 'false';
        }
        return next;
      });
      setIdentityFetched(previous => ({ ...previous, ...fields }));
    } catch (error) {
      if (timedOut && identityRequestRef.current === controller) {
        setIdentityError('Identity fetching took too long. Please retry or enter your details manually. Your entered details have not been cleared.');
      } else if (!controller.signal.aborted) {
        setIdentityError(error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError)
          ? error.message : 'Identity details could not be fetched. Please try again later or enter your details manually. Your entered details have not been cleared.');
      }
    } finally {
      window.clearTimeout(timeout);
      if (identityRequestRef.current === controller) {
        identityRequestRef.current = null;
        setIdentityLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!session) {
      return;
    }
    if (session.role === 'USER' && session.mobile) {
      if (autoResumeAttemptedRef.current === session.mobile) return;
      autoResumeAttemptedRef.current = session.mobile;
      setShowUserDashboard(true);
      setApplicant((previous) => ({ ...previous, mobileNumber: session.mobile || previous.mobileNumber }));
      void resumeDraftOnLogin(session.mobile);
      return;
    }
    fetchApplications();
  }, [session]);

  const restoreLocalDraft = (draft: LocalDraftSnapshot, mobile: string) => {
    resetIdentity();
    const step = clampStep(draft.currentStep) || 1;
    setApplicationId(draft.applicationId ?? null);
    localDraftIdRef.current = draft.applicationId ? null : draft.localDraftId ?? null;
    setLocalDraftId(localDraftIdRef.current);
    setApplicant({ ...initialApplicant, ...draft.applicant, mobileNumber: mobile, additionalDetails: { ...initialApplicant.additionalDetails, ...(draft.applicant?.additionalDetails || {}) } });
    setApplicantMobileError('');
    setEmployment({ ...initialEmployment, ...draft.employment, additionalDetails: { ...initialEmployment.additionalDetails, ...(draft.employment?.additionalDetails || {}) } });
    setLoanDetails({ ...initialLoanDetails, ...draft.loanDetails, additionalDetails: { ...initialLoanDetails.additionalDetails, ...(draft.loanDetails?.additionalDetails || {}) } });
    if (draft.loanDetails?.loanType) setNewApplicationLoanType(draft.loanDetails.loanType);
    setIdentityType(draft.identityType || '');
    setIdentityPanNumber(draft.identityPanNumber || '');
    setIdentityConsent(Boolean(draft.identityConsent));
    setIdentityFetched(draft.identityFetched || {});
    setCreditMode(draft.creditMode === 'ONLINE' ? 'ONLINE' : 'MANUAL');
    setManualCreditScore(draft.manualCreditScore || '');
    setCreditScore(draft.creditScore ?? null);
    setCreditUsingMock(false);
    setStatus('DRAFT');
    setSubmittedApplication(null);
    setStaffApplicationOpen(true);
    setCurrentStep(step);
    setHighestUnlockedStep(Math.max(step, clampStep(draft.highestUnlockedStep) || 1));
    setShowUserDashboard(false);
    setSaveIndicator(draft.applicationId ? 'Restored saved draft' : 'Restored local draft — not yet saved to the backend');
    setValidationMessage('');
  };

  const resumeDraftOnLogin = async (mobile: string) => {
    try {
      const rows = await fetchApplications();
      if (autoResumeAttemptedRef.current !== mobile) return;
      const local = readLoanDraft<LocalDraftSnapshot>(mobile);
      if (local) {
        const linked = local.applicationId && rows ? rows.find(row => row.id === local.applicationId) : undefined;
        if (local.applicationId && linked && !ACTIVE_DRAFT_STATUSES.includes(linked.status)) {
          clearLoanDraft(mobile);
        } else {
          // Keep the linked ID when the backend is unreachable; if the backend no longer knows it (e.g. a reset local DB), restore as a new unsaved draft.
          const restoredApplicationId = local.applicationId && (linked || rows === null) ? local.applicationId : null;
          restoreLocalDraft({ ...local, applicationId: restoredApplicationId }, mobile);
          if (restoredApplicationId) await fetchDocuments(restoredApplicationId);
          return;
        }
      }
      const latestActive = (rows || [])
        .filter(row => ACTIVE_DRAFT_STATUSES.includes(row.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (latestActive) await handleOpenApplication(latestActive.id);
    } finally {
      if (autoResumeAttemptedRef.current === mobile) draftHydratedRef.current = mobile;
    }
  };

  useEffect(() => {
    if (!session || status === 'SUBMITTED' || status === 'APPROVED' || status === 'REJECTED') return;
    let cancelled = false;
    apiFetch(`/api/pricing/${encodeURIComponent(loanDetails.loanType)}`)
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.message || 'Loan pricing could not be loaded.');
        if (!cancelled) {
          setLoanDetails((previous) => ({
            ...previous,
            interestRate: resolveInterestRate(previous.loanType,
              previous.loanType === 'PERSONAL_LOAN' && (result.interestRate == null || String(result.interestRate).trim() === '' || Number(result.interestRate) === 0)
                ? previous.interestRate
                : result.interestRate ?? previous.interestRate)
          }));
          setPricingPolicy({ minAmount: Number(result.minAmount ?? result.minLoanAmount) || undefined, maxAmount: Number(result.maxAmount ?? result.maxLoanAmount) || undefined, minTenure: Number(result.minTenure ?? result.minTenureMonths) || undefined, maxTenure: Number(result.maxTenure ?? result.maxTenureMonths) || undefined, processingFeePercent: Number(result.processingFeePercent ?? 0), gstPercent: Number(result.gstPercent ?? 0), insurancePremium: Number(result.insurancePremium ?? 0), rateType: String(result.rateType || "REDUCING_BALANCE") });
        }
      })
      .catch(error => {
        if (!cancelled) console.error('Loan pricing could not be loaded; retaining the current rate or Personal Loan default.', error);
      });
    return () => { cancelled = true; };
  }, [session, loanDetails.loanType, applicationId, status]);

  const fetchApplications = async (): Promise<ApplicationRow[] | null> => {
    try {
      const response = await apiFetch('/api/applications');
      if (response.ok) {
        const data = await response.json();
        setApplications(data);
        return Array.isArray(data) ? data : [];
      }
      setApplications([]);
      return null;
    } catch {
      setApplications([]);
      return null;
    }
  };

  const fetchDocuments = async (id: number) => {
    setDocuments(createInitialDocuments());
    setSelectedFiles(Object.fromEntries(Object.keys(createInitialDocuments()).map((key) => [key, ''])) as Record<DocumentType, string>);
    try {
      const response = await apiFetch(`/api/applications/${id}/documents`);
      if (!response.ok) {
        setDocuments(createInitialDocuments());
        return;
      }
      const rows = await response.json();
      const next = createInitialDocuments();
      rows.forEach((item: any) => {
        const key = item.documentType as DocumentType;
        if (key in next) {
          next[key] = {
            id: item.id,
            documentType: key,
            documentName: item.documentName || next[key].documentName,
            status: item.status || 'UPLOADED',
            fileName: item.fileName || null,
            fileSize: item.fileSize || null,
            uploadedAt: item.uploadedAt || null,
            error: null,
            verificationRemarks: item.verificationRemarks || null
          };
          setSelectedFiles((prev) => ({ ...prev, [key]: item.fileName || prev[key] || '' }));
        }
      });
      setDocuments(next);
    } catch {
      setDocuments(createInitialDocuments());
    }
  };
  const optionalNumber = (value: string | number | null | undefined) => value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
  const effectiveInterestRate = resolveInterestRate(loanDetails.loanType, loanDetails.interestRate);

  const buildApplicationPayload = () => ({
    applicant: {
      ...applicant,
      dateOfBirth: applicant.dateOfBirth || null,
      additionalDetails: {
        ...applicant.additionalDetails,
        identityFetchedFields: JSON.stringify(identityFetched),
        ...(session?.role === 'USER' ? { draftCurrentStep: String(currentStep) } : {})
      }
    },
    employment: {
      ...employment,
      totalWorkExperienceYears: optionalNumber(employment.totalWorkExperienceYears),
      currentEmployerExperienceYears: optionalNumber(employment.currentEmployerExperienceYears),
      monthlyInHandSalary: optionalNumber(employment.monthlyInHandSalary),
      monthlyGrossSalary: optionalNumber(employment.monthlyGrossSalary)
    },
    loanDetails: {
      ...loanDetails,
      interestRate: effectiveInterestRate,
      requestedLoanAmount: optionalNumber(loanDetails.requestedLoanAmount),
      preferredTenure: optionalNumber(loanDetails.preferredTenure),
      purposeOfLoan: loanDetails.purposeOfLoan || null,
      additionalDetails: {
        ...(loanDetails.additionalDetails || {}),
        processingFees: String(calculatedFees.processing),
        gstOnFees: String(calculatedFees.gst),
        insuranceCharges: String(calculatedFees.insurance),
        netDisbursal: String(calculatedFees.net)
      }
    }
  });

  const ensureApplication = async () => {
    if (applicationId) {
      return applicationId;
    }
    const mobileError = validateMobileNumber(applicant.mobileNumber);
    if (mobileError) {
      throw new Error(mobileError);
    }
    if (applicationCreationRef.current) {
      return applicationCreationRef.current;
    }

    setIsCreatingApplication(true);
    setValidationMessage('Creating application...');
    const creation = (async () => {
      const app = await withDevelopmentTimeout(async signal => {
        const response = await apiFetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildApplicationPayload()),
          signal
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw creditServiceError(response.status, describeApiError(result, 'Application creation failed'));
        return result;
      }, import.meta.env.DEV);
      if (!app?.id) {
        throw new Error('Application was saved without a valid application ID. Please retry.');
      }
      setApplicationId(app.id);
      localDraftIdRef.current = null;
      setLocalDraftId(null);
      setHighestUnlockedStep(1);
      if (app.loanDetails?.loanType) setNewApplicationLoanType(app.loanDetails.loanType);
      setShowUserDashboard(false);
      if (app.loanDetails?.interestRate !== undefined && app.loanDetails?.interestRate !== null) {
        setLoanDetails((previous) => ({ ...previous, interestRate: app.loanDetails.interestRate }));
      }
      setStatus(app.status || 'DRAFT');
      setSaveIndicator(`Temporary ID: DRAFT-${app.id}`);
      setValidationMessage('');
      void fetchApplications();
      return app.id as number;
    })();
    applicationCreationRef.current = creation;
    try {
      return await creation;
    } finally {
      applicationCreationRef.current = null;
      setIsCreatingApplication(false);
      setValidationMessage(message => message === 'Creating application...' ? '' : message);
    }
  };

  const ensureCreditApplication = async () => {
    if (import.meta.env.DEV && localDraftIdRef.current && !applicationId) return null;
    try {
      return await ensureApplication();
    } catch (error) {
      if (!canUseLocalCreditFallback(error, import.meta.env.DEV)) throw error;
      console.warn('Draft creation unavailable; using a local-only credit-step draft.', error);
      const id = localDraftIdRef.current || `APP-DRAFT-${crypto.randomUUID()}`;
      localDraftIdRef.current = id;
      setLocalDraftId(id);
      setSaveIndicator('Local-only draft — not saved to the backend');
      setValidationMessage(message => message === 'Creating application...' ? '' : message);
      return null;
    }
  };

  const handleOpenApplication = async (id: number) => {
    resetIdentity();
    try {
      const response = await apiFetch(`/api/applications/${id}`);
      const app = await response.json().catch(() => null);
      if (!response.ok || !app) {
        throw new Error(app?.message || 'Application could not be loaded.');
      }
      setApplicationId(app.id);
      localDraftIdRef.current = null;
      setLocalDraftId(null);
      setCreditUsingMock(false);
      setHighestUnlockedStep(1);
      if (app.loanDetails?.loanType) setNewApplicationLoanType(app.loanDetails.loanType);
      setShowUserDashboard(false);
      setSaveIndicator(app.status === 'DRAFT' ? 'Saved draft' : '');
      setApplicant({
        fullName: app.applicant.fullName || '',
        dateOfBirth: app.applicant.dateOfBirth || '',
        panNumber: app.applicant.panNumber || '',
        mobileNumber: app.applicant.mobileNumber || session?.mobile || '',
        email: app.applicant.email || '',
        workEmail: app.applicant.workEmail || '',
        residentialAddress: app.applicant.residentialAddress || '',
        city: app.applicant.city || '',
        state: app.applicant.state || '',
        pincode: app.applicant.pincode || '',
        additionalDetails: { ...initialApplicant.additionalDetails, ...(app.applicant.additionalDetails || {}) }
      });
      const savedIdentityFields = app.applicant.additionalDetails?.identityFetchedFields;
      if (savedIdentityFields && savedIdentityFields !== '{}') {
        try {
          setIdentityFetched(readIdentityFields({ fields: JSON.parse(savedIdentityFields) }));
        } catch {
          setIdentityError('Saved identity source tags could not be restored. Your applicant details are still available; please review them.');
        }
      }
      setApplicantMobileError(validateMobileNumber(app.applicant.mobileNumber));
      setEmployment({
        employmentType: app.employmentDetails.employmentType,
        employerName: app.employmentDetails.employerName || '',
        designation: app.employmentDetails.designation || '',
        totalWorkExperienceYears: app.employmentDetails.totalWorkExperienceYears ?? '',
        currentEmployerExperienceYears: app.employmentDetails.currentEmployerExperienceYears ?? '',
        monthlyInHandSalary: app.employmentDetails.monthlyInHandSalary ?? '',
        monthlyGrossSalary: app.employmentDetails.monthlyGrossSalary ?? '',
        additionalDetails: { ...initialEmployment.additionalDetails, ...(app.employmentDetails.additionalDetails || {}) }
      });
      setLoanDetails({
        loanType: app.loanDetails.loanType || 'PERSONAL_LOAN',
        requestedLoanAmount: app.loanDetails.requestedLoanAmount ?? '',
        interestRate: app.loanDetails.interestRate ?? '',
        preferredTenure: app.loanDetails.preferredTenure,
        purposeOfLoan: app.loanDetails.purposeOfLoan || '',
        additionalDetails: { ...initialLoanDetails.additionalDetails, ...(app.loanDetails.additionalDetails || {}) }
      });
      setStaffApplicationOpen(true);
      setCreditScore(app.creditCheck?.creditScore ?? null);
      setManualCreditScore(app.applicant?.additionalDetails?.selfReportedCreditScore || '');
      setCreditMode(app.applicant?.additionalDetails?.creditScoreMode === 'ONLINE' ? 'ONLINE' : 'MANUAL');
      setStatus(app.status);
      setSubmittedApplication(app.status === 'SUBMITTED' ? app : null);
      const defaultStep = app.status === 'SUBMITTED' ? 5 : app.creditCheck ? 4 : 1;
      const localResume = session?.role === 'USER' ? readLoanDraft<LocalDraftSnapshot>(session.mobile) : null;
      const resumeStep = session?.role === 'USER' && ACTIVE_DRAFT_STATUSES.includes(app.status)
        ? clampStep(localResume && localResume.applicationId === app.id ? localResume.currentStep : app.applicant?.additionalDetails?.draftCurrentStep)
        : 0;
      setCurrentStep(resumeStep || defaultStep);
      setHighestUnlockedStep(Math.max(resumeStep, defaultStep));
      setValidationMessage('');
      await fetchDocuments(app.id);
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Application could not be loaded.');
    }
  };



  const filteredRows = useMemo(() => {
    return applications.filter((row) => {
      const normalizedSearch = search.toLowerCase();
      const matchesSearch = !search || (row.applicantName || '').toLowerCase().includes(normalizedSearch)
        || (row.losNumber ?? '').toLowerCase().includes(normalizedSearch)
        || (row.applicantMobile ?? '').includes(normalizedSearch);
      const matchesStatus = filterStatus === 'ALL' || row.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [applications, search, filterStatus]);

  const loanValidationMessage = useMemo(() => {
    const principal = parseNumericValue(loanDetails.requestedLoanAmount);
    const interestRate = parseNumericValue(effectiveInterestRate);
    const tenure = parseNumericValue(loanDetails.preferredTenure);

    if (!Number.isFinite(principal) || principal <= 0) {
      return 'Loan amount must be greater than zero.';
    }
    if (!Number.isFinite(interestRate) || interestRate < 0) {
      return 'Interest rate is required and cannot be negative.';
    }
    if (interestRate > MAX_INTEREST_RATE) {
      return `Interest rate must be at or below ${MAX_INTEREST_RATE}% p.a.`;
    }
    if (!Number.isFinite(tenure) || tenure <= 0 || !Number.isInteger(tenure)) {
      return 'Preferred tenure must be a valid whole number of months.';
    }
    if (pricingPolicy.minAmount && principal < pricingPolicy.minAmount) return 'Loan amount is below the product minimum.';
    if (pricingPolicy.maxAmount && principal > pricingPolicy.maxAmount) return 'Loan amount exceeds the product maximum.';
    const increment = ['HOME_LOAN', 'CAR_LOAN', 'VEHICLE_LOAN', 'LOAN_AGAINST_PROPERTY'].includes(loanDetails.loanType) ? 10000 : 1000;
    if (principal % increment !== 0) return `Loan amount must be a multiple of ₹${increment.toLocaleString('en-IN')}.`;
    if (pricingPolicy.minTenure && tenure < pricingPolicy.minTenure) return 'Tenure is below the product minimum.';
    if (pricingPolicy.maxTenure && tenure > pricingPolicy.maxTenure) return 'Tenure exceeds the product maximum.';
    return '';
  }, [loanDetails.requestedLoanAmount, effectiveInterestRate, loanDetails.preferredTenure, loanDetails.loanType, pricingPolicy]);
  const calculatedFees = useMemo(() => {
    const amount = Math.max(0, Number(loanDetails.requestedLoanAmount) || 0);
    const processing = Math.round(amount * (pricingPolicy.processingFeePercent || 0) / 100 * 100) / 100;
    const gst = Math.round(processing * (pricingPolicy.gstPercent || 0) / 100 * 100) / 100;
    const insurance = pricingPolicy.insurancePremium || 0;
    return { processing, gst, insurance, total: processing + gst + insurance, net: Math.max(0, amount - processing - gst - insurance) };
  }, [loanDetails.requestedLoanAmount, pricingPolicy]);
  const loanExtraValidationMessage = useMemo(() => { const fields = [['Processing fees', loanDetails.additionalDetails?.processingFees], ['GST on fees', loanDetails.additionalDetails?.gstOnFees], ['Insurance charges', loanDetails.additionalDetails?.insuranceCharges]]; for (const [name, value] of fields) { if (value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) return `${name} must be zero or greater.`; } const charges = Number(loanDetails.additionalDetails?.processingFees || 0) + Number(loanDetails.additionalDetails?.gstOnFees || 0) + Number(loanDetails.additionalDetails?.insuranceCharges || 0); if (charges > Number(loanDetails.requestedLoanAmount || 0)) return 'Total fees and charges cannot exceed the requested loan amount.'; const scheduled = loanDetails.additionalDetails?.scheduledDisbursalDate; if (scheduled && scheduled < new Date().toISOString().slice(0,10)) return 'Scheduled disbursal date cannot be in the past.'; return ''; }, [loanDetails.additionalDetails]);

  const emiSummary = useMemo(() => {
    if (loanValidationMessage) {
      return null;
    }

    const principal = parseNumericValue(loanDetails.requestedLoanAmount);
    const interestRate = parseNumericValue(effectiveInterestRate);
    const tenure = parseNumericValue(loanDetails.preferredTenure);

    if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(interestRate) || interestRate < 0 || !Number.isFinite(tenure) || tenure <= 0 || !Number.isInteger(tenure)) {
      return null;
    }

    const monthlyEmi = calculateEmi(principal, interestRate, tenure);
    const totalPayable = monthlyEmi * tenure;
    const totalInterest = totalPayable - principal;

    return {
      principal,
      interestRate,
      tenure,
      monthlyEmi,
      totalInterest,
      totalPayable
    };
  }, [loanDetails.requestedLoanAmount, effectiveInterestRate, loanDetails.preferredTenure, loanValidationMessage]);

  const handleSaveDraft = async (silent = false) => {
    persistLocalDraft();
    if (silent && import.meta.env.DEV && localDraftIdRef.current && !applicationId) return;
    try {
      const mobileError = validateMobileNumber(applicant.mobileNumber);
      if (mobileError) {
        if (silent) return;
        setApplicantMobileError(mobileError);
        setValidationMessage(mobileError);
        return;
      }
      const id = await ensureApplication();
      const response = await apiFetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApplicationPayload())
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (silent) return;
        throw new Error(describeApiError(result, 'Draft could not be saved.'));
      }
      setStatus(result?.status || status);
      setSaveIndicator('Saved just now');
      setValidationMessage('');
      await fetchApplications();
    } catch (error) {
      if (silent) return;
      setValidationMessage(error instanceof Error ? error.message : 'Draft could not be saved.');
    }
  };

  const handleRunCreditCheck = async () => {
    if (isCheckingCredit) return;
    if (creditMode !== 'ONLINE') { setValidationMessage('Select Check Online to request a bureau credit score.'); return; }
    if (applicant.additionalDetails?.kycBureauConsent !== 'true') { setValidationMessage('Please provide consent before requesting a bureau enquiry.'); return; }
    setIsCheckingCredit(true);
    setKycMessage('Connecting to KYC provider and fetching credit bureau details…');
    try {
      const mobileError = validateMobileNumber(applicant.mobileNumber);
      if (mobileError) throw new Error(mobileError);
      const id = await ensureCreditApplication();
      if (id === null) throw new CreditServiceUnavailableError('The draft is local-only.');
      const data = await withDevelopmentTimeout(async signal => {
        const saveResponse = await apiFetch(`/api/applications/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildApplicationPayload()), signal
        });
        const saved = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok) throw creditServiceError(saveResponse.status, saved.message || 'Save the application before running a credit check.');
        const kycVerified = await handleStartKyc(id, signal);
        if (!kycVerified) throw new Error('KYC verification did not complete successfully. The credit bureau enquiry was not started.');
        const response = await apiFetch(`/api/applications/${id}/credit-check`, { method: 'POST', signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw creditServiceError(response.status, result?.message || 'Credit check failed.');
        const score = result.creditCheck?.creditScore;
        if (!Number.isInteger(score) || score < 300 || score > 900) {
          throw new CreditServiceUnavailableError('The bureau did not return a valid credit score.');
        }
        return result;
      }, import.meta.env.DEV);
      setCreditScore(data.creditCheck?.creditScore ?? null);
      setCreditUsingMock(false);
      setStatus(data.status || 'CREDIT_CHECK_COMPLETED');
      setCurrentStep(3);
      setValidationMessage(`Credit check result saved to application ${data.losNumber || id}.`);
      void fetchApplications();
    } catch (error) {
      if (canUseLocalCreditFallback(error, import.meta.env.DEV)) {
        console.warn('Credit service unavailable; displaying an unverified local-development score.', error);
        setCreditScore(750);
        setCreditUsingMock(true);
        setKycMessage('Local-development mock score only. This does not verify KYC or save a bureau result.');
        setValidationMessage('');
      } else {
        setValidationMessage(error instanceof Error ? error.message : 'Credit check failed.');
      }
    } finally {
      setIsCheckingCredit(false);
    }
  };

  const handleStartKyc = async (id: number, signal?: AbortSignal) => {
    try {
      const response = await apiFetch(`/api/applications/${id}/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationType: 'PAN_VERIFICATION', panNumber: applicant.panNumber, provider: 'SIGNZY', mockMode: mockKycMode }),
        signal
      });
      const data = await response.json();
      signal?.throwIfAborted();
      if (!response.ok) {
        throw creditServiceError(response.status, data?.message || 'KYC initiation failed');
      }
      const nextStatus = data.status || 'PENDING';
      const mappedStatus = nextStatus === 'VERIFIED' ? 'Verified' : nextStatus === 'MANUAL_REVIEW' ? 'Manual Review' : nextStatus === 'FAILED' ? 'Failed' : 'In Progress';
      const message = nextStatus === 'VERIFIED'
        ? 'KYC verification passed.'
        : nextStatus === 'FAILED'
          ? 'KYC verification failed. Please retry or raise for manual review.'
          : nextStatus === 'MANUAL_REVIEW'
            ? 'KYC requires manual review.'
            : 'KYC verification in progress.';
      setKycStatus(mappedStatus);
      setKycMessage(message);
      return nextStatus === 'VERIFIED';
    } catch (error) {
      if (signal?.aborted) throw error;
      if (signal && canUseLocalCreditFallback(error, import.meta.env.DEV)) throw error;
      const message = error instanceof Error ? error.message : 'KYC could not be started.';
      setKycStatus('Failed');
      setKycMessage(message);
      return false;
    }
  };

  // Consent is recorded on change; bureau calls occur ONLY when Check Online is clicked.
  useEffect(() => {
    if (currentStep === 3 && (session?.role === 'USER' || staffApplicationOpen) && !applicationId && !localDraftId && !isCreatingApplication) {
      void ensureCreditApplication().catch(error => setValidationMessage(error instanceof Error ? error.message : 'Unable to create temporary application ID.'));
    }
  }, [currentStep, applicationId, localDraftId, session?.role, staffApplicationOpen]);
  const employmentChecklist = DOCUMENTS_BY_EMPLOYMENT[employment.employmentType] || REQUIRED_DOCUMENTS;
  const loanSpecificDocuments: Array<{key: DocumentType; label: string; required: boolean}> = (loanDetails.loanType === 'HOME_LOAN' || loanDetails.loanType === 'LOAN_AGAINST_PROPERTY') ? [{key:'PROPERTY_DOCUMENTS',label:'Property documents (title deed, sale agreement, approved plan, valuation, tax receipt)',required:true}] : loanDetails.loanType === 'CAR_LOAN' ? [{key:'VEHICLE_DOCUMENTS',label:'Vehicle quotation / proforma invoice and insurance',required:true}] : loanDetails.loanType === 'EDUCATION_LOAN' ? [{key:'EDUCATION_DOCUMENTS',label:'Admission letter, fee structure and education records',required:true}] : [];
  const isCoApplicantIncluded = applicant.additionalDetails?.coApplicantRequired === 'true';
  const isGuarantorIncluded = loanDetails.additionalDetails?.guarantorRequired === 'true';
  const coApplicantDocuments = isCoApplicantIncluded && applicant.additionalDetails?.coApplicantName?.trim() ? [{key:'COAPPLICANT_PAN' as DocumentType,label:'Co-applicant PAN',required:true},{key:'COAPPLICANT_KYC' as DocumentType,label:'Co-applicant KYC / Aadhaar document',required:true},{key:'COAPPLICANT_BANK_STATEMENT' as DocumentType,label:'Co-applicant bank statement (if earning)',required:applicant.additionalDetails?.coApplicantType === 'Earning'},{key:'COAPPLICANT_PHOTOGRAPH' as DocumentType,label:'Co-applicant photograph',required:true},{key:'COAPPLICANT_SIGNATURE' as DocumentType,label:'Co-applicant signature / e-sign',required:true}] : [];
  const guarantorDocuments = isGuarantorIncluded && applicant.additionalDetails?.guarantorName?.trim() ? [{key:'GUARANTOR_PAN' as DocumentType,label:'Guarantor PAN',required:true},{key:'GUARANTOR_KYC' as DocumentType,label:'Guarantor KYC / Aadhaar document',required:true},{key:'GUARANTOR_BANK_STATEMENT' as DocumentType,label:'Guarantor bank statement',required:true},{key:'GUARANTOR_PHOTOGRAPH' as DocumentType,label:'Guarantor photograph',required:true},{key:'GUARANTOR_SIGNATURE' as DocumentType,label:'Guarantor signature / e-sign',required:true}] : [];
  const guarantorEnabled = isGuarantorIncluded;
  const guarantorValidationMessage = (() => {
    if (!guarantorEnabled) return '';
    const details = applicant.additionalDetails || {};
    const requiredFields: Array<[string, string]> = [
      ['Name', details.guarantorName],
      ['Relationship', details.guarantorRelationship],
      ['PAN', details.guarantorPan],
      ['Mobile', details.guarantorMobile],
      ['Email', details.guarantorEmail],
      ['Address', details.guarantorAddress],
      ['KYC/Bureau Consent', details.guarantorConsent === 'true' ? 'true' : ''],
      ['Date of Birth', details.guarantorDob],
      ['Gender', details.guarantorGender],
      ["Father's / Spouse Name", details.guarantorFatherSpouse],
      ["Mother's Name", details.guarantorMother],
      ['Marital Status', details.guarantorMaritalStatus],
      ['Nationality', details.guarantorNationality],
      ['Aadhaar / KYC Document', details.guarantorKycDocument],
      ['Alternate ID Type', details.guarantorAlternateIdType],
      ['Alternate ID Number', details.guarantorAlternateIdNumber],
      ['Current Address', details.guarantorCurrentAddress],
      ['Permanent Address', details.guarantorPermanentAddress],
      ['City', details.guarantorCity],
      ['State', details.guarantorState],
      ['PIN Code', details.guarantorPincode],
      ['Residence Type', details.guarantorResidenceType],
      ['Years at Address', details.guarantorYearsAtAddress],
      ['Employer / Business', details.guarantorEmployer],
      ['Designation / User Type', details.guarantorDesignation],
      ['Years in Job / Business', details.guarantorExperience],
      ['Monthly Income', details.guarantorMonthlyIncome],
      ['Annual Income', details.guarantorAnnualIncome],
      ['Other Income', details.guarantorOtherIncome],
      ['Account Holder', details.guarantorAccountHolder],
      ['Bank Account', details.guarantorAccountNumber],
      ['IFSC', details.guarantorIfsc],
      ['Bank Name', details.guarantorBank],
      ['Branch', details.guarantorBranch],
      ['Account Type', details.guarantorAccountType]
    ];
    const missingFields = requiredFields.filter(([, value]) => !value?.trim()).map(([label]) => label);
    if (missingFields.length) return `Complete all required guarantor fields: ${missingFields.join(', ')}.`;
    if (!validName(details.guarantorName || '')) return 'Guarantor name must contain letters only.';
    if (!validPan(details.guarantorPan || '')) return 'Guarantor PAN should look like ABCDE1234F.';
    if (!/^\d{10}$/.test(details.guarantorMobile || '')) return 'Guarantor mobile must contain 10 digits.';
    if (!validEmail(details.guarantorEmail || '')) return 'Enter a valid guarantor email address.';
    if (!/^[1-9][0-9]{5}$/.test(details.guarantorPincode || '')) return 'Guarantor PIN code must be a valid 6-digit Indian PIN code.';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(details.guarantorIfsc || '')) return 'Guarantor IFSC must be 11 characters, e.g. ABCD0123456.';
    return '';
  })();
  const employmentValidationMessage = (() => {
    if (!employment.employmentType) return 'Select an employment type.';
    const extra = employment.additionalDetails || {};
    const requiredFields: Array<[string, string | number]> = [
      ['Total Experience / Years in Profession', employment.totalWorkExperienceYears],
      ['Monthly Net Income', employment.monthlyInHandSalary],
      ['Monthly Gross Salary', employment.monthlyGrossSalary]
    ];
    if (employment.employmentType === 'SALARIED') {
      requiredFields.push(
        ['Employer Name', employment.employerName],
        ['Designation', employment.designation],
        ['Current Employer Experience', employment.currentEmployerExperienceYears],
        ['Employer Address', extra.employerAddress],
        ['Official Email', extra.officialEmail],
        ['Employee ID', extra.employeeId],
        ['Employment Contract Type', extra.employmentContractType],
        ['Employer Category', extra.employerCategory],
        ['Annual Income / CTC', extra.totalAnnualIncome],
        ['Salary Credit Mode', extra.salaryCreditMode]
      );
    } else if (employment.employmentType === 'SELF_EMPLOYED') {
      requiredFields.push(
        ['Profession', extra.profession],
        ['Professional Qualification', extra.qualification],
        ['Practice / Business Name', extra.practiceBusinessName],
        ['Constitution', extra.constitution],
        ['Registration Number', extra.registrationNumber],
        ['Practice Vintage', extra.practiceVintage],
        ['Years in Profession', extra.yearsInProfession],
        ['Business Address', extra.businessAddress],
        ['Nature of Work', extra.natureOfWork],
        ['Gross Receipts (annual)', extra.grossReceipts],
        ['Net Profit / Income', extra.netProfit]
      );
    } else {
      requiredFields.push(
        ['Business Name', extra.practiceBusinessName],
        ['Business PAN', extra.businessPan],
        ['Constitution', extra.constitution],
        ['Nature of Business', extra.natureOfWork],
        ['Industry', extra.industry],
        ['Business / Registered Address', extra.registeredAddress],
        ['Incorporation / Start Date', extra.incorporationDate],
        ['Registration Number', extra.registrationNumber],
        ['Premises', extra.premises],
        ['Business Phone', extra.businessPhone],
        ['Business Email', extra.businessEmail],
        ['Number of Employees', extra.employeeCount],
        ['Owners / Partners / Directors', extra.ownersPartnersDirectors],
        ['Authorised Signatory', extra.authorizedSignatory],
        ['Relationship with Applicant', extra.relationshipToApplicant],
        ['Annual Turnover', extra.annualTurnover],
        ['Gross Receipts', extra.grossReceipts],
        ['Net Profit / Income', extra.netProfit],
        ['Monthly Average Turnover', extra.monthlyAverageTurnover],
        ['Net Worth', extra.netWorth],
        ['GST Registered?', extra.gstRegistered],
        ['GST Return Filing Status', extra.gstFilingStatus],
        ['ITR Acknowledgement Number', extra.itrNumber],
        ['Existing Loans / Obligations', extra.existingLoans]
      );
      if (extra.gstRegistered === 'Yes') requiredFields.push(['GSTIN', extra.gstin]);
    }
    const missing = requiredFields.find(([, value]) => String(value ?? '').trim() === '');
    if (missing) return `${missing[0]} is required.`;
    if (Number(employment.monthlyInHandSalary) <= 0) return 'Monthly net income must be greater than zero.';
    const nonNegativeValues: Array<string | number | undefined> = [
      employment.totalWorkExperienceYears,
      employment.monthlyGrossSalary
    ].filter(value => value !== undefined && value !== '');
    if (employment.employmentType === 'SALARIED') {
      nonNegativeValues.push(employment.currentEmployerExperienceYears, extra.totalAnnualIncome);
    } else if (employment.employmentType === 'SELF_EMPLOYED') {
      nonNegativeValues.push(extra.yearsInProfession, extra.grossReceipts, extra.netProfit);
    } else {
      nonNegativeValues.push(extra.employeeCount, extra.grossReceipts, extra.netProfit, extra.monthlyAverageTurnover, extra.netWorth);
    }
    if (nonNegativeValues.some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) return 'Employment and income amounts and experience must be zero or greater.';
    if (employment.employmentType === 'BUSINESS_OWNER' && !validPan(extra.businessPan || '')) return 'Business PAN should look like ABCDE1234F.';
    const emailValues = employment.employmentType === 'SALARIED' ? [extra.officialEmail] : employment.employmentType === 'BUSINESS_OWNER' ? [extra.businessEmail] : [];
    if (emailValues.some(value => !validEmail(value || ''))) return 'Enter a valid employment email address.';
    if (employment.employmentType === 'BUSINESS_OWNER' && !/^\d{10}$/.test(extra.businessPhone || '')) return 'Business phone must contain 10 digits.';
    return '';
  })();
  const requiredDocuments = [...employmentChecklist, {key:'ADDRESS_PROOF' as DocumentType,label:'Address proof (approved document)',required:true}, {key:'EXISTING_LOAN_STATEMENTS' as DocumentType,label:'Existing loan statements / sanction letters (if applicable)',required:false}, ...(employment.employmentType === 'BUSINESS_OWNER' ? [{key:'BUSINESS_FINANCIALS' as DocumentType,label:'Balance sheet and profit & loss statements',required:true}] : []), ...loanSpecificDocuments, ...coApplicantDocuments, ...guarantorDocuments];
  const missingDocuments = requiredDocuments.filter((doc) => doc.required && documents[doc.key].status !== 'VERIFIED');
  const requiredDocumentsNotUploaded = requiredDocuments.filter(doc => doc.required && !['UPLOADED','UNDER_REVIEW','VERIFIED'].includes(documents[doc.key].status));
  const continueDisabledReason = currentStep === 1 && (!applicant.fullName || !validName(applicant.fullName) || !applicant.dateOfBirth || !validPan(applicant.panNumber) || !validEmail(applicant.email) || !applicant.workEmail || !validEmail(applicant.workEmail) || !/^[1-9][0-9]{5}$/.test(applicant.pincode) || (isCoApplicantIncluded && (!applicant.additionalDetails?.coApplicantName?.trim() || (applicant.additionalDetails?.coApplicantPan && !validPan(applicant.additionalDetails.coApplicantPan)) || (applicant.additionalDetails?.coApplicantEmail && !validEmail(applicant.additionalDetails.coApplicantEmail))))) ? 'Complete required applicant and contact fields first.' : currentStep === 1 && employmentValidationMessage ? employmentValidationMessage : currentStep === 1 && guarantorEnabled && guarantorValidationMessage ? guarantorValidationMessage : currentStep === 2 && (loanValidationMessage || loanExtraValidationMessage) ? (loanValidationMessage || loanExtraValidationMessage) : currentStep === 3 && (applicant.additionalDetails?.kycBureauConsent !== 'true' || (creditMode === 'ONLINE' ? creditScore === null || isCheckingCredit : !/^[0-9]{3}$/.test(manualCreditScore) || Number(manualCreditScore) < 300 || Number(manualCreditScore) > 900)) ? (creditMode === 'ONLINE' ? 'Provide consent and complete the online bureau check before continuing.' : 'Provide consent and enter a valid self-reported score from 300 to 900.') : currentStep === 4 && requiredDocumentsNotUploaded.length > 0 ? `Upload all required documents before continuing: ${requiredDocumentsNotUploaded.map(doc => doc.label).join(', ')}.` : '';
  const missingFieldCount = [!applicant.fullName, !validPan(applicant.panNumber), !validEmail(applicant.email), (applicant.workEmail !== '' && !validEmail(applicant.workEmail)), !/^[1-9][0-9]{5}$/.test(applicant.pincode), !!loanValidationMessage, !!loanExtraValidationMessage].filter(Boolean).length;

  const handleContinue = () => {
    if (currentStep === 1) {
      const invalidRequiredFields = getVisibleInvalidRequiredFields();
      const validationErrors = [
        ...invalidRequiredFields.map(({ field, message }) => `${field}: ${message}`),
        ...(!applicant.fullName ? ['Full name is required.'] : !validName(applicant.fullName) ? ['Full name should contain letters only.'] : []),
        ...(!applicant.dateOfBirth ? ['Date of birth is required.'] : []),
        ...(validateMobileNumber(applicant.mobileNumber) ? [validateMobileNumber(applicant.mobileNumber)] : []),
        ...(!validPan(applicant.panNumber) ? ['PAN should look like ABCDE1234F.'] : []),
        ...(!validEmail(applicant.email) ? ['Enter a valid personal email address.'] : []),
        ...(!applicant.workEmail ? ['Work email is required.'] : applicant.workEmail && !validEmail(applicant.workEmail) ? ['Enter a valid work email address.'] : []),
        ...(!/^[1-9][0-9]{5}$/.test(applicant.pincode) ? ['PIN code must be a valid 6-digit Indian PIN code.'] : []),
        ...getMissingRequiredContactDetails().map(field => `${field} is required.`),
        ...(employmentValidationMessage ? [employmentValidationMessage] : []),
        ...(isCoApplicantIncluded ? [
          ...(!applicant.additionalDetails?.coApplicantName?.trim() ? ['Co-applicant name is required.'] : []),
          ...(applicant.additionalDetails?.coApplicantPan && !validPan(applicant.additionalDetails.coApplicantPan) ? ['Co-applicant PAN should look like ABCDE1234F.'] : []),
          ...(applicant.additionalDetails?.coApplicantEmail && !validEmail(applicant.additionalDetails.coApplicantEmail) ? ['Enter a valid co-applicant email address.'] : []),
          ...(applicant.additionalDetails?.coApplicantWorkEmail && !validEmail(applicant.additionalDetails.coApplicantWorkEmail) ? ['Enter a valid co-applicant work email address.'] : [])
        ] : []),
        ...(isGuarantorIncluded && guarantorValidationMessage ? [guarantorValidationMessage] : [])
      ];
      const uniqueErrors = [...new Set(validationErrors)];
      console.log('Step 1 validation errors:', uniqueErrors);
      console.log('Step 1 invalid visible required fields:', invalidRequiredFields);
      if (uniqueErrors.length) {
        setValidationMessage(uniqueErrors.join(' '));
        const mobileError = validateMobileNumber(applicant.mobileNumber);
        if (mobileError) setApplicantMobileError(mobileError);
        return;
      }
    }
    if (currentStep === 2 && (loanValidationMessage || loanExtraValidationMessage)) {
      const errors = [loanValidationMessage, loanExtraValidationMessage].filter(Boolean);
      console.log('Step 2 validation errors:', errors);
      setValidationMessage(errors.join(' '));
      return;
    }
    if (currentStep === 4 && requiredDocumentsNotUploaded.length > 0) {
      const errors = requiredDocumentsNotUploaded.map(doc => `Upload required document: ${doc.label}.`);
      console.log('Step 4 validation errors:', errors);
      setValidationMessage(`Upload all required documents before continuing: ${requiredDocumentsNotUploaded.map(doc => doc.label).join(', ')}.`);
      return;
    }
    if (currentStep < 5) {
      setHighestUnlockedStep(step => Math.max(step, currentStep + 1));
      setCurrentStep(step => step + 1);
      setValidationMessage('');
    } else {
      void handleSubmit();
    }
  };

  const handleSubmit = async () => {
    try {
      const missingContactDetails = getMissingRequiredContactDetails();
      if (missingContactDetails.length) {
        console.log('Submission validation errors:', missingContactDetails);
        setValidationMessage(`Complete these required contact fields: ${missingContactDetails.join(', ')}.`);
        return;
      }
      const mobileError = validateMobileNumber(applicant.mobileNumber);
      if (mobileError) { setApplicantMobileError(mobileError); setValidationMessage(mobileError); return; }
      if (!applicant.fullName || !validName(applicant.fullName)) { setValidationMessage('Enter a valid full name using letters only.'); return; }
      if (!validPan(applicant.panNumber)) { setValidationMessage('PAN should look like ABCDE1234F.'); return; }
      if (!validEmail(applicant.email) || !applicant.workEmail || !validEmail(applicant.workEmail)) { setValidationMessage('Enter valid personal and work email addresses.'); return; }
      if (employmentValidationMessage) { setValidationMessage(employmentValidationMessage); return; }
      const employmentEmails = employment.employmentType === 'SALARIED' ? [employment.additionalDetails?.officialEmail] : employment.employmentType === 'BUSINESS_OWNER' ? [employment.additionalDetails?.businessEmail] : [];
      const extraEmails = [...employmentEmails, ...(isCoApplicantIncluded ? [applicant.additionalDetails?.coApplicantEmail, applicant.additionalDetails?.coApplicantWorkEmail] : []), ...(isGuarantorIncluded ? [applicant.additionalDetails?.guarantorEmail] : [])].filter((value): value is string => Boolean(value));
      if (extraEmails.some(value => !validEmail(value))) { setValidationMessage('Correct the employer, business, co-applicant or guarantor email format before submission.'); return; }
      if (!/^[1-9][0-9]{5}$/.test(applicant.pincode)) { setValidationMessage('PIN code must be a valid 6-digit Indian PIN code.'); return; }
      const suppliedIfscs = [applicant.additionalDetails?.ifscCode, ...(isCoApplicantIncluded ? [applicant.additionalDetails?.coApplicantIfsc] : []), ...(isGuarantorIncluded ? [applicant.additionalDetails?.guarantorIfsc] : [])].filter((value): value is string => Boolean(value));
      if (suppliedIfscs.some(value => !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value))) { setValidationMessage('Correct the IFSC code format. IFSC must contain 11 characters, for example ABCD0123456.'); return; }
      if (isCoApplicantIncluded) {
        if (!applicant.additionalDetails?.coApplicantName?.trim()) { setValidationMessage('Enter the co-applicant name or uncheck Include a co-applicant.'); return; }
        if (applicant.additionalDetails?.coApplicantName && !validName(applicant.additionalDetails.coApplicantName)) { setValidationMessage('Co-applicant name must contain letters only.'); return; }
        if (applicant.additionalDetails?.coApplicantPan && !validPan(applicant.additionalDetails.coApplicantPan)) { setValidationMessage('Co-applicant PAN should look like ABCDE1234F.'); return; }
        if (applicant.additionalDetails?.coApplicantEmail && !validEmail(applicant.additionalDetails.coApplicantEmail)) { setValidationMessage('Enter a valid co-applicant email address.'); return; }
      }
      if (guarantorEnabled && guarantorValidationMessage) { setValidationMessage(guarantorValidationMessage); return; }
      if (loanDetails.additionalDetails?.declarationAccepted !== 'true') { setValidationMessage('Please accept the declaration on the Review & Submit screen.'); return; }
      if (loanValidationMessage || loanExtraValidationMessage) {
        setValidationMessage(loanValidationMessage || loanExtraValidationMessage);
        return;
      }
      const id = await ensureApplication();
      const saveResponse = await apiFetch(`/api/applications/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApplicationPayload())
      });
      const saveResult = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(describeApiError(saveResult, 'Application details could not be saved before submission.'));
      if (requiredDocumentsNotUploaded.length > 0) {
        setValidationMessage(`Please upload these required documents before submission: ${requiredDocumentsNotUploaded.map(doc => doc.label).join(', ')}.`);
        return;
      }
      const submitResponse = await apiFetch(`/api/applications/${id}/submit`, { method: 'POST' });
      if (!submitResponse.ok) {
        const errorBody = await submitResponse.json().catch(() => ({}));
        throw new Error(errorBody?.message || 'Submission failed');
      }
      const submitted = await submitResponse.json();
      setSubmittedApplication({
        losNumber: submitted.losNumber || submitted.applicationNumber || `APP-${submitted.id || id}`,
        status: submitted.status || 'SUBMITTED',
        createdAt: submitted.createdAt
      });
      setStatus('SUBMITTED');
      setCurrentStep(5);
      setValidationMessage('');
      if (session?.role === 'USER') clearLoanDraft(session.mobile);
      await fetchApplications();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed';
      setValidationMessage(message);
    }
  };

  const downloadApplicationSummary = () => {
    const safe = (value: unknown) => String(value ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const applicationNumber = submittedApplication?.losNumber || (applicationId ? `APP-${applicationId}` : 'Not assigned');
    const rows: Array<[string, unknown]> = [
      ['Application Number', applicationNumber], ['Application Status', submittedApplication?.status || status],
      ['Applicant Name', applicant.fullName], ['Mobile Number', applicant.mobileNumber], ['Email', applicant.email],
      ['PAN', applicant.panNumber], ['Loan Type', loanDetails.loanType.replaceAll('_', ' ')],
      ['Requested Loan Amount', formatCurrency(loanDetails.requestedLoanAmount)], ['Tenure (months)', loanDetails.preferredTenure],
      ['Purpose of Loan', loanDetails.purposeOfLoan], ['Employment Type', employment.employmentType],
      ['Employer / Business', employment.employerName], ['Designation', employment.designation],
      ['Monthly In-hand Salary', employment.monthlyInHandSalary], ['Estimated EMI', emiSummary ? formatCurrency(Math.round(emiSummary.monthlyEmi)) : '—'],
      ['Created On', submittedApplication?.createdAt ? new Date(submittedApplication.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')]
    ];
    const lines = ['LOAN APPLICATION SUMMARY', 'This summary is for your records and does not represent loan approval.', '', ...rows.map(([label, value]) => `${label}: ${String(value ?? '—')}`), '', `Generated: ${new Date().toLocaleString('en-GB')}`];
    const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
    const wrapped = lines.flatMap(line => { const t = String(line); if (t.length <= 88) return [t]; const out: string[] = []; for (let i=0;i<t.length;i+=88) out.push(t.slice(i,i+88)); return out; });
    const content = ['BT', '/F1 10 Tf', '50 790 Td', ...wrapped.flatMap((line, i) => i === 0 ? [`(${escapePdf(line)}) Tj`] : ['0 -17 Td', `(${escapePdf(line)}) Tj`]), 'ET'].join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`
    ];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((obj, i) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${i+1} 0 obj\n${obj}\nendobj\n`; });
    const xref = new TextEncoder().encode(pdf).length; pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10,'0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
    link.download = `Loan-Application-Summary-${String(applicationNumber).replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`;
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const uploadDocument = async (docType: DocumentType, file: File) => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) { setDocuments((prev) => ({ ...prev, [docType]: { ...prev[docType], status: 'UPLOAD_FAILED', error: `${file.name}: unsupported file type. Allowed formats: PDF, JPG, PNG.`, fileName: file.name } })); return; }
    if (file.size > MAX_FILE_SIZE) { setDocuments((prev) => ({ ...prev, [docType]: { ...prev[docType], status: 'UPLOAD_FAILED', error: `${file.name}: file exceeds 5 MB.`, fileName: file.name } })); return; }
    setDocuments((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        status: 'UPLOADING',
        error: null,
        fileName: file.name
      }
    }));

    try {
      const id = await ensureApplication();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType);
      formData.append('documentName', (DOCUMENTS_BY_EMPLOYMENT[employment.employmentType] || REQUIRED_DOCUMENTS).find((item) => item.key === docType)?.label || docType);
      const response = await apiFetch(`/api/applications/${id}/documents`, {
        method: 'POST',
        body: formData
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Upload failed');
      }
      if (!payload?.id || payload.status !== 'UPLOADED') {
        throw new Error('The server did not confirm document persistence. Please retry.');
      }

      setDocuments((prev) => ({
        ...prev,
        [docType]: {
          id: payload.id,
          documentType: docType,
          documentName: payload.documentName || prev[docType].documentName,
          status: 'UPLOADED',
          fileName: payload.fileName || file.name,
          fileSize: payload.fileSize || file.size,
          uploadedAt: payload.uploadedAt || new Date().toISOString(),
          error: null
        }
      }));
      setSelectedFiles((prev) => ({ ...prev, [docType]: file.name }));
      setValidationMessage('');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Upload failed';
      const documentLabel = (DOCUMENTS_BY_EMPLOYMENT[employment.employmentType] || REQUIRED_DOCUMENTS).find(item => item.key === docType)?.label || docType;
      const message = `Validation failed in ${documentLabel}: ${rawMessage}`;
      setDocuments((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          status: 'UPLOAD_FAILED',
          error: message,
          fileName: file.name
        }
      }));
      setValidationMessage(message);
    }
  };

  const handleReviewDocument = async (docType: DocumentType, reviewStatus: 'VERIFIED' | 'REJECTED' | 'DEFICIENCY_RAISED') => {
    const item = documents[docType]; if (!applicationId || !item?.id) return;
    const remarks = reviewStatus === 'VERIFIED' ? '' : window.prompt(reviewStatus === 'REJECTED' ? 'Reason for rejecting this document:' : 'Describe the document deficiency:');
    if (reviewStatus !== 'VERIFIED' && !remarks?.trim()) return;
    try {
      const response = await apiFetch(`/api/admin/applications/${applicationId}/documents/${item.id}/review`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:reviewStatus, remarks:remarks || ''}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Document review could not be saved.');
      setDocuments(prev => ({...prev, [docType]: {...prev[docType], status: payload.status, verificationRemarks: payload.verificationRemarks || null, error: null}}));
    } catch (error) { setValidationMessage(error instanceof Error ? error.message : 'Document review could not be saved.'); }
  };
  const handleRemoveDocument = async (docType: DocumentType) => {
    const item = documents[docType];
    if (!item?.id || !applicationId) return;
    if (!window.confirm(`Remove ${item.documentName}?`)) return;
    try {
      const response = await apiFetch(`/api/applications/${applicationId}/documents/${item.id}`, { method: 'DELETE' });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.message || 'Document could not be removed.'); }
      setDocuments(prev => ({ ...prev, [docType]: { ...prev[docType], id: null, status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null } }));
      setSelectedFiles(prev => ({ ...prev, [docType]: '' }));
      setSaveIndicator('Document removed');
    } catch (error) { setValidationMessage(error instanceof Error ? error.message : 'Document could not be removed.'); }
  };
  const handleCapturePhoto = (docType: DocumentType) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment');
    input.onchange = async event => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) await uploadDocument(docType, file); };
    input.click();
  };
  const handleChooseFile = (docType: DocumentType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        return;
      }
      await uploadDocument(docType, file);
    };
    input.click();
  };

  const eligibility = useMemo(() => {
    const income = Number(employment.monthlyInHandSalary || 0);
    const amount = Number(loanDetails.requestedLoanAmount || 0);
    const score = Number(creditScore || 0);
    const result = Math.min(92, Math.max(38, 52 + (score - 500) / 20 - amount / 200000 + income / 150000));
    return Math.round(result);
  }, [employment.monthlyInHandSalary, loanDetails.requestedLoanAmount, creditScore]);

  const handleViewDocument = async (documentId: number) => {
    if (!applicationId) return;
    try {
      const response = await apiFetch(`/api/applications/${applicationId}/documents/${documentId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || (response.status === 401 ? 'Your session expired. Please sign in again.' : 'Document could not be opened.'));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank');
      if (!opened) { const link = document.createElement('a'); link.href = url; link.download = 'application-document'; link.click(); }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setValidationMessage(error instanceof Error ? error.message : 'Document could not be opened.'); }
  };
  const handleNewApplication = () => {
    const activeDraft = applications.find(item => ['DRAFT','DOCUMENTS_PENDING','CREDIT_CHECK_COMPLETED'].includes(item.status) && item.loanType === newApplicationLoanType);
    if (session?.role === 'USER' && activeDraft) {
      if (window.confirm(`You have an active draft (${activeDraft.losNumber || `DRAFT-${activeDraft.id}`}) for this product. Resume it now?`)) void handleOpenApplication(activeDraft.id);
      else setValidationMessage('Only one active draft per product is allowed. Choose another product or resume the existing draft.');
      return;
    }
    setShowUserDashboard(false);
    setStaffApplicationOpen(true);
    resetIdentity();
    setApplicationId(null); setSubmittedApplication(null); setSaveIndicator(''); setStatus('DRAFT'); setCreditScore(null); setManualCreditScore(''); setCreditMode('MANUAL');
    localDraftIdRef.current = null; setLocalDraftId(null); setCreditUsingMock(false);
    setApplicant({ ...initialApplicant, mobileNumber: session?.mobile || initialApplicant.mobileNumber });
    setEmployment(initialEmployment); setLoanDetails({ ...initialLoanDetails, loanType: newApplicationLoanType, interestRate: resolveInterestRate(newApplicationLoanType, '') }); setDocuments(createInitialDocuments());
    setSelectedFiles(Object.fromEntries(Object.keys(createInitialDocuments()).map((key) => [key, ''])) as Record<DocumentType, string>);
    setCurrentStep(1); setHighestUnlockedStep(1); setValidationMessage('');
  };
  const [referenceEnabled,setReferenceEnabled] = useState(false);
  const [referenceCount,setReferenceCount] = useState(1);
  useEffect(()=>{const keys=Object.keys(applicant.additionalDetails||{});const max=Math.max(1,...keys.map(k=>Number(/^reference(\d+)Name$/.exec(k)?.[1]||0)));setReferenceCount(max);},[applicationId]);
  const referenceField = (index:number,field:string) => `reference${index}${field}`;
  const updateReference = (index:number,field:string,value:string) => setApplicantExtra(referenceField(index,field),value);
  const setApplicantExtra = (key: string, value: string) => setApplicant(prev => ({ ...prev, additionalDetails: { ...(prev.additionalDetails || {}), [key]: value } }));
  const handleCoApplicantToggle = (checked: boolean) => {
    if (checked) {
      shouldScrollToCoApplicantRef.current = true;
      setApplicantExtra('coApplicantRequired', 'true');
      return;
    }

    const coApplicantDetails = applicant.additionalDetails || {};
    const hasEnteredData = Object.entries(coApplicantDetails).some(([key, value]) =>
      key.startsWith('coApplicant')
      && key !== 'coApplicantRequired'
      && value.trim().length > 0
      && value !== 'false'
      && value !== 'Not started'
    );
    if (hasEnteredData && !window.confirm('Unchecking this box will remove the co-applicant details you entered. Continue?')) return;

    setApplicant(previous => {
      const additionalDetails = { ...(previous.additionalDetails || {}) };
      Object.keys(additionalDetails).forEach(key => {
        if (key.startsWith('coApplicant') && key !== 'coApplicantRequired') delete additionalDetails[key];
      });
      additionalDetails.coApplicantRequired = 'false';
      return { ...previous, additionalDetails };
    });
    setIfscMessages(previous => ({ ...previous, coApplicant: { text: '', error: false } }));
    setValidationMessage(previous => {
      if ([
        'Enter the co-applicant name or uncheck Include a co-applicant.',
        'Co-applicant name must contain letters only.',
        'Co-applicant PAN should look like ABCDE1234F.',
        'Enter a valid co-applicant email address.',
        'Enter a valid co-applicant work email address.'
      ].includes(previous)) return '';
      if (previous === 'Correct the employer, business, co-applicant or guarantor email format before submission.') {
        const otherEmails = [employment.additionalDetails?.officialEmail, employment.additionalDetails?.businessEmail, applicant.additionalDetails?.guarantorEmail].filter((value): value is string => Boolean(value));
        if (!otherEmails.some(value => !validEmail(value))) return '';
      }
      if (previous === 'Correct the IFSC code format. IFSC must contain 11 characters, for example ABCD0123456.') {
        const otherIfscs = [applicant.additionalDetails?.ifscCode, applicant.additionalDetails?.guarantorIfsc].filter((value): value is string => Boolean(value));
        if (!otherIfscs.some(value => !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value))) return '';
      }
      return previous;
    });
  };
  const handleGuarantorToggle = (checked: boolean) => {
    if (checked) {
      setLoanExtra('guarantorRequired', 'true');
      return;
    }

    const guarantorDetails = applicant.additionalDetails || {};
    const hasEnteredData = Object.entries(guarantorDetails).some(([key, value]) =>
      key.startsWith('guarantor')
      && key !== 'guarantorRequired'
      && key !== 'guarantorKycStatus'
      && value.trim().length > 0
      && value !== 'false'
      && value !== 'Not started'
    );
    if (hasEnteredData && !window.confirm('Unchecking this box will remove the guarantor details you entered. Continue?')) return;

    setApplicant(previous => {
      const additionalDetails = { ...(previous.additionalDetails || {}) };
      Object.keys(additionalDetails).forEach(key => {
        if (key.startsWith('guarantor')) delete additionalDetails[key];
      });
      return { ...previous, additionalDetails };
    });
    setLoanExtra('guarantorRequired', 'false');
    setIfscMessages(previous => ({ ...previous, guarantor: { text: '', error: false } }));
    setValidationMessage(previous => {
      if (previous.startsWith('Complete all required guarantor fields:')
        || previous === 'Guarantor name must contain letters only.'
        || previous === 'Guarantor PAN should look like ABCDE1234F.'
        || previous === 'Guarantor mobile must contain 10 digits.'
        || previous === 'Enter a valid guarantor email address.'
        || previous === 'Guarantor PIN code must be a valid 6-digit Indian PIN code.'
        || previous === 'Guarantor IFSC must be 11 characters, e.g. ABCD0123456.') return '';
      if (previous === 'Correct the employer, business, co-applicant or guarantor email format before submission.') {
        const otherEmails = [employment.additionalDetails?.officialEmail, employment.additionalDetails?.businessEmail, ...(isCoApplicantIncluded ? [applicant.additionalDetails?.coApplicantEmail, applicant.additionalDetails?.coApplicantWorkEmail] : [])].filter((value): value is string => Boolean(value));
        if (!otherEmails.some(value => !validEmail(value))) return '';
      }
      if (previous === 'Correct the IFSC code format. IFSC must contain 11 characters, for example ABCD0123456.') {
        const otherIfscs = [applicant.additionalDetails?.ifscCode, ...(isCoApplicantIncluded ? [applicant.additionalDetails?.coApplicantIfsc] : [])].filter((value): value is string => Boolean(value));
        if (!otherIfscs.some(value => !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value))) return '';
      }
      return previous;
    });
  };
  const setEmploymentExtra = (key: string, value: string) => setEmployment(prev => ({ ...prev, additionalDetails: { ...(prev.additionalDetails || {}), [key]: value } }));
  const setLoanExtra = (key: string, value: string) => setLoanDetails(prev => ({ ...prev, additionalDetails: { ...(prev.additionalDetails || {}), [key]: value } }));
  const lookupIfsc = async (fieldKey: string, ifscValue: string, bankKey: string, branchKey: string) => {
    const code = (ifscValue || '').trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) { setIfscMessages(prev => ({ ...prev, [fieldKey]: { text: 'Enter a valid 11-character IFSC code first.', error: true } })); return; }
    setIfscMessages(prev => ({ ...prev, [fieldKey]: { text: 'Finding bank and branch…', error: false } }));
    try {
      const response = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(code)}`);
      if (!response.ok) throw new Error('IFSC not found. Check the code or enter bank details manually.');
      const bank = await response.json();
      if (!bank?.BANK || !bank?.BRANCH) throw new Error('Bank/branch details were not returned for this IFSC.');
      setApplicant(prev => ({ ...prev, additionalDetails: { ...(prev.additionalDetails || {}), [bankKey]: String(bank.BANK), [branchKey]: String(bank.BRANCH) } }));
      setIfscMessages(prev => ({ ...prev, [fieldKey]: { text: `${bank.BANK} · ${bank.BRANCH}`, error: false } }));
    } catch (error) { setIfscMessages(prev => ({ ...prev, [fieldKey]: { text: error instanceof Error ? error.message : 'IFSC lookup failed.', error: true } })); }
  };
  const persistLocalDraft = () => {
    const mobile = session?.role === 'USER' ? session.mobile : undefined;
    if (!mobile || draftHydratedRef.current !== mobile || showUserDashboard || submittedApplication || !ACTIVE_DRAFT_STATUSES.includes(status)) return;
    writeLoanDraft<LocalDraftSnapshot>(mobile, {
      applicationId,
      localDraftId: localDraftIdRef.current,
      currentStep,
      highestUnlockedStep,
      applicant,
      employment,
      loanDetails,
      identityType,
      identityPanNumber,
      identityConsent,
      identityFetched,
      creditMode,
      manualCreditScore,
      creditScore
    });
  };
  useEffect(() => { persistLocalDraft(); }, [currentStep, showUserDashboard, applicationId, localDraftId]);

  const handleGoHome = () => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    persistLocalDraft();
    setShowUserDashboard(true);
  };
  const handleResumeFromDashboard = (id: number) => {
    if (id === applicationId && ACTIVE_DRAFT_STATUSES.includes(status) && !submittedApplication) {
      setShowUserDashboard(false);
    } else {
      void handleOpenApplication(id);
    }
  };
  const resetFormState = () => {
    autoResumeAttemptedRef.current = null;
    draftHydratedRef.current = null;
    setApplicationId(null);
    localDraftIdRef.current = null; setLocalDraftId(null);
    setApplicant(initialApplicant); setApplicantMobileError(''); setEmployment(initialEmployment); setLoanDetails(initialLoanDetails);
    setDocuments(createInitialDocuments());
    setSelectedFiles(Object.fromEntries(Object.keys(createInitialDocuments()).map((key) => [key, ''])) as Record<DocumentType, string>);
    setCreditScore(null); setManualCreditScore(''); setCreditMode('MANUAL'); setCreditUsingMock(false);
    setStatus('DRAFT'); setSubmittedApplication(null); setApplications([]);
    setCurrentStep(1); setHighestUnlockedStep(1); setShowUserDashboard(true); setStaffApplicationOpen(false); setShowUnderwriting(false);
    setSaveIndicator(''); setValidationMessage('');
  };

  const scheduleAutoSave = () => { if (session?.role !== 'USER') return; if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = window.setTimeout(() => { void handleSaveDraft(true); }, 900); };
  const handleLogout = () => {
    if (autoSaveTimerRef.current !== null) { window.clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    // Keep loan_draft_<mobile> in localStorage so the applicant can resume after logging back in.
    persistLocalDraft();
    resetIdentity();
    const authSession = readStoredAuth();
    if (authSession) fetch('/api/auth/logout', { method: 'POST', headers: buildAuthHeaders(authSession) }).catch(() => undefined);
    clearAuth();
    resetFormState();
    setSession(null);
  };

  if (!session) {
    return <LoginPage onAuthenticated={setSession} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">FinEdge Bank</div>
          <div className="subtitle">Loan Origination System</div>
        </div>
        <nav className="nav">
          {session.role === 'ADMIN' ? (
            <>
              {staffRoles.some(r=>['COMPLIANCE_AUDIT','SUPER_ADMIN'].includes(r))&&<a href="#" onClick={e=>{e.preventDefault();setStaffView('audit');}}>Compliance & Audit</a>}
              {staffRoles.includes('SUPER_ADMIN')&&<a href="#" onClick={e=>{e.preventDefault();setStaffView('administration');}}>Users & System Settings</a>}
              {staffRoles.some(r=>['CREDIT_MANAGER','SUPER_ADMIN'].includes(r))&&<a href="#" onClick={e=>{e.preventDefault();setStaffView('checker');}}>Policy Approvals</a>}
              {staffRoles.includes('PRODUCT_POLICY_ADMIN')&&<a href="#" onClick={e=>{e.preventDefault();setStaffView('policy');}}>Products & Rate Cards</a>}

              {staffRoles.includes('APPLICATION_PROCESSOR')&&<a href="#" onClick={e=>{e.preventDefault();setShowUnderwriting(false);setStaffView('assisted');handleNewApplication();}}>+ New Application</a>}

            </>
          ) : (
            <>
              <button type="button" className="home-button" title="Go to Dashboard" aria-label="Go to Dashboard" aria-current={showUserDashboard ? 'page' : undefined} disabled={isCreatingApplication} onClick={handleGoHome}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
                </svg>
              </button>
              <a className={showUserDashboard ? undefined : 'active'} href="#" onClick={(event) => { event.preventDefault(); if (staffApplicationOpen) setShowUserDashboard(false); else handleNewApplication(); }}>Application</a>
            </>
          )}
          <button type="button" className="logout-button" onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      <main className="page">
        {session.role==='ADMIN'&&staffView==='loading'&&<section className="card form-card" role="status">Loading staff permissions… If this persists, check /api/staff/portal/context and sign in again.</section>}
        {session.role==='ADMIN'&&staffView==='administration'&&<StaffAdminPortal session={session}/>}
        {session.role==='ADMIN'&&staffView==='policy'&&<PolicyAdminPortal session={session}/>}
        {session.role==='ADMIN'&&staffView==='checker'&&<PolicyCheckerPortal session={session}/>}
        {session.role==='ADMIN'&&staffView==='audit'&&<StaffAuditPortal session={session}/>}
        {(session.role!=='ADMIN'||['recent','review','assisted'].includes(staffView))&&<>
        {showUserDashboard && session.role === 'USER' && <section className="card form-card">
          <h2>Your loan dashboard</h2>
          <p>Continue your saved application or review the status of a previous application.</p>
          {validationMessage && <div className="validation-box" role="alert">{validationMessage}</div>}
          <label className="dashboard-search"><span>Search by Application ID or Mobile Number</span><input value={applicationSearch} onChange={e => setApplicationSearch(e.target.value)} placeholder="Enter application ID or mobile number" /></label>
          {applications.filter(row => { const q = applicationSearch.trim().toLowerCase(); return !q || String(row.losNumber || row.id || '').toLowerCase().includes(q) || String((row as any).mobileNumber || (row as any).applicantMobile || applicant.mobileNumber || '').toLowerCase().includes(q); }).length === 0 && applicationSearch.trim() && <p className="search-empty">No matching application found.</p>}
          {applications.filter(row => { const q = applicationSearch.trim().toLowerCase(); return !q || String(row.losNumber || row.id || '').toLowerCase().includes(q) || String((row as any).mobileNumber || (row as any).applicantMobile || applicant.mobileNumber || '').toLowerCase().includes(q); }).map(row => <div className="application-search-result" key={`search-${row.id}`}><span><strong>{row.losNumber || (row.status === 'DRAFT' ? `DRAFT-${row.id}` : `APP-${row.id}`)}</strong><small>{String(row.status).replaceAll('_',' ')}</small></span><span className={`status-pill status-${String(row.status).toLowerCase()}`}>{String(row.status).replaceAll('_',' ')}</span></div>)}
          {staffApplicationOpen && !submittedApplication && ACTIVE_DRAFT_STATUSES.includes(status) ? <div className="card" style={{padding:16,marginBottom:16}}><h3>Continue your application</h3><p>{loanDetails.loanType.replaceAll('_',' ')} · Step {currentStep} of 5</p><button className="primary" onClick={() => setShowUserDashboard(false)}>Continue application</button></div> : applications.filter(row => ACTIVE_DRAFT_STATUSES.includes(row.status)).slice(0,1).map(row => <div className="card" key={row.id} style={{padding:16,marginBottom:16}}><h3>Continue your application</h3><p>{(row.loanType || 'Loan product not selected').replaceAll('_',' ')} · {row.status === 'DRAFT' ? 'Draft in progress' : row.status.replaceAll('_',' ')}</p><p>Temporary ID: <strong>DRAFT-{row.id}</strong></p><button className="primary" onClick={() => handleResumeFromDashboard(row.id)}>Continue application</button></div>)}
          <h3>Previous applications</h3>
          {applications.length === 0 ? <p>No previous applications found.</p> : <div className="doc-list">{applications.map(row => <div className="doc-item" key={row.id} style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',padding:12,borderBottom:'1px solid #e3e8ef'}}><div><strong>{(row.loanType || 'Loan product not selected').replaceAll('_',' ')}</strong><div>{row.losNumber || `DRAFT-${row.id}`}</div><small>Status: {row.status.replaceAll('_',' ')} · Stage: {row.status === 'DRAFT' ? 'Applicant' : row.status === 'DOCUMENTS_PENDING' ? 'Documents' : row.status === 'CREDIT_CHECK_COMPLETED' ? 'Verification' : row.status === 'SUBMITTED' ? 'Under review' : row.status} · Owner: {row.status === 'DRAFT' ? 'Applicant' : 'Credit Operations'} · Next action: {row.status === 'DRAFT' ? 'Complete application' : row.status === 'DOCUMENTS_PENDING' ? 'Resolve document requirements' : row.status === 'SUBMITTED' ? 'Await decision' : 'Check verification status'}</small></div>{row.status !== 'SUBMITTED' && row.status !== 'APPROVED' && row.status !== 'REJECTED' && <button className="secondary" onClick={() => handleResumeFromDashboard(row.id)}>Resume</button>}</div>)}</div>}
          <div className="inline-actions"><label>Loan product<select value={newApplicationLoanType} onChange={e => setNewApplicationLoanType(e.target.value)}><option value="PERSONAL_LOAN">Personal Loan</option><option value="HOME_LOAN">Home Loan</option><option value="CAR_LOAN">Vehicle Loan</option><option value="EDUCATION_LOAN">Education Loan</option><option value="BUSINESS_LOAN">Business Loan</option><option value="LOAN_AGAINST_PROPERTY">Loan Against Property</option></select></label><button className="secondary" onClick={handleNewApplication}>Start new application</button></div>
        </section>}
        <section className="hero" style={{display: (showUserDashboard && session.role === 'USER') || (session.role === 'ADMIN' && staffView!=='assisted') ? 'none' : undefined}}>
          <div>
            <h1>New Loan Application</h1>
            <p>Step {currentStep} of 5</p>{applicationId && <small>{status === 'SUBMITTED' ? `Application Number: ${submittedApplication?.losNumber || `APP-${applicationId}`}` : `Temporary ID: DRAFT-${applicationId}`}</small>}
          </div>
          <div className="stepper">
            {['Applicant', 'Loan Offer', 'Verification', 'Documents', 'Review & Submit'].map((label, index) => (
              <div key={label} className={`step ${index + 1 < currentStep ? 'done' : index + 1 === currentStep ? 'current' : ''} ${index + 1 > currentStep ? 'locked' : ''} ${validationMessage && index + 1 === currentStep ? 'needs-attention' : ''}`} role="button" tabIndex={0} onClick={() => { if (index + 1 <= currentStep) { setShowUserDashboard(false); setCurrentStep(index + 1); } }} onKeyDown={event => { if (event.key === 'Enter' && index + 1 <= currentStep) { setShowUserDashboard(false); setCurrentStep(index + 1); } }} aria-disabled={index + 1 > highestUnlockedStep}>
                <span>{index + 1}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </section>

        {!showUserDashboard && validationMessage && <div className={`validation-box ${validationMessage.startsWith('Upload all required documents') || validationMessage.startsWith('Please upload these required documents') ? 'document-validation-error' : ''}`} role="alert" style={{marginBottom:16}}>{validationMessage}</div>}
        {session.role === 'ADMIN' && (staffView==='review' || staffView==='recent') && showUnderwriting && <UnderwritingWorkspace session={session} />}
        {session.role === 'ADMIN' && staffView==='recent' && !showUnderwriting && <section className="dashboard-grid">
          <div className="card metric"><span>Total Applications</span><strong>{applications.length}</strong></div>
          <div className="card metric"><span>Draft Applications</span><strong>{applications.filter((item) => item.status === 'DRAFT').length}</strong></div>
          <div className="card metric"><span>Under Review</span><strong>{applications.filter((item) => item.status === 'UNDER_REVIEW').length}</strong></div>
          <div className="card metric"><span>Submitted Applications</span><strong>{applications.filter((item) => item.status === 'SUBMITTED').length}</strong></div>
        </section>}

        <section className="card form-card" style={{display: (session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && currentStep === 1 ? undefined : 'none', paddingBottom: 96, scrollPaddingBottom: 96}} onBlurCapture={scheduleAutoSave}>
          <h2>Applicant Details</h2>
          <fieldset className="identity-block" aria-busy={identityLoading}>
            <legend>Identity</legend>
            <p>Fetch applicant details from Aadhaar or PAN, then review the fields below. You can also enter details manually.</p>
            <div className="field-grid">
              <div className="full-width identity-document-row">
              <label htmlFor="identity-document-select">Identity document</label>
              <div className="identity-document-line">
              <select id="identity-document-select" aria-label="Identity document" value={identityType} disabled={identityLoading} onChange={event => {
                setIdentityType(event.target.value as IdentityType);
                setIdentityConsent(false);
                setIdentityFile(null);
                setIdentityError('');
                if (identityFileRef.current) identityFileRef.current.value = '';
              }}><option value="">Select Aadhaar or PAN</option><option value="AADHAAR">Aadhaar</option><option value="PAN">PAN</option></select>
              <p className="field-hint">Enter the selected document's number below, or upload its document.</p>
              </div>
              </div>
              {identityType === 'PAN' && <label>PAN Number<input maxLength={10} disabled={identityLoading} value={identityPanNumber} onChange={event => {
                setIdentityPanNumber(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                setIdentityConsent(false);
              }} onBlur={() => setValidationMessage(identityPanNumber && !validPan(identityPanNumber) ? "PAN should look like ABCDE1234F." : "")} />{identityPanNumber && !validPan(identityPanNumber) && <small className="field-error">PAN should look like ABCDE1234F.</small>}</label>}
              {identityType === 'AADHAAR' && <label className="required-contact-block">Aadhaar Number<input
                type="text"
                autoComplete="off" inputMode="numeric"
                maxLength={applicant.additionalDetails?.aadhaarNumber?.startsWith('XXXXXXXX') ? 14 : 12}
                disabled={identityLoading}
                readOnly={isIdentityFetched('aadhaarNumber') && !identityError}
                value={applicant.additionalDetails?.aadhaarNumber?.startsWith('XXXXXXXX')
                  ? maskAadhaar(applicant.additionalDetails.aadhaarNumber).replace('XXXXXXXX', '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ')
                  : maskAadhaarEntry(applicant.additionalDetails?.aadhaarNumber || '')}
                onFocus={event => { if (applicant.additionalDetails?.aadhaarNumber?.startsWith('XXXXXXXX')) event.target.select(); }}
                onChange={event => {
                setApplicantExtra('aadhaarNumber', editAadhaarEntry(applicant.additionalDetails?.aadhaarNumber || '', event.target.value));
                if (identityType === 'AADHAAR') setIdentityConsent(false);
              }} />{applicant.additionalDetails?.aadhaarNumber && <small className="field-hint">{maskAadhaar(applicant.additionalDetails.aadhaarNumber)}</small>}{identityTag('aadhaarNumber')}</label>}
              <div className="full-width identity-upload" onDragOver={event => event.preventDefault()} onDrop={event => {
                event.preventDefault();
                if (!identityLoading) chooseIdentityFile(event.dataTransfer.files);
              }}>
                <label>Upload Aadhaar / PAN document<input ref={identityFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={identityLoading} onChange={event => chooseIdentityFile(event.target.files)} /></label>
                <small className="field-hint">Accepted file types: PDF, JPG, PNG. Maximum file size: 5 MB. Drag and drop one document here.</small>
                {identityFile && <div><span>Document selected ({(identityFile.size / 1024).toFixed(1)} KB)</span> <button type="button" className="secondary" disabled={identityLoading} onClick={() => { setIdentityFile(null); setIdentityConsent(false); setIdentityError(''); }}>Remove document</button></div>}
              </div>
              <label className="full-width identity-consent"><input type="checkbox" checked={identityConsent} disabled={identityLoading} onChange={event => setIdentityConsent(event.target.checked)} />I explicitly consent to using my selected Aadhaar/PAN number or document to fetch and pre-fill my identity details.</label>
            </div>
            <button type="button" disabled={identityLoading || !identityConsent} onClick={() => void fetchIdentity()}>{identityLoading && <span className="identity-spinner" aria-hidden="true" />}{identityLoading ? 'Fetching identity details...' : 'Fetch identity details'}</button>
            {identityLoading && <p className="field-hint" role="status">Extracting identity details. You can continue entering applicant details below.</p>}
            {identityError && <div className="validation-box" role="alert">{identityError}</div>}
            {identityUsingMock && <p className="field-hint" role="status">Using local development demo identity details, not a verified Aadhaar/PAN lookup.</p>}
            {identityFilledCount > 0 && <p className="field-success" role="status">{identityFilledCount} fields filled &ndash; please review</p>}
          </fieldset>
          <div className="field-grid">
            <label>Full Name <span className="required-asterisk">*</span><input value={applicant.fullName || ''} onChange={(e) => { const fullName = e.target.value.replace(/[^A-Za-z .'-]/g, ''); setApplicant(previous => ({ ...previous, fullName })); }} onBlur={(e) => { if (e.target.value && !validName(e.target.value)) setValidationMessage("Name should contain letters only."); }} />{applicant.fullName && !validName(applicant.fullName) && <small className="field-error">Name should contain letters only.</small>}{identityTag('fullName')}</label>
            <label>Date of Birth <span className="required-asterisk">*</span><input type="date" max={new Date().toISOString().slice(0,10)} value={applicant.dateOfBirth || ''} onChange={(e) => { const dateOfBirth = e.target.value; setApplicant(previous => ({ ...previous, dateOfBirth })); }} />{identityTag('dateOfBirth')}</label><label>Age<input readOnly value={calculateAge(applicant.dateOfBirth)} />{identityTag('dateOfBirth')}</label>
            <label>Mobile Number <span className="required-asterisk">*</span><input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={applicant.mobileNumber}
              aria-invalid={Boolean(applicantMobileError)}
              onChange={(event) => {
                const value = event.target.value;
                if (/\D/.test(value)) {
                  setApplicantMobileError('Mobile number must contain digits only.');
                  return;
                }
                setApplicant({ ...applicant, mobileNumber: value.slice(0, 10) });
                setApplicantMobileError('');
              }}
              onPaste={(event) => {
                if (/\D/.test(event.clipboardData.getData('text'))) {
                  event.preventDefault();
                  setApplicantMobileError('Mobile number must contain digits only.');
                }
              }}
            />{applicantMobileError && <span role="alert" style={{ color: '#a61d1d', fontSize: 12 }}>{applicantMobileError}</span>}{identityTag('mobileNumber')}</label>
            <label>Email ID <span className="required-asterisk">*</span><input type="email" value={applicant.email} onChange={(e) => setApplicant({ ...applicant, email: e.target.value })} onBlur={() => setValidationMessage(applicant.email && !validEmail(applicant.email) ? "Enter a valid email address." : "")} />{applicant.email && !validEmail(applicant.email) && <small className="field-error">Enter a valid email address.</small>}{identityTag('email')}</label>
            <label>Work Email ID <span className="required-asterisk">*</span><input type="email" value={applicant.workEmail} onChange={(e) => setApplicant({ ...applicant, workEmail: e.target.value })} onBlur={() => setValidationMessage(applicant.workEmail && !validEmail(applicant.workEmail) ? "Enter a valid work email address." : "")} />{applicant.workEmail && !validEmail(applicant.workEmail) && <small className="field-error">Enter a valid work email address.</small>}{identityTag('workEmail')}</label>
            <section className="full-width card form-card required-contact-block" aria-label="Contact details"><h3>Contact details</h3><div className="field-grid">
            <label>City <span className="required-asterisk">*</span><input required value={applicant.city} onChange={(e) => setApplicant({ ...applicant, city: e.target.value })} />{identityTag('city')}</label>
            <label>State <span className="required-asterisk">*</span><select required value={applicant.state} onChange={(e) => setApplicant({ ...applicant, state: e.target.value })}><option value="">Select state</option>{INDIA_STATES.map(state => <option key={state} value={state}>{state}</option>)}</select>{identityTag('state')}</label>
            <label>Pincode <span className="required-asterisk">*</span><input required inputMode="numeric" minLength={6} maxLength={6} pattern="[1-9][0-9]{5}" value={applicant.pincode} onChange={(e) => setApplicant({ ...applicant, pincode: e.target.value.replace(/\D/g, '').slice(0,6) })} onBlur={() => setValidationMessage(applicant.pincode && !/^[1-9][0-9]{5}$/.test(applicant.pincode) ? "PIN code must be a valid 6-digit Indian PIN code." : "")} />{applicant.pincode && !/^[1-9][0-9]{5}$/.test(applicant.pincode) && <small className="field-error">Enter a valid 6-digit PIN code.</small>}{identityTag('pincode')}</label>
            {pincodeMessage && <p className="full-width field-hint" role="status">{pincodeMessage}</p>}
            </div></section>
            <section className="full-width card form-card required-contact-block" aria-label="Address Details"><h3>Address Details</h3><div className="field-grid">
            <label className="full-width"><span>Current Address <span className="required-asterisk">*</span></span><input required maxLength={250} value={applicant.residentialAddress} onChange={(e) => setApplicant({ ...applicant, residentialAddress: e.target.value })} /><small className="field-hint">{applicant.residentialAddress.length}/250 characters</small>{identityTag('residentialAddress')}</label>
            <label><span>Years at Current Address</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input inputMode="numeric" pattern="[0-9]*" value={applicant.additionalDetails?.yearsAtAddress || ''} onChange={e => setApplicantExtra('yearsAtAddress', e.target.value.replace(/\D/g, ''))} /><span aria-hidden="true">years</span></span></label>
            <label className="full-width"><span>Permanent Address <span className="required-asterisk">*</span></span><input required value={applicant.additionalDetails?.permanentAddress || ''} maxLength={250} onChange={e => setApplicantExtra('permanentAddress', e.target.value)} /><small className="field-hint">{(applicant.additionalDetails?.permanentAddress || '').length}/250 characters</small>{identityTag('permanentAddress')}</label>
            <label className="full-width">Address Proof Type <span className="required-asterisk">*</span><select value={applicant.additionalDetails?.addressProofType || ''} onChange={e => setApplicantExtra('addressProofType', e.target.value)}>
              <option value="">Select address proof</option>
              {applicant.additionalDetails?.addressProofType && !['Aadhaar Card', 'Passport', 'Voter ID', 'Utility Bill', 'Driving License'].includes(applicant.additionalDetails.addressProofType) && <option>{applicant.additionalDetails.addressProofType}</option>}
              <option>Aadhaar Card</option><option>Passport</option><option>Voter ID</option><option>Utility Bill</option><option>Driving License</option>
            </select></label>
            </div></section>
            <div className="full-width required-contact-block">
            <section className="card form-card" aria-label="Additional personal details"><h3>Additional personal details</h3><div className="field-grid">
            <label>Gender <span className="required-asterisk">*</span><select value={applicant.additionalDetails?.gender || ''} onChange={e => setApplicantExtra('gender', e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select>{identityTag('gender')}</label>
            <label>Father's Name <span className="required-asterisk">*</span><input value={applicant.additionalDetails?.fatherName || ''} onChange={e => setApplicantExtra('fatherName', e.target.value.replace(/[^A-Za-z .'-]/g,''))} />{identityTag('fatherName')}</label>
            <label>Mother's Name <span className="required-asterisk">*</span><input value={applicant.additionalDetails?.motherName || ''} onChange={e => setApplicantExtra('motherName', e.target.value.replace(/[^A-Za-z .'-]/g,''))} />{identityTag('motherName')}</label>
            <label>Marital Status <span className="required-asterisk">*</span><select value={applicant.additionalDetails?.maritalStatus || ''} onChange={e => setApplicantExtra('maritalStatus', e.target.value)}><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select>{identityTag('maritalStatus')}</label>
            {applicant.additionalDetails?.maritalStatus === 'Married' && <label>Spouse Name<input value={applicant.additionalDetails?.spouseName || ''} onChange={e => setApplicantExtra('spouseName', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} />{identityTag('spouseName')}</label>}
            <label>Nationality <span className="required-asterisk">*</span><input value={applicant.additionalDetails?.nationality || ''} onChange={e => setApplicantExtra('nationality', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} />{identityTag('nationality')}</label>
            <label>Residential Status<select value={applicant.additionalDetails?.residentialStatus || ''} onChange={e => setApplicantExtra('residentialStatus', e.target.value)}><option value="Resident">Resident</option><option value="NRI">NRI</option><option value="Other">Other</option></select>{identityTag('residentialStatus')}</label>
            <label>Highest Education Qualification <span className="required-asterisk">*</span><select value={applicant.additionalDetails?.education || ''} onChange={e => setApplicantExtra('education', e.target.value)}>
              <option value="" disabled>Select</option>
              {applicant.additionalDetails?.education && !['Below 10th', '10th Pass (SSC)', '12th Pass (HSC)', 'Diploma', 'Graduate', 'Post Graduate', 'Professional Degree (CA / CS / CMA / MBBS / LLB / Engineering)', 'Doctorate', 'Other'].includes(applicant.additionalDetails.education) && <option>{applicant.additionalDetails.education}</option>}
              <option>Below 10th</option><option>10th Pass (SSC)</option><option>12th Pass (HSC)</option><option>Diploma</option><option>Graduate</option><option>Post Graduate</option><option>Professional Degree (CA / CS / CMA / MBBS / LLB / Engineering)</option><option>Doctorate</option><option>Other</option>
            </select>{identityTag('education')}</label>
            <label>Alternate Mobile<input inputMode="numeric" maxLength={10} value={applicant.additionalDetails?.alternateMobile || ''} onChange={e => setApplicantExtra('alternateMobile', e.target.value.replace(/\D/g,'').slice(0,10))} />{identityTag('alternateMobile')}</label>
            <label>Residence Type<select value={applicant.additionalDetails?.currentResidenceType || ''} onChange={e => setApplicantExtra('currentResidenceType', e.target.value)}><option value="">Select</option><option>Owned</option><option>Rented</option></select></label>
            {applicant.additionalDetails?.currentResidenceType === 'Rented' && <label>Monthly Rent<input type="number" min="0" value={applicant.additionalDetails?.monthlyRent || ''} onChange={e => setApplicantExtra('monthlyRent', e.target.value)} /></label>}
            </div></section>
            <section className="card form-card" aria-label="Identity details"><h3>Identity</h3><div className="field-grid">
            <label>PAN Number <span className="required-asterisk">*</span><input maxLength={10} value={applicant.panNumber} onChange={event => {
              setApplicant({ ...applicant, panNumber: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') });
            }} onBlur={() => setValidationMessage(applicant.panNumber && !validPan(applicant.panNumber) ? "PAN should look like ABCDE1234F." : "")} />{applicant.panNumber && !validPan(applicant.panNumber) && <small className="field-error">PAN should look like ABCDE1234F.</small>}{identityTag('panNumber')}</label>
            <label>Alternate ID Type <span className="required-asterisk">*</span><select value={applicant.additionalDetails?.alternateIdType || ''} onChange={e => setApplicantExtra('alternateIdType', e.target.value)}><option value="">Select</option><option>Voter ID</option><option>Driving Licence</option><option>Passport</option></select></label>
            <label>Alternate ID Number<input value={applicant.additionalDetails?.alternateIdNumber || ''} onChange={e => setApplicantExtra('alternateIdNumber', e.target.value)} /></label>
            </div></section>
            <section className="card form-card" aria-label="Bank Account Details" style={{ background: '#f5f9ff', border: '1px solid #d5deee' }}><h3>Bank Account Details</h3><div className="field-grid">
            <label>Account Holder Name <span className="required-asterisk">*</span><input value={applicant.additionalDetails?.accountHolderName || ''} onChange={e => setApplicantExtra('accountHolderName', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Bank Account Number <span className="required-asterisk">*</span><input inputMode="numeric" value={applicant.additionalDetails?.accountNumber || ''} onChange={e => setApplicantExtra('accountNumber', e.target.value.replace(/\D/g,''))} /></label>
            <label>IFSC Code <span className="required-asterisk">*</span><span className="ifsc-input-wrap"><input maxLength={11} value={applicant.additionalDetails?.ifscCode || ''} onChange={e => setApplicantExtra('ifscCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onBlur={() => setIfscMessages(prev => ({...prev, applicant: applicant.additionalDetails?.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(applicant.additionalDetails.ifscCode) ? {text:'IFSC must be 11 characters, e.g. ABCD0123456.',error:true} : {text:'',error:false}}))} /><button type="button" className="secondary ifsc-finder" onClick={() => void lookupIfsc('applicant', applicant.additionalDetails?.ifscCode || '', 'bankName', 'bankBranch')}>Find IFSC</button></span>{ifscMessages.applicant?.text && <small className={ifscMessages.applicant.error ? 'field-error' : 'field-success'}>{ifscMessages.applicant.text}</small>}</label>
            <label>Bank Name <span className="required-asterisk">*</span><input value={applicant.additionalDetails?.bankName || ''} onChange={e => setApplicantExtra('bankName', e.target.value)} /></label>
            <label>Bank Branch <span className="required-asterisk">*</span><input value={applicant.additionalDetails?.bankBranch || ''} onChange={e => setApplicantExtra('bankBranch', e.target.value)} /></label>
            <label>Account Type <span className="required-asterisk">*</span><select value={applicant.additionalDetails?.accountType || ''} onChange={e => setApplicantExtra('accountType', e.target.value)}><option value="">Select</option><option>Savings</option><option>Current</option></select></label>
            <label>Salary Account <span className="required-asterisk">*</span><select value={applicant.additionalDetails?.salaryAccount || ''} onChange={e => setApplicantExtra('salaryAccount', e.target.value)}><option value="">Select</option><option>Yes</option><option>No</option></select></label>
            </div></section>
            <label className="full-width checkbox-field inline-checkbox-field"><span><input type="checkbox" checked={isCoApplicantIncluded} onChange={event => handleCoApplicantToggle(event.target.checked)} /></span>Add a co-applicant</label>
            {applicant.additionalDetails?.coApplicantRequired === 'true' && <section ref={coApplicantSectionRef} className="full-width card form-card" aria-label="Co-applicant Details"><h3>Co-applicant Details</h3><div className="field-grid">
            <label>Name<input value={applicant.additionalDetails?.coApplicantName || ''} onChange={e => setApplicantExtra('coApplicantName', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Relationship<input value={applicant.additionalDetails?.coApplicantRelationship || ''} onChange={e => setApplicantExtra('coApplicantRelationship', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Type<select value={applicant.additionalDetails?.coApplicantType || ''} onChange={e => setApplicantExtra('coApplicantType', e.target.value)}><option value="">Select</option><option>Earning</option><option>Non-earning</option></select></label>
            <label>Monthly Income<input type="number" min="0" value={applicant.additionalDetails?.coApplicantIncome || ''} onChange={e => setApplicantExtra('coApplicantIncome', e.target.value)} /></label>
            <label>PAN<input maxLength={10} value={applicant.additionalDetails?.coApplicantPan || ''} onChange={e => setApplicantExtra('coApplicantPan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />{applicant.additionalDetails?.coApplicantPan && !validPan(applicant.additionalDetails.coApplicantPan) && <small className="field-error">PAN should look like ABCDE1234F.</small>}</label>
            <label>Mobile<input inputMode="numeric" maxLength={10} value={applicant.additionalDetails?.coApplicantMobile || ''} onChange={e => setApplicantExtra('coApplicantMobile', e.target.value.replace(/\D/g,'').slice(0,10))} /></label>
            <label>Email<input type="email" value={applicant.additionalDetails?.coApplicantEmail || ''} onChange={e => setApplicantExtra('coApplicantEmail', e.target.value)} onBlur={() => setValidationMessage(applicant.additionalDetails?.coApplicantEmail && !validEmail(applicant.additionalDetails.coApplicantEmail) ? 'Enter a valid co-applicant email address.' : '')} />{applicant.additionalDetails?.coApplicantEmail && !validEmail(applicant.additionalDetails.coApplicantEmail) && <small className="field-error">Enter a valid co-applicant email address.</small>}</label>
            <label className="full-width">Address<input value={applicant.additionalDetails?.coApplicantAddress || ''} onChange={e => setApplicantExtra('coApplicantAddress', e.target.value)} /></label>
            <label>Date of Birth<input type="date" max={new Date().toISOString().slice(0,10)} value={applicant.additionalDetails?.coApplicantDob || ''} onChange={e => setApplicantExtra('coApplicantDob', e.target.value)} /></label>
            <label>Age<input readOnly value={calculateAge(applicant.additionalDetails?.coApplicantDob || '')} /></label>
            <label>Gender<select value={applicant.additionalDetails?.coApplicantGender || ''} onChange={e => setApplicantExtra('coApplicantGender', e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label>
            <label>Father's Name<input value={applicant.additionalDetails?.coApplicantFather || ''} onChange={e => setApplicantExtra('coApplicantFather', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Mother's Name<input value={applicant.additionalDetails?.coApplicantMother || ''} onChange={e => setApplicantExtra('coApplicantMother', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Spouse Name<input value={applicant.additionalDetails?.coApplicantSpouse || ''} onChange={e => setApplicantExtra('coApplicantSpouse', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Marital Status<select value={applicant.additionalDetails?.coApplicantMaritalStatus || ''} onChange={e => setApplicantExtra('coApplicantMaritalStatus', e.target.value)}><option value="">Select</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select></label>
            <label>Nationality<input value={applicant.additionalDetails?.coApplicantNationality || ''} onChange={e => setApplicantExtra('coApplicantNationality', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Residential Status<select value={applicant.additionalDetails?.coApplicantResidentialStatus || ''} onChange={e => setApplicantExtra('coApplicantResidentialStatus', e.target.value)}><option value="">Select</option><option value="Resident">Resident</option><option value="Non-Resident">Non-Resident</option><option value="NRI">NRI</option></select></label>
            <label>Education<select value={applicant.additionalDetails?.coApplicantEducation || ''} onChange={e => setApplicantExtra('coApplicantEducation', e.target.value)}><option value="">Select</option><option>Below 10th</option><option>10th Pass</option><option>12th Pass</option><option>Diploma</option><option>Graduate</option><option>Postgraduate</option><option>Doctorate</option><option>Other</option></select></label>
            <label>Aadhaar / KYC Document<input value={applicant.additionalDetails?.coApplicantKycDocument || ''} onChange={e => setApplicantExtra('coApplicantKycDocument', e.target.value)} /></label>
            <label>Alternate ID Type<select value={applicant.additionalDetails?.coApplicantAlternateIdType || ''} onChange={e => setApplicantExtra('coApplicantAlternateIdType', e.target.value)}><option value="">Select</option><option>Voter ID</option><option>Driving Licence</option><option>Passport</option></select></label>
            <label>Alternate ID Number<input value={applicant.additionalDetails?.coApplicantAlternateIdNumber || ''} onChange={e => setApplicantExtra('coApplicantAlternateIdNumber', e.target.value)} /></label>
            <label>Work Email<input type="email" value={applicant.additionalDetails?.coApplicantWorkEmail || ''} onChange={e => setApplicantExtra('coApplicantWorkEmail', e.target.value)} onBlur={() => setValidationMessage(applicant.additionalDetails?.coApplicantWorkEmail && !validEmail(applicant.additionalDetails.coApplicantWorkEmail) ? 'Enter a valid co-applicant work email address.' : '')} />{applicant.additionalDetails?.coApplicantWorkEmail && !validEmail(applicant.additionalDetails.coApplicantWorkEmail) && <small className="field-error">Enter a valid work email address.</small>}</label>
            <label>Current Address<input value={applicant.additionalDetails?.coApplicantCurrentAddress || ''} onChange={e => setApplicantExtra('coApplicantCurrentAddress', e.target.value)} /></label>
            <label>Permanent Address<input value={applicant.additionalDetails?.coApplicantPermanentAddress || ''} onChange={e => setApplicantExtra('coApplicantPermanentAddress', e.target.value)} /></label>
            <label>City<input value={applicant.additionalDetails?.coApplicantCity || ''} onChange={e => setApplicantExtra('coApplicantCity', e.target.value)} /></label>
            <label>State<select value={applicant.additionalDetails?.coApplicantState || ''} onChange={e => setApplicantExtra('coApplicantState', e.target.value)}><option value="">Select state</option>{INDIA_STATES.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
            <label>PIN Code<input inputMode="numeric" maxLength={6} value={applicant.additionalDetails?.coApplicantPincode || ''} onChange={e => setApplicantExtra('coApplicantPincode', e.target.value.replace(/\D/g,'').slice(0,6))} /></label>
            <label>Residence Type<select value={applicant.additionalDetails?.coApplicantResidenceType || ''} onChange={e => setApplicantExtra('coApplicantResidenceType', e.target.value)}><option value="">Select</option><option>Owned</option><option>Rented</option></select></label>
            <label>Years at Address<input type="number" min="0" value={applicant.additionalDetails?.coApplicantYearsAtAddress || ''} onChange={e => setApplicantExtra('coApplicantYearsAtAddress', e.target.value)} /></label>
            <label>Account Holder<input value={applicant.additionalDetails?.coApplicantAccountHolder || ''} onChange={e => setApplicantExtra('coApplicantAccountHolder', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Bank Account<input value={applicant.additionalDetails?.coApplicantAccountNumber || ''} onChange={e => setApplicantExtra('coApplicantAccountNumber', e.target.value.replace(/\D/g,''))} /></label>
            <label>IFSC<span className="ifsc-input-wrap"><input maxLength={11} value={applicant.additionalDetails?.coApplicantIfsc || ''} onChange={e => setApplicantExtra('coApplicantIfsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><button type="button" className="secondary ifsc-finder" onClick={() => void lookupIfsc('coApplicant', applicant.additionalDetails?.coApplicantIfsc || '', 'coApplicantBank', 'coApplicantBranch')}>Find IFSC</button></span>{ifscMessages.coApplicant?.text && <small className={ifscMessages.coApplicant.error ? 'field-error' : 'field-success'}>{ifscMessages.coApplicant.text}</small>}</label>
            <label>Bank Name<input value={applicant.additionalDetails?.coApplicantBank || ''} onChange={e => setApplicantExtra('coApplicantBank', e.target.value)} /></label>
            <label>Branch<input value={applicant.additionalDetails?.coApplicantBranch || ''} onChange={e => setApplicantExtra('coApplicantBranch', e.target.value)} /></label>
            <label>Account Type<select value={applicant.additionalDetails?.coApplicantAccountType || ''} onChange={e => setApplicantExtra('coApplicantAccountType', e.target.value)}><option value="">Select</option><option>Savings</option><option>Current</option></select></label>
            </div></section>}
            <label className="full-width checkbox-field inline-checkbox-field"><span><input type="checkbox" checked={referenceEnabled || applicant.additionalDetails?.referencesEnabled === 'true'} onChange={e=>{setReferenceEnabled(e.target.checked);setApplicantExtra('referencesEnabled',String(e.target.checked));}} /></span>Add Reference Details</label>
            {(referenceEnabled || applicant.additionalDetails?.referencesEnabled === 'true') && <section className="full-width card form-card"><h3>Reference Details</h3>
              {Array.from({length:referenceCount},(_,i)=>i+1).map(i=><div key={i} style={{padding:12,marginBottom:12,border:'1px solid #cbd5e1',borderRadius:8}}>
                <div className="inline-actions" style={{justifyContent:'space-between'}}><strong>Reference {i} (Optional)</strong><span>{i===referenceCount&&<button type="button" className="secondary" onClick={()=>setReferenceCount(c=>c+1)} aria-label="Add reference">+ Add</button>}{i>1&&<button type="button" className="secondary" onClick={()=>{setReferenceCount(c=>c-1);setApplicant(previous=>{const additionalDetails={...(previous.additionalDetails||{})};for(const key of Object.keys(additionalDetails))if(key.startsWith(`reference${i}`))delete additionalDetails[key];return {...previous,additionalDetails};});}} aria-label="Remove reference">− Remove</button>}</span></div>
                <div className="field-grid">
                  <label>Full Name<input value={applicant.additionalDetails?.[referenceField(i,'Name')]||''} onChange={e=>updateReference(i,'Name',e.target.value.replace(/[^A-Za-z .'-]/g,''))}/></label>
                  <label>Relationship<select value={applicant.additionalDetails?.[referenceField(i,'Relationship')]||''} onChange={e=>updateReference(i,'Relationship',e.target.value)}><option value="">Select</option>{['Friend','Relative','Colleague','Neighbour','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
                  <label>Mobile Number<input inputMode="numeric" maxLength={10} value={applicant.additionalDetails?.[referenceField(i,'Mobile')]||''} onChange={e=>updateReference(i,'Mobile',e.target.value.replace(/\D/g,'').slice(0,10))}/></label>
                  <label>Reference ID Proof Type<select value={applicant.additionalDetails?.[referenceField(i,'IdType')]||''} onChange={e=>updateReference(i,'IdType',e.target.value)}><option value="">Select</option>{['PAN','Aadhaar','Voter ID','Driving Licence','Passport'].map(v=><option key={v}>{v}</option>)}</select></label>
                  <label>Document / ID Number<input value={applicant.additionalDetails?.[referenceField(i,'IdNumber')]||''} onChange={e=>updateReference(i,'IdNumber',e.target.value)}/></label>
                  <label>Address / City<input value={applicant.additionalDetails?.[referenceField(i,'Address')]||''} onChange={e=>updateReference(i,'Address',e.target.value)}/></label>
                </div></div>)}
            </section>}
            <label className="full-width checkbox-field inline-checkbox-field"><span><input type="checkbox" checked={isGuarantorIncluded} onChange={event => handleGuarantorToggle(event.target.checked)} /></span>Add a guarantor</label>
            {guarantorEnabled && <section className="full-width card form-card" aria-label="Guarantor Details"><h3>Guarantor Details</h3><div className="field-grid">
            <label>Name <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorName || ''} onChange={e => setApplicantExtra('guarantorName', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} />{applicant.additionalDetails?.guarantorName && !validName(applicant.additionalDetails.guarantorName) && <small className="field-error">Name should contain letters only.</small>}</label>
            <label>Relationship <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorRelationship || ''} onChange={e => setApplicantExtra('guarantorRelationship', e.target.value)}><option value="">Select relationship</option><option>Spouse</option><option>Parent</option><option>Child</option><option>Sibling</option><option>Relative</option><option>Other</option></select></label>
            <label>PAN <span className="required-asterisk" aria-label="required">*</span><input required maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" value={applicant.additionalDetails?.guarantorPan || ''} onChange={e => setApplicantExtra('guarantorPan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />{applicant.additionalDetails?.guarantorPan && !validPan(applicant.additionalDetails.guarantorPan) && <small className="field-error">PAN should look like ABCDE1234F.</small>}</label>
            <label>Mobile <span className="required-asterisk" aria-label="required">*</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-label="Country code">+91</span><input required type="tel" inputMode="numeric" minLength={10} maxLength={10} pattern="[0-9]{10}" value={applicant.additionalDetails?.guarantorMobile || ''} onChange={e => setApplicantExtra('guarantorMobile', e.target.value.replace(/\D/g, '').slice(0, 10))} /></span></label>
            <label>Email <span className="required-asterisk" aria-label="required">*</span><input required type="email" value={applicant.additionalDetails?.guarantorEmail || ''} onChange={e => setApplicantExtra('guarantorEmail', e.target.value)} onBlur={() => setValidationMessage(applicant.additionalDetails?.guarantorEmail && !validEmail(applicant.additionalDetails.guarantorEmail) ? 'Enter a valid guarantor email address.' : '')} />{applicant.additionalDetails?.guarantorEmail && !validEmail(applicant.additionalDetails.guarantorEmail) && <small className="field-error">Enter a valid email address.</small>}</label>
            <label className="full-width">Address <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorAddress || ''} onChange={e => setApplicantExtra('guarantorAddress', e.target.value)} /></label>
            <label>KYC/Bureau Consent <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorConsent || 'false'} onChange={e => setApplicantExtra('guarantorConsent', e.target.value)}><option value="false">Not provided</option><option value="true">Consented</option></select></label>
            <label>KYC Status<input readOnly value={applicant.additionalDetails?.guarantorKycStatus || 'Not started'} /></label>
            <label>Date of Birth <span className="required-asterisk" aria-label="required">*</span><input required type="date" max={new Date().toISOString().slice(0,10)} value={applicant.additionalDetails?.guarantorDob || ''} onChange={e => setApplicantExtra('guarantorDob', e.target.value)} /></label>
            <label>Age <span className="required-asterisk" aria-label="required">*</span><input readOnly value={calculateAge(applicant.additionalDetails?.guarantorDob || '')} /></label>
            <label>Gender <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorGender || ''} onChange={e => setApplicantExtra('guarantorGender', e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></label>
            <label>Father's / Spouse Name <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorFatherSpouse || ''} onChange={e => setApplicantExtra('guarantorFatherSpouse', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Mother's Name <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorMother || ''} onChange={e => setApplicantExtra('guarantorMother', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Marital Status <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorMaritalStatus || ''} onChange={e => setApplicantExtra('guarantorMaritalStatus', e.target.value)}><option value="">Select</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select></label>
            <label>Nationality <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorNationality || ''} onChange={e => setApplicantExtra('guarantorNationality', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Aadhaar / KYC Document <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorKycDocument || ''} onChange={e => setApplicantExtra('guarantorKycDocument', e.target.value)} /></label>
            <label>Alternate ID Type <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorAlternateIdType || ''} onChange={e => setApplicantExtra('guarantorAlternateIdType', e.target.value)}><option value="">Select</option><option>Voter ID</option><option>Driving Licence</option><option>Passport</option></select></label>
            <label>Alternate ID Number <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorAlternateIdNumber || ''} onChange={e => setApplicantExtra('guarantorAlternateIdNumber', e.target.value)} /></label>
            <label>Current Address <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorCurrentAddress || ''} onChange={e => setApplicantExtra('guarantorCurrentAddress', e.target.value)} /></label>
            <label>Permanent Address <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorPermanentAddress || ''} onChange={e => setApplicantExtra('guarantorPermanentAddress', e.target.value)} /></label>
            <label>City <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorCity || ''} onChange={e => setApplicantExtra('guarantorCity', e.target.value)} /></label>
            <label>State <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorState || ''} onChange={e => setApplicantExtra('guarantorState', e.target.value)}><option value="">Select state</option>{INDIA_STATES.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
            <label>PIN Code <span className="required-asterisk" aria-label="required">*</span><input required inputMode="numeric" minLength={6} maxLength={6} pattern="[1-9][0-9]{5}" value={applicant.additionalDetails?.guarantorPincode || ''} onChange={e => setApplicantExtra('guarantorPincode', e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
            <label>Residence Type <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorResidenceType || ''} onChange={e => setApplicantExtra('guarantorResidenceType', e.target.value)}><option value="">Select</option><option>Owned</option><option>Rented</option></select></label>
            <label>Years at Address <span className="required-asterisk" aria-label="required">*</span><input required type="number" min="0" value={applicant.additionalDetails?.guarantorYearsAtAddress || ''} onChange={e => setApplicantExtra('guarantorYearsAtAddress', e.target.value)} /></label>
            <label>Employer / Business <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorEmployer || ''} onChange={e => setApplicantExtra('guarantorEmployer', e.target.value)} /></label>
            <label>Designation / User Type <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorDesignation || ''} onChange={e => setApplicantExtra('guarantorDesignation', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Years in Job / Business <span className="required-asterisk" aria-label="required">*</span><input required type="number" min="0" value={applicant.additionalDetails?.guarantorExperience || ''} onChange={e => setApplicantExtra('guarantorExperience', e.target.value)} /></label>
            <label>Monthly Income <span className="required-asterisk" aria-label="required">*</span><input required type="number" min="0" value={applicant.additionalDetails?.guarantorMonthlyIncome || ''} onChange={e => setApplicantExtra('guarantorMonthlyIncome', e.target.value)} /></label>
            <label>Annual Income <span className="required-asterisk" aria-label="required">*</span><input required type="number" min="0" value={applicant.additionalDetails?.guarantorAnnualIncome || ''} onChange={e => setApplicantExtra('guarantorAnnualIncome', e.target.value)} /></label>
            <label>Other Income <span className="required-asterisk" aria-label="required">*</span><input required type="number" min="0" value={applicant.additionalDetails?.guarantorOtherIncome || ''} onChange={e => setApplicantExtra('guarantorOtherIncome', e.target.value)} /></label>
            <label>Account Holder <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorAccountHolder || ''} onChange={e => setApplicantExtra('guarantorAccountHolder', e.target.value.replace(/[^A-Za-z .'-]/g, ''))} /></label>
            <label>Bank Account <span className="required-asterisk" aria-label="required">*</span><input required inputMode="numeric" value={applicant.additionalDetails?.guarantorAccountNumber || ''} onChange={e => setApplicantExtra('guarantorAccountNumber', e.target.value.replace(/\D/g, ''))} /></label>
            <label>IFSC <span className="required-asterisk" aria-label="required">*</span><span className="ifsc-input-wrap"><input required maxLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" value={applicant.additionalDetails?.guarantorIfsc || ''} onChange={e => setApplicantExtra('guarantorIfsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onBlur={() => {
              const code = applicant.additionalDetails?.guarantorIfsc || '';
              setIfscMessages(prev => ({ ...prev, guarantor: code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code) ? { text: 'IFSC must be 11 characters, e.g. ABCD0123456.', error: true } : { text: '', error: false } }));
            }} /><button type="button" className="secondary ifsc-finder" onClick={() => void lookupIfsc('guarantor', applicant.additionalDetails?.guarantorIfsc || '', 'guarantorBank', 'guarantorBranch')}>Find IFSC</button></span>{ifscMessages.guarantor?.text && <small className={ifscMessages.guarantor.error ? 'field-error' : 'field-success'}>{ifscMessages.guarantor.text}</small>}</label>
            <label>Bank Name <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorBank || ''} onChange={e => setApplicantExtra('guarantorBank', e.target.value)} /></label>
            <label>Branch <span className="required-asterisk" aria-label="required">*</span><input required value={applicant.additionalDetails?.guarantorBranch || ''} onChange={e => setApplicantExtra('guarantorBranch', e.target.value)} /></label>
            <label>Account Type <span className="required-asterisk" aria-label="required">*</span><select required value={applicant.additionalDetails?.guarantorAccountType || ''} onChange={e => setApplicantExtra('guarantorAccountType', e.target.value)}><option value="">Select</option><option>Savings</option><option>Current</option></select></label>
            </div></section>}
            </div>
          </div>
        </section>

        <section className="card form-card employment-income-block" style={{display: (session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && currentStep === 1 ? undefined : 'none'}} onBlurCapture={scheduleAutoSave}>
          <h2>Employment & Income</h2>
          <div className="field-grid">
            <label>Employment Type <span className="required-asterisk">*</span>
              <select required value={employment.employmentType} onChange={(e) => setEmployment({ ...employment, employmentType: e.target.value })}>
                <option value="">Select</option>
                <option value="SALARIED">Salaried</option>
                <option value="SELF_EMPLOYED">Self Employed</option>
                <option value="BUSINESS_OWNER">Business Owner</option>
              </select>
            </label>
            {employment.employmentType === 'SALARIED' && <>
              <label>Employer Name <span className="required-asterisk">*</span><input required value={employment.employerName} onChange={(e) => setEmployment({ ...employment, employerName: e.target.value })} /></label>
              <label>Designation <span className="required-asterisk">*</span><input required value={employment.designation} onChange={(e) => setEmployment({ ...employment, designation: e.target.value.replace(/[^A-Za-z .'-]/g, '') })} /></label>
              <label>Current Employer Experience (years) <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.currentEmployerExperienceYears} onChange={(e) => setEmployment({ ...employment, currentEmployerExperienceYears: e.target.value })} /></label>
            </>}
            <label>Total Experience / Years in Profession (years) <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.totalWorkExperienceYears} onChange={(e) => setEmployment({ ...employment, totalWorkExperienceYears: e.target.value })} /></label>
            <label>{employment.employmentType === 'SALARIED' ? 'Monthly Net Salary' : 'Monthly Net Income'} <span className="required-asterisk">*</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true">₹</span><input required inputMode="numeric" min="1" value={formatIndianIncome(employment.monthlyInHandSalary)} onChange={e => setEmployment({ ...employment, monthlyInHandSalary: e.target.value.replace(/\D/g, '') })} /></span><small className="field-hint">Enter your monthly take-home income in rupees.</small></label>
            <label>Monthly Gross Salary <span className="required-asterisk">*</span><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true">₹</span><input required inputMode="numeric" min="0" value={formatIndianIncome(employment.monthlyGrossSalary)} onChange={e => setEmployment({ ...employment, monthlyGrossSalary: e.target.value.replace(/\D/g, '') })} /></span><small className="field-hint">Enter gross salary or income before deductions in rupees.</small></label>
            {employment.employmentType === 'SALARIED' && <div className="full-width field-grid">
              <label>Employer Address <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.employerAddress || ''} onChange={e => setEmploymentExtra('employerAddress', e.target.value)} /></label>
              <label>Official Email <span className="required-asterisk">*</span><input required type="email" value={employment.additionalDetails?.officialEmail || ''} onChange={e => setEmploymentExtra('officialEmail', e.target.value)} onBlur={() => setValidationMessage(employment.additionalDetails?.officialEmail && !validEmail(employment.additionalDetails.officialEmail) ? 'Enter a valid employer official email address.' : '')} />{employment.additionalDetails?.officialEmail && !validEmail(employment.additionalDetails.officialEmail) && <small className="field-error">Enter a valid employer official email address.</small>}</label>
              <label>Employee ID <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.employeeId || ''} onChange={e => setEmploymentExtra('employeeId', e.target.value)} /></label>
              <label>Employment Contract Type <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.employmentContractType || ''} onChange={e => setEmploymentExtra('employmentContractType', e.target.value)}><option value="">Select</option><option>PERMANENT</option><option>CONTRACT</option></select></label>
              <label>Employer Category <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.employerCategory || ''} onChange={e => setEmploymentExtra('employerCategory', e.target.value)}><option value="">Select</option><option>GOVERNMENT</option><option>LISTED</option><option>MNC</option><option>OTHER</option></select></label>
              <label>Annual Income / CTC <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.totalAnnualIncome || ''} onChange={e => setEmploymentExtra('totalAnnualIncome', e.target.value)} /></label>
              <label>Salary Credit Mode <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.salaryCreditMode || ''} onChange={e => setEmploymentExtra('salaryCreditMode', e.target.value)}><option value="">Select</option><option>Bank transfer</option><option>Cheque</option><option>Cash</option></select></label>
            </div>}
            {employment.employmentType === 'SELF_EMPLOYED' && <div className="full-width field-grid">
              <label>Profession <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.profession || ''} onChange={e => setEmploymentExtra('profession', e.target.value)} /></label>
              <label>Professional Qualification <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.qualification || ''} onChange={e => setEmploymentExtra('qualification', e.target.value)}><option value="">Select qualification</option><option>Below 10th</option><option>10th Pass</option><option>12th Pass</option><option>Diploma</option><option>Graduate</option><option>Postgraduate</option><option>Doctorate</option><option>Other</option></select></label>
              <label>Practice / Business Name <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.practiceBusinessName || ''} onChange={e => setEmploymentExtra('practiceBusinessName', e.target.value)} /></label>
              <label>Constitution <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.constitution || ''} onChange={e => setEmploymentExtra('constitution', e.target.value)}><option value="">Select constitution</option><option>Proprietorship</option><option>Partnership</option><option>LLP</option><option>Private Limited</option><option>Public Limited</option><option>Other</option></select></label>
              <label>Registration Number <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.registrationNumber || ''} onChange={e => setEmploymentExtra('registrationNumber', e.target.value)} /></label>
              <label>Practice Vintage <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.practiceVintage || ''} onChange={e => setEmploymentExtra('practiceVintage', e.target.value)} /></label>
              <label>Years in Profession (years) <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.yearsInProfession || ''} onChange={e => setEmploymentExtra('yearsInProfession', e.target.value)} /></label>
              <label>Business Address <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.businessAddress || ''} onChange={e => setEmploymentExtra('businessAddress', e.target.value)} /></label>
              <label>Nature of Work <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.natureOfWork || ''} onChange={e => setEmploymentExtra('natureOfWork', e.target.value)} /></label>
              <label>Gross Receipts (annual) <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.grossReceipts || ''} onChange={e => setEmploymentExtra('grossReceipts', e.target.value)} /></label>
              <label>Net Profit / Income <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.netProfit || ''} onChange={e => setEmploymentExtra('netProfit', e.target.value)} /></label>
            </div>}
            {employment.employmentType === 'BUSINESS_OWNER' && <div className="full-width field-grid">
              <h3 className="full-width">Business Information</h3>
              <label>Business Name <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.practiceBusinessName || ''} onChange={e => setEmploymentExtra('practiceBusinessName', e.target.value)} /></label>
              <label>Business PAN <span className="required-asterisk">*</span><input required maxLength={10} value={employment.additionalDetails?.businessPan || ''} onChange={e => setEmploymentExtra('businessPan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
              <label>Constitution <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.constitution || ''} onChange={e => setEmploymentExtra('constitution', e.target.value)}><option value="">Select constitution</option><option>Proprietorship</option><option>Partnership</option><option>LLP</option><option>Private Limited</option><option>Public Limited</option><option>Other</option></select></label>
              <label>Nature of Business <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.natureOfWork || ''} onChange={e => setEmploymentExtra('natureOfWork', e.target.value)} /></label>
              <label>Industry <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.industry || ''} onChange={e => setEmploymentExtra('industry', e.target.value)} /></label>
              <label>Business / Registered Address <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.registeredAddress || ''} onChange={e => setEmploymentExtra('registeredAddress', e.target.value)} /></label>
              <label>Incorporation / Start Date <span className="required-asterisk">*</span><input required type="date" value={employment.additionalDetails?.incorporationDate || ''} onChange={e => setEmploymentExtra('incorporationDate', e.target.value)} /></label>
              <label>Registration Number (CIN / LLPIN / Udyam) <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.registrationNumber || ''} onChange={e => setEmploymentExtra('registrationNumber', e.target.value)} /></label>
              <label>Premises <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.premises || ''} onChange={e => setEmploymentExtra('premises', e.target.value)}><option value="">Select</option><option>Owned</option><option>Rented</option></select></label>
              <label>Business Phone <span className="required-asterisk">*</span><input required inputMode="numeric" minLength={10} maxLength={10} pattern="[0-9]{10}" value={employment.additionalDetails?.businessPhone || ''} onChange={e => setEmploymentExtra('businessPhone', e.target.value.replace(/\D/g,'').slice(0,10))} /></label>
              <label>Business Email <span className="required-asterisk">*</span><input required type="email" value={employment.additionalDetails?.businessEmail || ''} onChange={e => setEmploymentExtra('businessEmail', e.target.value)} onBlur={() => setValidationMessage(employment.additionalDetails?.businessEmail && !validEmail(employment.additionalDetails.businessEmail) ? 'Enter a valid business email address.' : '')} />{employment.additionalDetails?.businessEmail && !validEmail(employment.additionalDetails.businessEmail) && <small className="field-error">Enter a valid business email address.</small>}</label>
              <label>Number of Employees <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.employeeCount || ''} onChange={e => setEmploymentExtra('employeeCount', e.target.value)} /></label>
              <label className="full-width">Owners / Partners / Directors (name, PAN, shareholding, KYC/consent) <span className="required-asterisk">*</span><textarea required value={employment.additionalDetails?.ownersPartnersDirectors || ''} onChange={e => setEmploymentExtra('ownersPartnersDirectors', e.target.value)} /></label>
              <label>Authorised Signatory <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.authorizedSignatory || ''} onChange={e => setEmploymentExtra('authorizedSignatory', e.target.value)} /></label>
              <label>Relationship with Applicant <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.relationshipToApplicant || ''} onChange={e => setEmploymentExtra('relationshipToApplicant', e.target.value)} /></label>
              <h3 className="full-width">Financials & Tax</h3>
              <label>Annual Turnover (last 2–3 years) <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.annualTurnover || ''} onChange={e => setEmploymentExtra('annualTurnover', e.target.value)} /></label>
              <label>Gross Receipts <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.grossReceipts || ''} onChange={e => setEmploymentExtra('grossReceipts', e.target.value)} /></label>
              <label>Net Profit / Income <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.netProfit || ''} onChange={e => setEmploymentExtra('netProfit', e.target.value)} /></label>
              <label>Monthly Average Turnover <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.monthlyAverageTurnover || ''} onChange={e => setEmploymentExtra('monthlyAverageTurnover', e.target.value)} /></label>
              <label>Net Worth <span className="required-asterisk">*</span><input required type="number" min="0" value={employment.additionalDetails?.netWorth || ''} onChange={e => setEmploymentExtra('netWorth', e.target.value)} /></label>
              <label>GST Registered? <span className="required-asterisk">*</span><select required value={employment.additionalDetails?.gstRegistered || ''} onChange={e => setEmploymentExtra('gstRegistered', e.target.value)}><option value="">Select</option><option>Yes</option><option>No</option></select></label>
              {employment.additionalDetails?.gstRegistered === 'Yes' && <label>GSTIN <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.gstin || ''} onChange={e => setEmploymentExtra('gstin', e.target.value.toUpperCase())} /></label>}
              <label>GST Return Filing Status <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.gstFilingStatus || ''} onChange={e => setEmploymentExtra('gstFilingStatus', e.target.value)} /></label>
              <label>ITR Acknowledgement Number <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.itrNumber || ''} onChange={e => setEmploymentExtra('itrNumber', e.target.value)} /></label>
              <label className="full-width">Existing Loans / Obligations <span className="required-asterisk">*</span><input required value={employment.additionalDetails?.existingLoans || ''} onChange={e => setEmploymentExtra('existingLoans', e.target.value)} /></label>
            </div>}
            <div className="eligibility-box">
              <h3>Initial affordability indicator</h3>
              <p>{Number(employment.monthlyInHandSalary || 0) > 0 ? 'Looking good — your income details are captured. Final affordability depends on existing obligations, bureau information and product policy.' : 'Add your monthly income to see an initial affordability indicator.'}</p>
              <p>This is an early estimate, not an approval or final eligibility decision.</p>
            </div>
          </div>
        </section>

        <section className="card form-card" style={{display: (session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && currentStep === 3 ? undefined : 'none'}} onBlurCapture={scheduleAutoSave}>
          <h2>Credit Score</h2>
          <p className="credit-temp-id">Temporary Application ID: <strong>{applicationId ? `DRAFT-${applicationId}` : localDraftId || 'Creating draft…'}</strong></p>
          {!applicationId && localDraftId && <p className="subtitle" role="status">Local-development draft only; not saved to the backend. Saving, uploading documents, and submitting still require a backend application.</p>}
          <div className="credit-mode-toggle" role="group" aria-label="Credit score entry mode">
            <button type="button" className={creditMode === 'MANUAL' ? 'primary' : 'secondary'} aria-pressed={creditMode === 'MANUAL'} onClick={() => { setCreditMode('MANUAL'); setApplicantExtra('creditScoreMode', 'MANUAL'); setValidationMessage(''); }}>Enter Manually</button>
            <button type="button" className={creditMode === 'ONLINE' ? 'primary' : 'secondary'} aria-pressed={creditMode === 'ONLINE'} onClick={() => { setCreditMode('ONLINE'); setApplicantExtra('creditScoreMode', 'ONLINE'); setValidationMessage(''); }}>Check Online</button>
            </div>
          {creditMode === 'MANUAL' ? <div className="credit-manual-field">
            <label>Enter your credit score (300–900)
              <input type="number" inputMode="numeric" min={300} max={900} step={1} value={manualCreditScore} onChange={e => { const v = e.target.value; setManualCreditScore(v); setApplicantExtra('selfReportedCreditScore', v); }} placeholder="e.g. 750" />
            </label>
            {manualCreditScore !== '' && (/^[0-9]{3}$/.test(manualCreditScore) && Number(manualCreditScore) >= 300 && Number(manualCreditScore) <= 900 ?
              <p className="credit-score-status" role="status"><CreditScoreRating score={Number(manualCreditScore)} /><span>— Self-reported score (not bureau verified).</span></p>
              : <p className="field-error" role="alert">Enter a whole number between 300 and 900.</p>)}
            <p className="subtitle">This is only an indicative classification. Manual entry does not perform a bureau check or verify eligibility.</p>
          </div> : <div className="credit-online-field">
            <div className="score-box"><div><span className="label">Bureau Credit Score</span><strong>{creditScore ?? '—'}</strong></div>{creditScore !== null && <CreditScoreRating score={creditScore} />}</div>
            {creditUsingMock && <p className="subtitle" role="status">Mock credit score (750) for local development only — not bureau verified or saved to the backend.</p>}
            <button type="button" className="primary" disabled={isCheckingCredit || applicant.additionalDetails?.kycBureauConsent !== 'true'} onClick={() => void handleRunCreditCheck()}>{isCheckingCredit ? 'Checking…' : 'Fetch Credit Score from Bureau'}</button>
            <p className="subtitle">The online check starts only when you click this button after granting consent. Availability depends on the configured bureau provider.</p>
            {isCheckingCredit && <div className="verification-progress" role="status"><span className="spinner" /> Connecting to KYC and bureau provider…</div>}
          </div>}
          <label className="credit-consent-row"><input type="checkbox" checked={applicant.additionalDetails?.kycBureauConsent === 'true'} onChange={e => { setApplicantExtra('kycBureauConsent', String(e.target.checked)); setValidationMessage(e.target.checked ? 'Consent selected. You can now continue with the selected score method.' : 'Consent removed. Online credit checks are disabled.'); }} /><span>I consent to KYC verification and a credit bureau enquiry for assessing this loan application.</span></label>
          <p className="subtitle">Consent is required for the loan application. Selecting it alone does not fetch a bureau score.</p>
        </section>

        <section className="card form-card" style={{display: (session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && currentStep === 3 ? undefined : 'none'}} onBlurCapture={scheduleAutoSave}>
          <h2>KYC Verification</h2>
          <div className="field-grid">
            <label>Customer
              <input value={applicant.fullName} readOnly />
            </label>
            <label>Verification Type
              <input value="PAN_VERIFICATION" readOnly />
            </label>
          </div>
          {session.role === 'ADMIN' && <div className="field-grid" style={{ marginTop: 18 }}>
            <label>Mock KYC Mode
              <select value={mockKycMode} onChange={(e) => setMockKycMode(e.target.value)}>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="MANUAL">MANUAL</option>
              </select>
            </label>
          </div>}
          {session.role === 'ADMIN' && <div className="inline-actions" style={{ marginTop: 18 }}>
            <button className="primary" onClick={() => {
              if (applicationId) {
                setKycMessage(`Mock mode: ${mockKycMode}`);
                handleStartKyc(applicationId);
              } else {
                setKycMessage('Create or select an application first.');
              }
            }}>Start KYC Verification</button>
          </div>}
          <div className="score-box" style={{ marginTop: 18 }}>
            <div>
              <span className="label">KYC Status</span>
              <strong>{kycStatus}</strong>
            </div>
            <div className={`badge ${kycStatus === 'Verified' ? 'success' : kycStatus === 'Failed' || kycStatus === 'Manual Review' ? 'warning' : 'info'}`}>
              {kycStatus}
            </div>
          </div>
          {kycMessage && <p style={{ margin: '12px 0 0', color: '#324a6e' }}>{kycMessage}</p>}
        </section>

        <section className="card form-card" style={{display: (session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && currentStep === 2 ? undefined : 'none'}} onBlurCapture={scheduleAutoSave}>
          <h2>Loan Details</h2>
          <div className="field-grid">
            <label>Loan Type
              <select value={loanDetails.loanType} onChange={(e) => {if(e.target.value!==newApplicationLoanType)setValidationMessage(`You had chosen ${newApplicationLoanType.replaceAll('_',' ')} on the dashboard. You can change the loan type.`);setLoanDetails({ ...loanDetails, loanType: e.target.value, interestRate: resolveInterestRate(e.target.value, '') });}}>
                <option value="PERSONAL_LOAN">Personal Loan</option>
                <option value="HOME_LOAN">Home Loan</option>
                <option value="CAR_LOAN">Car Loan</option>
                <option value="EDUCATION_LOAN">Education Loan</option>
                <option value="BUSINESS_LOAN">Business Loan</option>
                <option value="LOAN_AGAINST_PROPERTY">Loan Against Property</option>
              </select>
            </label>
            <label>Requested Loan Amount <span className="required-asterisk">*</span>
              <input inputMode="numeric" value={loanDetails.requestedLoanAmount === '' ? '' : formatCurrency(loanDetails.requestedLoanAmount)} onChange={(e) => setLoanDetails({ ...loanDetails, requestedLoanAmount: e.target.value.replace(/[^0-9]/g, '') })} aria-label="Requested loan amount in rupees" />
              <span className="subtitle">{pricingPolicy.minAmount && pricingPolicy.maxAmount ? `Allowed: ${formatCurrency(pricingPolicy.minAmount)} to ${formatCurrency(pricingPolicy.maxAmount)}` : 'Amount limits are set by the product policy.'}</span>
              <span className="inline-actions" style={{marginTop:6}}>{[100000,300000,500000].filter(amount => (!pricingPolicy.minAmount || amount >= pricingPolicy.minAmount) && (!pricingPolicy.maxAmount || amount <= pricingPolicy.maxAmount)).map(amount => <button type="button" className="secondary" key={amount} onClick={() => setLoanDetails({...loanDetails, requestedLoanAmount: amount})}>{formatCurrency(amount)}</button>)}</span>
              {pricingPolicy.minAmount && pricingPolicy.maxAmount && <input type="range" min={pricingPolicy.minAmount} max={pricingPolicy.maxAmount} step={["HOME_LOAN", "CAR_LOAN", "VEHICLE_LOAN", "LOAN_AGAINST_PROPERTY"].includes(loanDetails.loanType) ? 10000 : 1000} value={Math.min(pricingPolicy.maxAmount, Math.max(pricingPolicy.minAmount, Number(loanDetails.requestedLoanAmount) || pricingPolicy.minAmount))} onChange={e => setLoanDetails({...loanDetails, requestedLoanAmount: Number(e.target.value)})} aria-label="Adjust loan amount" />}
            </label>
            <label>Preferred Tenure <span className="required-asterisk">*</span><select value={loanDetails.preferredTenure} onChange={e => setLoanDetails({...loanDetails, preferredTenure: Number(e.target.value)})}>{[6,12,18,24,36,48,60,84,120,180,240,300,360].filter(months => (!pricingPolicy.minTenure || months >= pricingPolicy.minTenure) && (!pricingPolicy.maxTenure || months <= pricingPolicy.maxTenure)).map(months => <option key={months} value={months}>{months} months ({(months/12).toFixed(1)} years)</option>)}</select></label>
            <label>Your rate (% p.a.) <input value={formatInterestRate(effectiveInterestRate)} readOnly aria-readonly="true" title="Calculated from the product rate card and applicable credit policy. Personal Loans use 10.5% while pricing is pending or returns zero. Rate exceptions require approval." /></label>
            <label>Purpose of Loan<select value={(['Marriage','Illness','Higher Education','Home Purchase','Business','Vehicle Purchase','Debt Consolidation','Other'].includes(loanDetails.purposeOfLoan) ? loanDetails.purposeOfLoan : loanDetails.purposeOfLoan ? 'Other' : '')} onChange={e => setLoanDetails({...loanDetails, purposeOfLoan: e.target.value === 'Other' ? '' : e.target.value})}><option value="">Select purpose</option><option>Marriage</option><option>Illness</option><option>Higher Education</option><option>Home Purchase</option><option>Business</option><option>Vehicle Purchase</option><option>Debt Consolidation</option><option>Other</option></select></label><label>Purpose remark / Other purpose (optional)<input value={loanDetails.purposeOfLoan} placeholder="Describe the purpose if not listed" onChange={e => setLoanDetails({...loanDetails, purposeOfLoan: e.target.value})} /></label>
            <label>Net disbursal (₹)<input readOnly value={formatCurrency(calculatedFees.net)} /></label>
            <label>Rate type<input readOnly value={pricingPolicy.rateType === 'FIXED' ? 'Fixed' : 'Reducing balance'} /></label>
            <div className="full-width card" style={{padding:16}}>
              <h3>Fees and net disbursal</h3>
              <p>Processing fee ({pricingPolicy.processingFeePercent ?? 0}%): <strong>{formatCurrency(calculatedFees.processing)}</strong></p>
              <p>GST on processing fee ({pricingPolicy.gstPercent ?? 0}%): <strong>{formatCurrency(calculatedFees.gst)}</strong></p>
              <p>Insurance premium (if applicable): <strong>{formatCurrency(calculatedFees.insurance)}</strong></p>
              <p>Total fees and charges: <strong>{formatCurrency(calculatedFees.total)}</strong></p>
              <p>Net disbursal (upfront deductions): <strong>{formatCurrency(calculatedFees.net)}</strong></p>
              <p className="subtitle">Charges are determined by the approved product configuration, not editable by applicants or frontline staff.</p>
            </div>
            <label>Scheduled Disbursal Date<input type="date" min={new Date().toISOString().slice(0,10)} value={loanDetails.additionalDetails?.scheduledDisbursalDate || ''} onChange={e => setLoanExtra('scheduledDisbursalDate', e.target.value)} /></label>
          </div>

          {loanValidationMessage && (
            <div className="validation-box" style={{ marginTop: 16 }}>{loanValidationMessage}</div>
          )}

          {emiSummary && (
            <div className="emi-box" style={{ marginTop: 18 }}>
              <h3>EMI Calculation</h3>
              <p className="subtitle">Key Fact Statement preview: annual percentage rate (APR) must be calculated and confirmed by the lender before offer acceptance; nominal interest is not APR.</p>
              <div className="emi-grid">
                <div><span>Principal Amount</span><strong>{formatCurrency(emiSummary.principal)}</strong></div>
                <div><span>Interest Rate</span><strong>{formatInterestRate(emiSummary.interestRate)}</strong></div>
                <div><span>Tenure</span><strong>{emiSummary.tenure} months</strong></div>
                <div><span>Monthly EMI</span><strong>{formatCurrency(Math.round(emiSummary.monthlyEmi))}</strong></div>
                <div><span>Total Interest</span><strong>{formatCurrency(Math.round(emiSummary.totalInterest))}</strong></div>
                <div><span>Total Amount Payable</span><strong>{formatCurrency(Math.round(emiSummary.totalPayable))}</strong></div>
              </div>
              <div style={{marginTop:14}}>
                <div style={{display:'flex',height:12,borderRadius:8,overflow:'hidden'}} aria-label="Principal and interest breakdown"><div style={{width:`${100*emiSummary.principal/emiSummary.totalPayable}%`,background:'#2d70b7'}}/><div style={{flex:1,background:'#e9a344'}}/></div>
                <p className="subtitle">Principal {formatCurrency(emiSummary.principal)} · Interest {formatCurrency(Math.round(emiSummary.totalInterest))}</p>
                <p className="subtitle">Fees: processing {formatCurrency(calculatedFees.processing)}, GST {formatCurrency(calculatedFees.gst)}, insurance {formatCurrency(calculatedFees.insurance)}</p>
                <button type="button" className="secondary" onClick={() => setShowRepaymentSchedule(!showRepaymentSchedule)}>{showRepaymentSchedule ? 'Hide' : 'View'} repayment schedule</button>
                {showRepaymentSchedule && <div style={{maxHeight:300,overflow:'auto',marginTop:12}}><table style={{width:'100%'}}><thead><tr><th>Month</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody>{(() => { let balance = emiSummary.principal; const monthlyRate = emiSummary.interestRate / 1200; return Array.from({length:emiSummary.tenure}, (_,i) => { const interest = balance*monthlyRate; const principal = Math.min(balance, Math.max(0, emiSummary.monthlyEmi-interest)); balance = Math.max(0,balance-principal); return <tr key={i}><td>{i+1}</td><td>{formatCurrency(Math.round(principal))}</td><td>{formatCurrency(Math.round(interest))}</td><td>{formatCurrency(Math.round(balance))}</td></tr>; }); })()}</tbody></table></div>}
              </div>
            </div>
          )}

        </section>

        <section className="card form-card" style={{display: (session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && currentStep === 4 ? undefined : 'none'}} onBlurCapture={scheduleAutoSave}>
          <h2>Document Upload</h2>
          <p className="subtitle">Allowed formats: PDF, JPG, PNG. Maximum size: 5 MB per file.</p>

          {applicationId && <p>{status === 'SUBMITTED' ? 'Application Number' : 'Temporary ID'}: <strong>{status === 'SUBMITTED' ? (submittedApplication?.losNumber || `APP-${applicationId}`) : `DRAFT-${applicationId}`}</strong></p>}
          {isCreatingApplication && <p role="status">Creating application...</p>}

          {validationMessage && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: '#fff1f0', color: '#a61d1d', border: '1px solid #f5b7b1', fontWeight: 600 }}>
              {validationMessage}
            </div>
          )}

          <div className="doc-list">
            {requiredDocuments.map((doc) => {
              const item = documents[doc.key];
              const missing = doc.required && item.status !== 'VERIFIED';
              const rejected = item.status === 'UPLOAD_FAILED';
              const statusText = item.status === 'UPLOADING' ? 'Uploading...' : item.status === 'UPLOAD_FAILED' ? 'Upload Failed' : item.status === 'VERIFIED' ? 'Verified' : item.status === 'REJECTED' ? 'Rejected' : item.status === 'DEFICIENCY_RAISED' ? 'Deficiency raised' : item.status === 'UNDER_REVIEW' ? 'Under review' : item.status === 'UPLOADED' ? 'Uploaded · awaiting verification' : 'Not uploaded';

              return (
                <div className={`doc-item ${missing ? 'missing' : ''}`} key={doc.key} style={{
                  border: rejected ? '1px solid #f0b7b7' : ['VERIFIED','UPLOADED'].includes(item.status) ? '1px solid #b7dfc8' : '1px solid #dfe6f1',
                  background: rejected ? '#fff9f9' : '#ffffff',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.label}{doc.required && <span className="required-asterisk"> *</span>} {!doc.required && <span style={{color:'#65758b',fontWeight:400}}>(Optional)</span>}</div><div style={{fontSize:12,color:'#65758b',marginBottom:4}}>PDF, JPG, PNG · Up to 5 MB</div>
                    <div style={{ color: rejected ? '#b42318' : ['VERIFIED','UPLOADED'].includes(item.status) ? '#1f5b49' : '#65758b', fontWeight: 500 }}>
                      Status: {item.status === 'NOT_UPLOADED' ? (doc.required ? 'Required' : 'Optional') : statusText}
                    </div>
                    {item.status === 'UPLOADING' && <progress aria-label={`Uploading ${doc.label}`} style={{width:'100%'}} />}
                    {item.fileName && (
                      <div style={{ marginTop: 4, fontSize: 13, color: '#44607d' }}>
                        File: {item.fileName}
                      </div>
                    )}
                    {(item.error || item.verificationRemarks) && (
                      <div style={{ marginTop: 4, fontSize: 12, color: item.status === 'REJECTED' || item.status === 'DEFICIENCY_RAISED' || item.status === 'UPLOAD_FAILED' ? '#a61d1d' : '#44607d' }}>{item.error || item.verificationRemarks}</div>
                    )}
                    {selectedFiles[doc.key] && item.status === 'UPLOADED' && (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#44607d' }}>
                        Selected: {selectedFiles[doc.key]}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {['UPLOADED','UNDER_REVIEW','REJECTED','DEFICIENCY_RAISED','VERIFIED'].includes(item.status) ? (
                      <>
                        {session.role === 'USER' && item.status !== 'VERIFIED' && <button className="secondary" onClick={() => handleChooseFile(doc.key)}>Replace / Re-upload</button>}
                        {doc.key === 'PHOTOGRAPH' && <button className="secondary" onClick={() => handleCapturePhoto(doc.key)}>Camera</button>}
                        {session.role === 'USER' && item.status !== 'VERIFIED' && <button className="secondary" onClick={() => void handleRemoveDocument(doc.key)}>Remove</button>}
                        {item.id && <button className="secondary" type="button" onClick={() => handleViewDocument(item.id!)}>View</button>}
                        {session.role === 'ADMIN' && item.id && item.status !== 'VERIFIED' && <><button className="secondary" onClick={() => void handleReviewDocument(doc.key, 'VERIFIED')}>Verify</button><button className="secondary" onClick={() => void handleReviewDocument(doc.key, 'REJECTED')}>Reject</button><button className="secondary" onClick={() => void handleReviewDocument(doc.key, 'DEFICIENCY_RAISED')}>Raise deficiency</button></>}
                      </>
                    ) : (
                      <>
                      <button className="primary" onClick={() => handleChooseFile(doc.key)} disabled={item.status === 'UPLOADING' || isCreatingApplication}>
                        {item.status === 'UPLOADING' ? 'Uploading...' : 'Choose File'}
                      </button>
                        {doc.key === 'PHOTOGRAPH' && <button className="secondary" onClick={() => handleCapturePhoto(doc.key)}>Camera</button>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="inline-actions">
            <button className="secondary" onClick={() => void handleSaveDraft()} disabled={isCreatingApplication}>Save Draft</button>
            <button className="primary" onClick={() => { if (requiredDocumentsNotUploaded.length) { setValidationMessage(`Upload all required documents before continuing: ${requiredDocumentsNotUploaded.map(doc => doc.label).join(', ')}.`); return; } setHighestUnlockedStep(s => Math.max(s, 5)); setCurrentStep(5); setValidationMessage(''); }}>Continue to Review</button>
          </div>
        </section>

        {(session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && currentStep === 5 && <section className="card form-card"><h2>Review & Submit</h2><p>Review your details before final submission. You can go back to correct any information.</p><div className="field-grid"><div><strong>Applicant</strong><p>{applicant.fullName}</p>{identityTag('fullName')}</div><div><strong>PAN</strong><p>{applicant.panNumber}</p>{identityTag('panNumber')}</div><div><strong>Loan type</strong><p>{loanDetails.loanType.replaceAll('_',' ')}</p></div><div><strong>Requested amount</strong><p>{formatCurrency(loanDetails.requestedLoanAmount)}</p></div><div><strong>Tenure</strong><p>{loanDetails.preferredTenure} months</p></div><div><strong>EMI</strong><p>{emiSummary ? formatCurrency(Math.round(emiSummary.monthlyEmi)) : '—'}</p></div><div><strong>Missing required fields</strong><p>{missingFieldCount}</p></div><div><strong>Required documents missing</strong><p>{requiredDocumentsNotUploaded.length}</p></div></div><label className="review-declaration"><input type="checkbox" onChange={e => setLoanExtra('declarationAccepted', String(e.target.checked))} checked={loanDetails.additionalDetails?.declarationAccepted === 'true'} /> I declare that the information provided is accurate and consent to the applicable verification checks.</label><div className="inline-actions"><button className="secondary" onClick={() => setCurrentStep(1)}>Edit Applicant</button><button className="secondary" onClick={() => setCurrentStep(2)}>Edit Loan</button><button className="primary" onClick={handleSubmit}>Confirm & Submit</button></div></section>}
        {(session.role === 'ADMIN' ? staffView==='assisted' && staffApplicationOpen : !showUserDashboard) && submittedApplication && (
          <section className="card success-card">
            <h2>Application Submitted Successfully</h2>
            <div className="meta-row"><span>Application Number</span><strong>{submittedApplication.losNumber}</strong></div>
            <div className="meta-row"><span>Application Status</span><strong>{submittedApplication.status}</strong></div>
            <div className="meta-row"><span>Created On</span><strong>{new Date(submittedApplication.createdAt ?? Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
            <button type="button" className="primary" onClick={downloadApplicationSummary}>Download Application Summary</button>
          </section>
        )}

        {(session.role === 'USER' ? !showUserDashboard : staffView==='assisted' && staffApplicationOpen) && !submittedApplication && <div className="inline-actions" style={{position:'sticky',bottom:0,background:'var(--surface, #fff)',padding:'12px 0',zIndex:5}}><button className="secondary" disabled={currentStep === 1} onClick={() => setCurrentStep(s => Math.max(1,s-1))}>Back</button><button className="secondary" onClick={() => void handleSaveDraft()} disabled={isCreatingApplication}>Save Draft</button><button className="primary" disabled={currentStep !== 1 && Boolean(continueDisabledReason)} title={continueDisabledReason || undefined} onClick={handleContinue}>{currentStep === 5 ? 'Submit Application' : 'Continue'}</button><span style={{alignSelf:'center',fontSize:12,color:'#64748b'}}>Step {currentStep} of 5 · {saveIndicator || (applicationId ? 'Saved draft' : 'Not saved yet')}{continueDisabledReason ? ` · ${continueDisabledReason}` : ''}</span></div>}
        {session.role === 'ADMIN' && staffView==='recent' && !staffApplicationOpen && !showUnderwriting && (
          <section className="card table-card">
            <div className="inline-actions" style={{justifyContent:"space-between",alignItems:"center"}}><h2>Recent Applications</h2>{staffRoles.includes('APPLICATION_PROCESSOR')&&<button type="button" className="primary" onClick={handleNewApplication}>+ New Application</button>}</div>
            <div className="toolbar">
              <input placeholder="Search name, application number, or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
              </select>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Application Number</th>
                  <th>Applicant Name</th>
                  <th>Co-applicant</th>
                  <th>Loan Type</th>
                  <th>Requested / Sanctioned</th>
                  <th>Credit Score</th>
                  <th>Status</th>
                  <th>Stage</th>
                  <th>Owner</th>
                  <th>SLA / Pending Action</th>
                  <th>Created Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.losNumber ?? `DRAFT-${row.id}`}</td>
                    <td>{row.applicantName || 'Details pending'}</td>
                    <td>—</td>
                    <td>{(row.loanType || 'Not selected').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase())}</td>
                    <td>₹{row.requestedAmount ? row.requestedAmount.toLocaleString('en-IN') : '0'}</td>
                    <td>{row.creditScore ?? '—'}</td>
                    <td><span className={`badge ${statusColors[row.status] ?? 'neutral'}`}>{({DRAFT:'Draft',SUBMITTED:'Submitted',UNDER_REVIEW:'In review',DOCUMENTS_PENDING:'Action needed',CREDIT_CHECK_COMPLETED:'In review',APPROVED:'Approved',REJECTED:'Not approved'} as Record<string,string>)[row.status] || row.status.replace(/_/g, ' ')}</span></td>
                    <td>{row.status === 'DRAFT' ? 'Applicant details' : row.status === 'DOCUMENTS_PENDING' ? 'Documents' : row.status === 'CREDIT_CHECK_COMPLETED' ? 'Verification' : row.status === 'SUBMITTED' || row.status === 'UNDER_REVIEW' ? 'Underwriting' : row.status}</td>
                    <td>{row.status === 'DRAFT' ? 'Applicant' : 'Credit Operations'}</td>
                    <td>{row.status === 'DRAFT' ? 'Complete application' : row.status === 'DOCUMENTS_PENDING' ? 'Upload pending documents' : row.status === 'SUBMITTED' ? 'Review submission' : 'Review verification'}</td>
                    <td>{new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><button className="secondary" onClick={() => {setStaffView('recent');setShowUnderwriting(true);}}>Review Full Application</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inline-actions" style={{justifyContent:'flex-end',marginTop:16}}><button type="button" className="primary" onClick={()=>setShowUnderwriting(true)}>Open Pending Reviews & Validation</button></div>
          </section>
        )}
        </>}
      </main>
    </div>
  );
}

export default App;
