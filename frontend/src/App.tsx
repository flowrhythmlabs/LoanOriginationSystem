import { useEffect, useMemo, useRef, useState } from 'react';
import { LoginPage } from './LoginPage';
import { buildAuthHeaders, clearAuth, readStoredAuth, type AuthSession } from './auth';

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
};

type Employment = {
  employmentType: string;
  employerName: string;
  designation: string;
  totalWorkExperienceYears: number | string;
  currentEmployerExperienceYears: number | string;
  monthlyInHandSalary: number | string;
  monthlyGrossSalary: number | string;
};

type LoanDetails = {
  loanType: string;
  requestedLoanAmount: number | string;
  interestRate: number | string;
  preferredTenure: number | string;
  purposeOfLoan: string;
};

type ApplicationRow = {
  id: number;
  losNumber: string | null;
  applicantName: string;
  applicantMobile?: string;
  loanType: string;
  requestedAmount: number | null;
  creditScore: number | null;
  status: string;
  createdAt: string;
};

type DocumentType = 'BANK_STATEMENT' | 'LATEST_SALARY_SLIP' | 'PREVIOUS_SALARY_SLIP' | 'PAN_DOCUMENT';
type DocumentStatus = 'NOT_UPLOADED' | 'UPLOADING' | 'UPLOADED' | 'UPLOAD_FAILED';

type DocumentEntry = {
  id: number | null;
  documentType: DocumentType;
  documentName: string;
  status: DocumentStatus;
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  error: string | null;
};

const initialApplicant: Applicant = {
  fullName: 'Amit Sharma',
  dateOfBirth: '1994-05-15',
  panNumber: 'ABCDE1234F',
  mobileNumber: '9876543210',
  email: 'amit@example.com',
  workEmail: 'amit@company.com',
  residentialAddress: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001'
};

const initialEmployment: Employment = {
  employmentType: 'SALARIED',
  employerName: 'FinEdge Technologies',
  designation: 'Senior Analyst',
  totalWorkExperienceYears: 6,
  currentEmployerExperienceYears: 2,
  monthlyInHandSalary: 95000,
  monthlyGrossSalary: 130000
};

const initialLoanDetails: LoanDetails = {
  loanType: 'PERSONAL_LOAN',
  requestedLoanAmount: 500000,
  interestRate: 10.5,
  preferredTenure: 36,
  purposeOfLoan: 'Medical emergency'
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

const validateMobileNumber = (mobile: string) => {
  if (/\D/.test(mobile)) {
    return 'Mobile number must contain digits only.';
  }
  return /^\d{10}$/.test(mobile) ? '' : 'Please enter a valid 10-digit mobile number.';
};

const validateCreditScore = (value: string) => {
  if (!value) return 'Credit score is required.';
  if (!/^\d+$/.test(value)) return 'Enter a whole number using digits only.';
  const score = Number(value);
  return score >= 300 && score <= 900 ? '' : 'Credit score must be between 300 and 900.';
};

const getCreditScoreStatus = (value: string) => {
  const score = Number(value);
  if (score <= 649) return 'POOR';
  if (score <= 749) return 'FAIR';
  return 'GOOD';
};

const validatePanNumber = (value: string) =>
  !value ? 'PAN number is required.' : /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value) ? '' : 'Enter a valid PAN in the format ABCDE1234F.';

const validateApplicantFields = (applicant: Applicant) => ({
  fullName: !applicant.fullName.trim() ? 'Customer name is required.' : applicant.fullName.length > 120 ? 'Full name is too long.' : '',
  dateOfBirth: applicant.dateOfBirth ? '' : 'Date of birth is required.',
  panNumber: validatePanNumber(applicant.panNumber),
  mobileNumber: validateMobileNumber(applicant.mobileNumber),
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email) ? '' : 'Enter a valid email address.',
  workEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.workEmail) ? '' : 'Enter a valid work email address.',
  residentialAddress: !applicant.residentialAddress.trim() ? 'Residential address is required.' : applicant.residentialAddress.length > 300 ? 'Residential address is too long.' : '',
  city: !applicant.city.trim() ? 'City is required.' : applicant.city.length > 80 ? 'City is too long.' : '',
  state: !applicant.state.trim() ? 'State is required.' : applicant.state.length > 80 ? 'State is too long.' : '',
  pincode: /^[1-9][0-9]{5}$/.test(applicant.pincode) ? '' : 'Enter a valid 6-digit Indian pincode.'
});

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

