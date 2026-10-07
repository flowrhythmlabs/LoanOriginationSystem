// In-memory fake backend for static hosting; enabled by VITE_MOCK_API=true.
type Json = Record<string, any>;

const apps: Json[] = [];
const docs: Record<number, Json[]> = {};
let nextAppId = 1;
let nextDocId = 1;
let nextLos = 1;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const toApplication = (app: Json) => ({
  id: app.id,
  status: app.status,
  losNumber: app.losNumber,
  createdAt: app.createdAt,
  applicant: app.applicant,
  employmentDetails: app.employment,
  loanDetails: app.loanDetails,
  creditCheck: app.creditScore !== null && app.creditScore !== undefined
    ? { creditScore: app.creditScore, status: app.creditScoreStatus }
    : null
});

const toRow = (app: Json) => ({
  id: app.id,
  losNumber: app.losNumber,
  applicantName: app.applicant?.fullName ?? '',
  applicantMobile: app.applicant?.mobileNumber,
  loanType: app.loanDetails?.loanType ?? '',
  requestedAmount: Number(app.loanDetails?.requestedLoanAmount ?? 0),
  creditScore: app.creditScore ?? null,
  status: app.status,
  createdAt: app.createdAt
});

const seed = () => {
  const samples = [
    ['Priya Nair', 'BNQPN4521K', '9811122233', 'HOME_LOAN', 2500000, 742, 'SUBMITTED'],
    ['Rahul Verma', 'CKLPV7788M', '9822233344', 'PERSONAL_LOAN', 300000, 698, 'SUBMITTED'],
    ['Sneha Iyer', 'DPQRS1234T', '9833344455', 'CAR_LOAN', 800000, 720, 'DRAFT']
  ] as const;
  samples.forEach(([name, pan, mobile, loanType, amount, score, status]) => {
    const id = nextAppId++;
    apps.push({
      id,
      status,
      losNumber: status === 'SUBMITTED' ? `LOS-2026-${String(nextLos++).padStart(8, '0')}` : null,
      createdAt: new Date(Date.now() - id * 86400000).toISOString(),
      creditScore: score,
      applicant: {
        fullName: name, dateOfBirth: '1992-03-10', panNumber: pan, mobileNumber: mobile,
        email: `${name.split(' ')[0].toLowerCase()}@example.com`, workEmail: `${name.split(' ')[0].toLowerCase()}@company.com`,
        residentialAddress: '21 Residency Road', city: 'Pune', state: 'Maharashtra', pincode: '411001'
      },
      employment: {
        employmentType: 'SALARIED', employerName: 'Acme Corp', designation: 'Manager',
        totalWorkExperienceYears: 8, currentEmployerExperienceYears: 3, monthlyInHandSalary: 110000, monthlyGrossSalary: 145000
      },
      loanDetails: { loanType, requestedLoanAmount: amount, interestRate: 10.5, preferredTenure: 48, purposeOfLoan: 'Demo application' }
    });
    docs[id] = [];
  });
};

const handle = async (url: URL, method: string, init?: RequestInit): Promise<Response | null> => {
  const path = url.pathname;
  const body = async (): Promise<Json> => {
    try {
      return JSON.parse(String(init?.body ?? '{}'));
    } catch {
      return {};
    }
  };

  if (path === '/api/auth/login/user' && method === 'POST') {
    const data = await body();
    return json({ role: 'USER', mobileNumber: data.mobileNumber, token: 'mock-user-token', message: 'Login successful' });
  }
  if (path === '/api/auth/login/admin' && method === 'POST') {
    const data = await body();
    return json({ role: 'ADMIN', username: data.username, token: 'mock-admin-token', message: 'Login successful' });
  }
  if (path === '/api/auth/logout') {
    return json({});
  }
  if (path === '/api/applications/counts') {
    return json({
      total: apps.length,
      draft: apps.filter((a) => a.status === 'DRAFT').length,
      underReview: apps.filter((a) => a.status === 'UNDER_REVIEW').length,
      submitted: apps.filter((a) => a.status === 'SUBMITTED').length
    });
  }
  if (path === '/api/applications' && method === 'GET') {
    const term = (url.searchParams.get('search') ?? '').toLowerCase();
    const status = url.searchParams.get('status') ?? 'ALL';
    const rows = apps
      .filter((a) => status === 'ALL' || a.status === status)
      .filter((a) => !term || [a.applicant?.fullName, a.losNumber, a.applicant?.mobileNumber].some((v) => String(v ?? '').toLowerCase().includes(term)))
      .map(toRow)
      .reverse();
    return json(rows);
  }
  if (path === '/api/applications' && method === 'POST') {
    const data = await body();
    const app = {
      id: nextAppId++, status: 'DRAFT', losNumber: null, createdAt: new Date().toISOString(), creditScore: null,
      applicant: data.applicant, employment: data.employment, loanDetails: data.loanDetails
    };
    apps.push(app);
    docs[app.id] = [];
    return json(toApplication(app), 201);
  }
  const match = path.match(/^\/api\/applications\/(\d+)(?:\/(\w+))?(?:\/(\d+))?$/);
  if (!match) {
    return null;
  }
  const app = apps.find((a) => a.id === Number(match[1]));
  if (!app) {
    return json({ message: 'Application not found' }, 404);
  }
  const sub = match[2];

  if (!sub && method === 'GET') {
    return json(toApplication(app));
  }
  if (!sub && method === 'PUT') {
    const data = await body();
    if (String(data.applicant?.panNumber ?? '').toUpperCase() !== String(app.applicant?.panNumber ?? '').toUpperCase()) {
      app.kyc = null;
    }
    Object.assign(app, { applicant: data.applicant, employment: data.employment, loanDetails: data.loanDetails });
    return json(toApplication(app));
  }
  if (sub === 'credit-check') {
    const data = await body();
    const scoreText = String(data.creditScore ?? '');
    const score = Number(scoreText);
    if (!/^\d+$/.test(scoreText) || score < 300 || score > 900) {
      return json({ message: 'Credit score must be a whole number between 300 and 900.' }, 400);
    }
    app.creditScore = score;
    app.creditScoreStatus = score <= 649 ? 'POOR' : score <= 749 ? 'FAIR' : 'GOOD';
    return json(toApplication(app));
  }
  if (sub === 'submit') {
    const data = await body();
    const scoreText = String(data.creditScore ?? '');
    const score = Number(scoreText);
    if (!/^\d+$/.test(scoreText) || score < 300 || score > 900) {
      return json({ message: 'Credit score must be a whole number between 300 and 900.' }, 400);
    }
    if ((docs[app.id] ?? []).length < 4) {
      return json({ message: 'Please upload all required documents before submitting the application.' }, 400);
    }
    const pan = String(data.panNumber ?? '');
    if (!String(data.customerName ?? '').trim()) {
      return json({ message: 'Customer name is required.' }, 400);
    }
    if (String(data.customerName).trim() !== String(app.applicant?.fullName ?? '').trim()) {
      return json({ message: 'Customer name must match the application details.' }, 400);
    }
    if (data.verificationType !== 'PAN_VERIFICATION') {
      return json({ message: 'Only PAN Verification is currently supported.' }, 400);
    }
    if (!pan) {
      return json({ message: 'PAN number is required.' }, 400);
    }
    if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(pan)
        || pan.toUpperCase() !== String(app.applicant?.panNumber ?? '').toUpperCase()) {
      return json({ message: 'Enter a valid PAN in the format ABCDE1234F.' }, 400);
    }
    app.creditScore = score;
    app.creditScoreStatus = score <= 649 ? 'POOR' : score <= 749 ? 'FAIR' : 'GOOD';
    app.kyc = { status: 'VALIDATION_PASSED', verificationType: 'PAN_VERIFICATION' };
    app.status = 'SUBMITTED';
    app.losNumber ??= `LOS-2026-${String(nextLos++).padStart(8, '0')}`;
    return json(toApplication(app));
  }
  if (sub === 'documents' && method === 'GET') {
    if (match[3]) {
      return new Response('Mock document preview', { headers: { 'Content-Type': 'text/plain' } });
    }
    return json(docs[app.id] ?? []);
  }
  if (sub === 'documents' && method === 'POST') {
    const form = init?.body as FormData;
    const file = form.get('file') as File | null;
    const type = String(form.get('documentType'));
    const doc = {
      id: nextDocId++, documentType: type, documentName: String(form.get('documentName') ?? type), status: 'UPLOADED',
      fileName: file?.name ?? 'document.pdf', fileSize: file?.size ?? 0, uploadedAt: new Date().toISOString()
    };
    docs[app.id] = [...(docs[app.id] ?? []).filter((d) => d.documentType !== type), doc];
    return json(doc, 201);
  }
  return null;
};

export const installMockApi = () => {
  seed();
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.startsWith('/api/')) {
      return realFetch(input, init);
    }
    const method = (init?.method ?? 'GET').toUpperCase();
    return (await handle(url, method, init)) ?? json({ message: 'Not found' }, 404);
  };
};