const REQUIRED_DOCUMENTS: Array<{ key: DocumentType; label: string }> = [
  { key: 'BANK_STATEMENT', label: 'Bank Statement' },
  { key: 'LATEST_SALARY_SLIP', label: 'Latest Salary Slip' },
  { key: 'PREVIOUS_SALARY_SLIP', label: 'Previous Salary Slip' },
  { key: 'PAN_DOCUMENT', label: 'PAN Document' }
];

const createInitialDocuments = (): Record<DocumentType, DocumentEntry> => ({
  BANK_STATEMENT: { id: null, documentType: 'BANK_STATEMENT', documentName: 'Bank Statement', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  LATEST_SALARY_SLIP: { id: null, documentType: 'LATEST_SALARY_SLIP', documentName: 'Latest Salary Slip', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  PREVIOUS_SALARY_SLIP: { id: null, documentType: 'PREVIOUS_SALARY_SLIP', documentName: 'Previous Salary Slip', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null },
  PAN_DOCUMENT: { id: null, documentType: 'PAN_DOCUMENT', documentName: 'PAN Document', status: 'NOT_UPLOADED', fileName: null, fileSize: null, uploadedAt: null, error: null }
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
  const [applicantFieldErrors, setApplicantFieldErrors] = useState<Partial<Record<keyof Applicant, string>>>({});
  const [applicantMobileError, setApplicantMobileError] = useState('');
  const [employment, setEmployment] = useState<Employment>(initialEmployment);
  const [loanDetails, setLoanDetails] = useState<LoanDetails>(initialLoanDetails);
  const [creditScore, setCreditScore] = useState('');
  const [creditScoreTouched, setCreditScoreTouched] = useState(false);
  const [status, setStatus] = useState('DRAFT');
  const [submittedApplication, setSubmittedApplication] = useState<{ losNumber?: string; status?: string; createdAt?: string } | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [applicationCounts, setApplicationCounts] = useState({ total: 0, draft: 0, underReview: 0, submitted: 0 });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentEntry>>(createInitialDocuments());
  const [currentStep, setCurrentStep] = useState(1);
  const [kycStatus, setKycStatus] = useState('Not Validated');
  const [kycMessage, setKycMessage] = useState('');
  const [kycPanTouched, setKycPanTouched] = useState(false);
  const [verificationType, setVerificationType] = useState('PAN_VERIFICATION');
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [isCreatingApplication, setIsCreatingApplication] = useState(false);
  const applicationCreationRef = useRef<Promise<number> | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<DocumentType, string>>({
    BANK_STATEMENT: '',
    LATEST_SALARY_SLIP: '',
    PREVIOUS_SALARY_SLIP: '',
    PAN_DOCUMENT: ''
  });

  const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const authSession = readStoredAuth();
    const headers = new Headers(init.headers ?? {});
    if (authSession) {
      const authHeaders = buildAuthHeaders(authSession);
      authHeaders.forEach((value, key) => headers.set(key, value));
    }

    const response = await fetch(input, { ...init, headers });
    if (response.status === 401 || response.status === 403) {
      clearAuth();
      setSession(null);
    }
    return response;
  };

  const updateApplicantField = (field: keyof Applicant, value: string) => {
    setApplicant((current) => ({ ...current, [field]: value }));
    setApplicantFieldErrors((current) => ({ ...current, [field]: '' }));
    if (field === 'panNumber' || field === 'fullName') {
      setKycStatus('Not Validated');
      setKycMessage('');
    }
  };

  useEffect(() => {
    if (!session) {
      return;
    }
    fetchApplications(search, filterStatus);
  }, [session, search, filterStatus]);

  const fetchApplications = async (searchValue = search, statusValue = filterStatus) => {
    try {
      const query = new URLSearchParams({ search: searchValue, status: statusValue });
      const response = await apiFetch(`/api/applications?${query.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setApplications(data);
        const countsResponse = await apiFetch('/api/applications/counts');
        if (countsResponse.ok) {
          setApplicationCounts(await countsResponse.json());
        }
      } else {
        setApplications([]);
      }
    } catch {
      setApplications([]);
    }
  };

  const fetchDocuments = async (id: number) => {
    setDocuments(createInitialDocuments());
    setSelectedFiles({ BANK_STATEMENT: '', LATEST_SALARY_SLIP: '', PREVIOUS_SALARY_SLIP: '', PAN_DOCUMENT: '' });
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
            error: null
          };
          setSelectedFiles((prev) => ({ ...prev, [key]: item.fileName || prev[key] || '' }));
        }
      });
      setDocuments(next);
    } catch {
      setDocuments(createInitialDocuments());
    }
  };

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
      const response = await apiFetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant, employment, loanDetails })
      });
      const app = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(app?.message || 'Application creation failed');
      }
      if (!app?.id) {
        throw new Error('Application was saved without a valid application ID. Please retry.');
      }
      setApplicationId(app.id);
      setStatus(app.status || 'DRAFT');
      await fetchApplications();
      setValidationMessage(`Application created: ${app.losNumber || app.id}`);
      return app.id as number;
    })();
    applicationCreationRef.current = creation;
    try {
      return await creation;
    } finally {
      applicationCreationRef.current = null;
      setIsCreatingApplication(false);
    }
  };

  const handleOpenApplication = async (id: number) => {
    try {
      const response = await apiFetch(`/api/applications/${id}`);
      const app = await response.json().catch(() => null);
      if (!response.ok || !app) {
        throw new Error(app?.message || 'Application could not be loaded.');
      }
      setApplicationId(app.id);
      setApplicant({
        fullName: app.applicant.fullName,
        dateOfBirth: app.applicant.dateOfBirth,
        panNumber: app.applicant.panNumber,
        mobileNumber: app.applicant.mobileNumber,
        email: app.applicant.email,
        workEmail: app.applicant.workEmail,
        residentialAddress: app.applicant.residentialAddress,
        city: app.applicant.city,
        state: app.applicant.state,
        pincode: app.applicant.pincode
      });
      setApplicantFieldErrors({});
      setApplicantMobileError(validateMobileNumber(app.applicant.mobileNumber));
      setEmployment({
        employmentType: app.employmentDetails.employmentType,
        employerName: app.employmentDetails.employerName || '',
        designation: app.employmentDetails.designation || '',
        totalWorkExperienceYears: app.employmentDetails.totalWorkExperienceYears ?? '',
        currentEmployerExperienceYears: app.employmentDetails.currentEmployerExperienceYears ?? '',
        monthlyInHandSalary: app.employmentDetails.monthlyInHandSalary,
        monthlyGrossSalary: app.employmentDetails.monthlyGrossSalary ?? ''
      });
      setLoanDetails({
        loanType: app.loanDetails.loanType,
        requestedLoanAmount: app.loanDetails.requestedLoanAmount ?? '',
        interestRate: app.loanDetails.interestRate ?? '',
        preferredTenure: app.loanDetails.preferredTenure,
        purposeOfLoan: app.loanDetails.purposeOfLoan
      });
      setCreditScore(app.creditCheck?.creditScore === null || app.creditCheck?.creditScore === undefined ? '' : String(app.creditCheck.creditScore));
      setCreditScoreTouched(false);
      setKycStatus('Not Validated');
      setKycMessage('');
      setKycPanTouched(false);
      setStatus(app.status);
      setSubmittedApplication(app.status === 'SUBMITTED' ? app : null);
      setCurrentStep(4);
      setValidationMessage('');
      await fetchDocuments(app.id);
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Application could not be loaded.');
    }
  };

  const handleNewApplication = () => {
    if (isCreatingApplication) return;
    setApplicationId(null);
    setApplicant({ ...initialApplicant });
    setApplicantFieldErrors({});
    setApplicantMobileError('');
    setEmployment({ ...initialEmployment });
    setLoanDetails({ ...initialLoanDetails });
    setCreditScore('');
    setCreditScoreTouched(false);
    setStatus('DRAFT');
    setSubmittedApplication(null);
    setDocuments(createInitialDocuments());
    setSelectedFiles({ BANK_STATEMENT: '', LATEST_SALARY_SLIP: '', PREVIOUS_SALARY_SLIP: '', PAN_DOCUMENT: '' });
    setCurrentStep(1);
    setValidationMessage('');
    setKycStatus('Not Validated');
    setKycMessage('');
    setKycPanTouched(false);
    setVerificationType('PAN_VERIFICATION');
  };

  const filteredRows = applications;

  const loanValidationMessage = useMemo(() => {
    const principal = parseNumericValue(loanDetails.requestedLoanAmount);
    const interestRate = parseNumericValue(loanDetails.interestRate);
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
    return '';
  }, [loanDetails.requestedLoanAmount, loanDetails.interestRate, loanDetails.preferredTenure]);

  const emiSummary = useMemo(() => {
    if (loanValidationMessage) {
      return null;
    }

    const principal = parseNumericValue(loanDetails.requestedLoanAmount);
    const interestRate = parseNumericValue(loanDetails.interestRate);
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
  }, [loanDetails.requestedLoanAmount, loanDetails.interestRate, loanDetails.preferredTenure, loanValidationMessage]);

  const handleSaveDraft = async () => {
    try {
      const mobileError = validateMobileNumber(applicant.mobileNumber);
      if (mobileError) {
        setApplicantMobileError(mobileError);
        setValidationMessage(mobileError);
        return;
      }
      if (loanValidationMessage) {
        setValidationMessage(loanValidationMessage);
        return;
      }
      const id = await ensureApplication();
      const response = await apiFetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant, employment, loanDetails })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || 'Draft could not be saved.');
      }
      setStatus('DRAFT');
      setValidationMessage(`Draft saved${result?.id ? `: ${result.id}` : ''}.`);
      await fetchApplications();
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Draft could not be saved.');
    }
  };

  const handleValidateKyc = () => {
    setKycPanTouched(true);
    if (!applicant.fullName.trim() || applicant.fullName.length > 120) {
      setKycStatus('INVALID');
      setKycMessage(!applicant.fullName.trim() ? 'Customer name is required.' : 'Customer name is too long.');
      document.getElementById('applicant-fullName')?.focus();
      return;
    }
    if (verificationType !== 'PAN_VERIFICATION') {
      setKycStatus('INVALID');
      setKycMessage('This verification type is not currently supported.');
      return;
    }
    const panError = validatePanNumber(applicant.panNumber);
    if (panError) {
      setKycStatus('INVALID');
      setKycMessage(panError);
      return;
    }
    setKycStatus('VALID');
    setKycMessage('PAN format is valid. This is local input validation only; no external KYC provider is connected.');
  };

  const missingDocuments = REQUIRED_DOCUMENTS.filter((doc) => documents[doc.key].status !== 'UPLOADED');
  const creditScoreError = creditScoreTouched || creditScore ? validateCreditScore(creditScore) : '';
  const creditScoreStatus = creditScoreError ? '—' : getCreditScoreStatus(creditScore);
  const kycPanError = kycPanTouched || applicant.panNumber ? validatePanNumber(applicant.panNumber) : '';

  const handleSubmit = async () => {
    try {
      const applicantErrors = validateApplicantFields(applicant);
      setApplicantFieldErrors(applicantErrors);
      const firstApplicantError = (Object.keys(applicantErrors) as Array<keyof Applicant>).find((field) => applicantErrors[field]);
      if (firstApplicantError) {
        setApplicantMobileError(applicantErrors.mobileNumber || '');
        setValidationMessage('Please correct the highlighted applicant details.');
        document.getElementById(`applicant-${firstApplicantError}`)?.focus();
        return;
      }
      if (loanValidationMessage) {
        setValidationMessage(loanValidationMessage);
        return;
      }
      const scoreError = validateCreditScore(creditScore);
      setCreditScoreTouched(true);
      if (scoreError) {
        setValidationMessage(scoreError);
        document.getElementById('credit-score')?.focus();
        return;
      }
      if (!applicant.fullName.trim()) {
        setValidationMessage('Customer name is required.');
        return;
      }
      const panError = validatePanNumber(applicant.panNumber);
      if (panError) {
        setKycPanTouched(true);
        setValidationMessage(panError);
        document.getElementById('kyc-pan-number')?.focus();
        return;
      }
      if (kycStatus !== 'VALID') {
        setValidationMessage('Validate the customer name and PAN format before submitting.');
        document.getElementById('kyc-pan-number')?.focus();
        return;
      }
      if (missingDocuments.length > 0) {
        setStatus('DOCUMENTS_PENDING');
        setValidationMessage('Please upload all required documents before submitting the application.');
        return;
      }
      const id = await ensureApplication();
      const updateResponse = await apiFetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant, employment, loanDetails })
      });
      const updateBody = await updateResponse.json().catch(() => null);
      if (!updateResponse.ok) {
        throw new Error(updateBody?.message || 'Application details could not be saved.');
      }
      const submitResponse = await apiFetch(`/api/applications/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditScore,
          customerName: applicant.fullName,
          verificationType,
          panNumber: applicant.panNumber
        })
      });
      if (!submitResponse.ok) {
        const errorBody = await submitResponse.json().catch(() => ({}));
        const fieldErrors = errorBody?.errors as Record<string, string> | undefined;
        const fieldMessage = fieldErrors?.panNumber || fieldErrors?.customerName || fieldErrors?.verificationType || fieldErrors?.creditScore;
        throw new Error(fieldMessage || errorBody?.message || 'Submission failed');
      }
      const submitted = await submitResponse.json();
      setSubmittedApplication({
        losNumber: submitted.losNumber,
        status: submitted.status,
        createdAt: submitted.createdAt
      });
      setStatus('SUBMITTED');
      setCurrentStep(5);
      setValidationMessage('');
      await fetchApplications();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed';
      setStatus('DOCUMENTS_PENDING');
      setValidationMessage(message);
    }
  };

  const uploadDocument = async (docType: DocumentType, file: File) => {
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
      formData.append('documentName', REQUIRED_DOCUMENTS.find((item) => item.key === docType)?.label || docType);
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
      const message = error instanceof Error ? error.message : 'Upload failed';
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

  const handleChooseFile = (docType: DocumentType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg';
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

  const handleLogout = () => {
    const authSession = readStoredAuth();
    if (authSession) {
      void fetch('/api/auth/logout', {
        method: 'POST',
        headers: buildAuthHeaders(authSession)
      });
    }
    clearAuth();
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
              <a className="active" href="#">Dashboard</a>
              <a href="#" onClick={(event) => { event.preventDefault(); handleNewApplication(); }}>New Application</a>
              <a href="#">Applications</a>
            </>
          ) : (
            <a className="active" href="#">Application</a>
          )}
          <button type="button" className="logout-button" onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      <main className="page">
        <section className="hero">
          <div>
            <h1>New Loan Application</h1>
            <p>Step {currentStep} of 5</p>
          </div>
          <div className="stepper">
            {['Applicant Details', 'Employment & Income', 'Credit Check', 'Documents', 'Review & Submit'].map((label, index) => (
              <div key={label} className={`step ${index + 1 <= currentStep ? 'done' : ''}`}>
                <span>{index + 1}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="card metric"><span>Total Applications</span><strong>{applicationCounts.total}</strong></div>
          <div className="card metric"><span>Draft Applications</span><strong>{applicationCounts.draft}</strong></div>
          <div className="card metric"><span>Under Review</span><strong>{applicationCounts.underReview}</strong></div>
          <div className="card metric"><span>Submitted Applications</span><strong>{applicationCounts.submitted}</strong></div>
        </section>

        <section className="card form-card">
          <h2>Applicant Details</h2>
          <div className="field-grid">
            <label htmlFor="applicant-fullName">Full Name<input id="applicant-fullName" value={applicant.fullName} aria-invalid={Boolean(applicantFieldErrors.fullName)} onChange={(e) => updateApplicantField('fullName', e.target.value)} />{applicantFieldErrors.fullName && <span role="alert" className="field-error">{applicantFieldErrors.fullName}</span>}</label>
            <label htmlFor="applicant-dateOfBirth">Date of Birth<input id="applicant-dateOfBirth" type="date" value={applicant.dateOfBirth} aria-invalid={Boolean(applicantFieldErrors.dateOfBirth)} onChange={(e) => updateApplicantField('dateOfBirth', e.target.value)} />{applicantFieldErrors.dateOfBirth && <span role="alert" className="field-error">{applicantFieldErrors.dateOfBirth}</span>}</label>
            <label htmlFor="applicant-panNumber">PAN Number<input id="applicant-panNumber" value={applicant.panNumber} aria-invalid={Boolean(applicantFieldErrors.panNumber)} onChange={(e) => updateApplicantField('panNumber', e.target.value.toUpperCase())} />{applicantFieldErrors.panNumber && <span role="alert" className="field-error">{applicantFieldErrors.panNumber}</span>}</label>
            <label htmlFor="applicant-mobileNumber">Mobile Number<input
              id="applicant-mobileNumber"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={applicant.mobileNumber}
              aria-invalid={Boolean(applicantMobileError || applicantFieldErrors.mobileNumber)}
              onChange={(event) => {
                const value = event.target.value;
                if (/\D/.test(value)) {
                  setApplicantMobileError('Mobile number must contain digits only.');
                  setApplicantFieldErrors((current) => ({ ...current, mobileNumber: 'Mobile number must contain digits only.' }));
                  return;
                }
                setApplicant({ ...applicant, mobileNumber: value.slice(0, 10) });
                setApplicantMobileError('');
                setApplicantFieldErrors((current) => ({ ...current, mobileNumber: '' }));
              }}
              onPaste={(event) => {
                if (/\D/.test(event.clipboardData.getData('text'))) {
                  event.preventDefault();
                  setApplicantMobileError('Mobile number must contain digits only.');
                }
              }}
            />{(applicantFieldErrors.mobileNumber || applicantMobileError) && <span role="alert" className="field-error">{applicantFieldErrors.mobileNumber || applicantMobileError}</span>}</label>
            <label htmlFor="applicant-email">Email ID<input id="applicant-email" type="email" value={applicant.email} aria-invalid={Boolean(applicantFieldErrors.email)} onChange={(e) => updateApplicantField('email', e.target.value)} />{applicantFieldErrors.email && <span role="alert" className="field-error">{applicantFieldErrors.email}</span>}</label>
            <label htmlFor="applicant-workEmail">Work Email ID<input id="applicant-workEmail" type="email" value={applicant.workEmail} aria-invalid={Boolean(applicantFieldErrors.workEmail)} onChange={(e) => updateApplicantField('workEmail', e.target.value)} />{applicantFieldErrors.workEmail && <span role="alert" className="field-error">{applicantFieldErrors.workEmail}</span>}</label>
            <label className="full-width" htmlFor="applicant-residentialAddress">Residential Address<input id="applicant-residentialAddress" value={applicant.residentialAddress} aria-invalid={Boolean(applicantFieldErrors.residentialAddress)} onChange={(e) => updateApplicantField('residentialAddress', e.target.value)} />{applicantFieldErrors.residentialAddress && <span role="alert" className="field-error">{applicantFieldErrors.residentialAddress}</span>}</label>
            <label htmlFor="applicant-city">City<input id="applicant-city" value={applicant.city} aria-invalid={Boolean(applicantFieldErrors.city)} onChange={(e) => updateApplicantField('city', e.target.value)} />{applicantFieldErrors.city && <span role="alert" className="field-error">{applicantFieldErrors.city}</span>}</label>
            <label htmlFor="applicant-state">State<input id="applicant-state" value={applicant.state} aria-invalid={Boolean(applicantFieldErrors.state)} onChange={(e) => updateApplicantField('state', e.target.value)} />{applicantFieldErrors.state && <span role="alert" className="field-error">{applicantFieldErrors.state}</span>}</label>
            <label htmlFor="applicant-pincode">Pincode<input id="applicant-pincode" value={applicant.pincode} aria-invalid={Boolean(applicantFieldErrors.pincode)} onChange={(e) => updateApplicantField('pincode', e.target.value)} />{applicantFieldErrors.pincode && <span role="alert" className="field-error">{applicantFieldErrors.pincode}</span>}</label>
          </div>
        </section>

        <section className="card form-card">
          <h2>Employment & Income</h2>
          <div className="field-grid">
            <label>Employment Type
              <select value={employment.employmentType} onChange={(e) => setEmployment({ ...employment, employmentType: e.target.value })}>
                <option value="SALARIED">Salaried</option>
                <option value="SELF_EMPLOYED">Self Employed</option>
                <option value="BUSINESS_OWNER">Business Owner</option>
              </select>
            </label>
            <label>Employer Name<input value={employment.employerName} onChange={(e) => setEmployment({ ...employment, employerName: e.target.value })} /></label>
            <label>Designation<input value={employment.designation} onChange={(e) => setEmployment({ ...employment, designation: e.target.value })} /></label>
            <label>Total Work Experience<input type="number" value={employment.totalWorkExperienceYears} onChange={(e) => setEmployment({ ...employment, totalWorkExperienceYears: Number(e.target.value) })} /></label>
            <label>Current Employer Experience<input type="number" value={employment.currentEmployerExperienceYears} onChange={(e) => setEmployment({ ...employment, currentEmployerExperienceYears: Number(e.target.value) })} /></label>
            <label>Monthly In-Hand Salary<input type="number" value={employment.monthlyInHandSalary} onChange={(e) => setEmployment({ ...employment, monthlyInHandSalary: Number(e.target.value) })} /></label>
            <label>Monthly Gross Salary<input type="number" value={employment.monthlyGrossSalary} onChange={(e) => setEmployment({ ...employment, monthlyGrossSalary: Number(e.target.value) })} /></label>
          </div>
        </section>

        <section className="card form-card">
          <h2>Credit Score</h2>
          <div className="field-grid">
            <label htmlFor="credit-score">Credit Score
              <input
                id="credit-score"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={creditScore}
                aria-invalid={Boolean(creditScoreError)}
                onChange={(event) => {
                  setCreditScore(event.target.value);
                  setCreditScoreTouched(true);
                }}
              />
              {creditScoreError && <span role="alert" className="field-error">{creditScoreError}</span>}
            </label>
          </div>
          <div className="score-box" style={{ marginTop: 18 }}>
            <span>Status: <strong className="score-status">{creditScoreStatus}</strong></span>
          </div>
        </section>

        <section className="card form-card">
          <h2>KYC Verification</h2>
          <div className="field-grid">
            <label>Customer Name
              <input value={applicant.fullName} readOnly />
            </label>
            <label>Verification Type
              <select value={verificationType} onChange={(event) => {
                setVerificationType(event.target.value);
                setKycStatus('Not Validated');
              }}>
                <option value="PAN_VERIFICATION">PAN Verification</option>
              </select>
            </label>
            <label htmlFor="kyc-pan-number">PAN Number
              <input
                id="kyc-pan-number"
                value={applicant.panNumber}
                autoCapitalize="characters"
                maxLength={10}
                aria-invalid={Boolean(kycPanError)}
                onChange={(event) => {
                  setApplicant({ ...applicant, panNumber: event.target.value.toUpperCase() });
                  setKycPanTouched(true);
                  setKycStatus('Not Validated');
                  setKycMessage('');
                }}
              />
              {kycPanError && <span role="alert" className="field-error">{kycPanError}</span>}
            </label>
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button className="primary" onClick={handleValidateKyc}>Validate KYC</button>
          </div>
          <div className="score-box" style={{ marginTop: 18 }}>
            <div>
              <span className="label">KYC Details</span>
              <strong>{kycStatus === 'VALID' ? 'PAN Format Valid' : kycStatus === 'INVALID' ? 'Invalid PAN Format' : 'Not Validated'}</strong>
            </div>
            <div className={`badge ${kycStatus === 'VALID' ? 'success' : kycStatus === 'INVALID' ? 'warning' : 'info'}`}>
              Status: {kycStatus}
            </div>
          </div>
          {kycMessage && <p style={{ margin: '12px 0 0', color: '#324a6e' }}>{kycMessage}</p>}
        </section>

        <section className="card form-card">
          <h2>Loan Details</h2>
          <div className="field-grid">
            <label>Loan Type
              <select value={loanDetails.loanType} onChange={(e) => setLoanDetails({ ...loanDetails, loanType: e.target.value })}>
                <option value="PERSONAL_LOAN">Personal Loan</option>
                <option value="HOME_LOAN">Home Loan</option>
                <option value="CAR_LOAN">Car Loan</option>
                <option value="EDUCATION_LOAN">Education Loan</option>
              </select>
            </label>
            <label>Requested Loan Amount<input type="number" min="1" step="1000" value={loanDetails.requestedLoanAmount} onChange={(e) => setLoanDetails({ ...loanDetails, requestedLoanAmount: e.target.value })} /></label>
            <label>Preferred Tenure<input type="number" min="1" step="1" value={loanDetails.preferredTenure} onChange={(e) => setLoanDetails({ ...loanDetails, preferredTenure: e.target.value })} /></label>
            <label>Interest Rate (%)<input type="number" min="0" max={MAX_INTEREST_RATE} step="0.01" value={loanDetails.interestRate} onChange={(e) => setLoanDetails({ ...loanDetails, interestRate: e.target.value })} /></label>
            <label className="full-width">Purpose of Loan<input value={loanDetails.purposeOfLoan} onChange={(e) => setLoanDetails({ ...loanDetails, purposeOfLoan: e.target.value })} /></label>
          </div>

          {loanValidationMessage && (
            <div className="validation-box" style={{ marginTop: 16 }}>{loanValidationMessage}</div>
          )}

          {emiSummary && (
            <div className="emi-box" style={{ marginTop: 18 }}>
              <h3>EMI Calculation</h3>
              <div className="emi-grid">
                <div><span>Principal Amount</span><strong>{formatCurrency(emiSummary.principal)}</strong></div>
                <div><span>Interest Rate</span><strong>{formatInterestRate(emiSummary.interestRate)}</strong></div>
                <div><span>Tenure</span><strong>{emiSummary.tenure} months</strong></div>
                <div><span>Monthly EMI</span><strong>{formatCurrency(Math.round(emiSummary.monthlyEmi))}</strong></div>
                <div><span>Total Interest</span><strong>{formatCurrency(Math.round(emiSummary.totalInterest))}</strong></div>
                <div><span>Total Amount Payable</span><strong>{formatCurrency(Math.round(emiSummary.totalPayable))}</strong></div>
              </div>
            </div>
          )}

          <div className="eligibility-box">
            <h3>Demo Eligibility Calculation</h3>
            <ul>
              <li>Requested Amount: {formatCurrency(loanDetails.requestedLoanAmount)}</li>
              <li>Tenure: {loanDetails.preferredTenure || 0} months</li>
              <li>Monthly Income: {formatCurrency(employment.monthlyInHandSalary)}</li>
              <li>Credit Score: {creditScore ?? 0}</li>
              <li>Eligibility Index: {eligibility}%</li>
            </ul>
          </div>
        </section>

        <section className="card form-card">
          <h2>Document Upload</h2>

          {applicationId && <p>Application ID: <strong>{applicationId}</strong></p>}
          {isCreatingApplication && <p role="status">Creating application...</p>}

          {validationMessage && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: '#fff1f0', color: '#a61d1d', border: '1px solid #f5b7b1', fontWeight: 600 }}>
              {validationMessage}
            </div>
          )}

          <div className="doc-list">
            {REQUIRED_DOCUMENTS.map((doc) => {
              const item = documents[doc.key];
              const missing = item.status !== 'UPLOADED';
              const statusText = item.status === 'UPLOADING'
                ? 'Uploading...'
                : item.status === 'UPLOAD_FAILED'
                  ? 'Upload Failed'
                  : item.status === 'UPLOADED'
                    ? 'Uploaded'
                    : 'Not Uploaded';

              return (
                <div className={`doc-item ${missing ? 'missing' : ''}`} key={doc.key} style={{
                  border: missing ? '1px solid #f0b7b7' : '1px solid #dfe6f1',
                  background: missing ? '#fff9f9' : '#ffffff',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.label}</div>
                    <div style={{ color: missing ? '#b42318' : '#1f5b49', fontWeight: 500 }}>
                      Status: {statusText}
                    </div>
                    {item.fileName && (
                      <div style={{ marginTop: 4, fontSize: 13, color: '#44607d' }}>
                        File: {item.fileName}
                      </div>
                    )}
                    {item.error && (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#a61d1d' }}>{item.error}</div>
                    )}
                    {selectedFiles[doc.key] && item.status === 'UPLOADED' && (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#44607d' }}>
                        Selected: {selectedFiles[doc.key]}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.status === 'UPLOADED' ? (
                      <>
                        <button className="secondary" onClick={() => handleChooseFile(doc.key)}>Replace</button>
                        {item.id && (
                          <a href={`/api/applications/${applicationId}/documents/${item.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#1c5d9a' }}>
                            View
                          </a>
                        )}
                      </>
                    ) : (
                      <button className="primary" onClick={() => handleChooseFile(doc.key)} disabled={item.status === 'UPLOADING' || isCreatingApplication}>
                        {item.status === 'UPLOADING' ? 'Uploading...' : 'Choose File'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="inline-actions">
            <button className="secondary" onClick={handleSaveDraft} disabled={isCreatingApplication}>Save Draft</button>
            <button className="primary" onClick={handleSubmit}>Submit Application</button>
          </div>
        </section>

        {submittedApplication && (
          <section className="card success-card">
            <h2>Application Submitted Successfully</h2>
            <div className="meta-row"><span>LOS Number</span><strong>{submittedApplication.losNumber}</strong></div>
            <div className="meta-row"><span>Application Status</span><strong>{submittedApplication.status}</strong></div>
            <div className="meta-row"><span>Created On</span><strong>{new Date(submittedApplication.createdAt ?? Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
            <button className="primary">Download Application Summary</button>
          </section>
        )}

        {session.role === 'ADMIN' && (
          <section className="card table-card">
            <h2>Recent Applications</h2>
            <div className="toolbar">
              <input placeholder="Search name, LOS, or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
              </select>
            </div>
            <table>
              <thead>
                <tr>
                  <th>LOS Number</th>
                  <th>Applicant Name</th>
                  <th>Loan Type</th>
                  <th>Requested Amount</th>
                  <th>Credit Score</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.losNumber ?? '—'}</td>
                    <td>{row.applicantName}</td>
                    <td>{row.loanType}</td>
                    <td>₹{row.requestedAmount ? row.requestedAmount.toLocaleString('en-IN') : '0'}</td>
                    <td>{row.creditScore ?? '—'}</td>
                    <td><span className={`badge ${statusColors[row.status] ?? 'neutral'}`}>{row.status}</span></td>
                    <td>{new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><button className="secondary" onClick={() => handleOpenApplication(row.id)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
