/** Local-only demonstration API. Never use for real customer data or production auth. */
const STORE = 'finedge-netlify-demo-v1';
type Obj = Record<string, any>;
type Database = { nextId: number; nextDocumentId: number; applications: Obj[]; documents: Obj[] };
const read = (): Database => { try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v?.applications && v?.documents) return v; } catch {} return {nextId:1,nextDocumentId:1,applications:[],documents:[]}; };
const save = (db: Database) => localStorage.setItem(STORE, JSON.stringify(db));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json'}});
const error = (message:string, status=400) => json({message},status);
const getUser = (headers?: HeadersInit) => {
  const auth = new Headers(headers).get('Authorization') || '';
  const token = auth.replace(/^Bearer /,'');
  if (!token.startsWith('demo-')) return null;
  const stored = sessionStorage.getItem('finedge-auth-session');
  try { const session = JSON.parse(stored || 'null'); return session?.accessToken === token ? session : null; } catch { return null; }
};
const toRow = (a:Obj) => ({id:a.id,losNumber:a.losNumber || null,applicantName:a.applicant?.fullName || null,applicantMobile:a.applicant?.mobileNumber || '',loanType:a.loanDetails?.loanType || null,requestedAmount:Number(a.loanDetails?.requestedLoanAmount || 0),creditScore:a.creditCheck?.creditScore ?? null,status:a.status,createdAt:a.createdAt});
const clone = <T>(v:T):T => JSON.parse(JSON.stringify(v));
const delay = (ms=140) => new Promise(resolve=>setTimeout(resolve,ms));
const defaultApp = (payload:Obj, id:number):Obj => ({id,losNumber:null,status:'DRAFT',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),applicant:payload.applicant || {},employmentDetails:payload.employmentDetails || {},loanDetails:payload.loanDetails || {},creditCheck:null});
const pricing:Record<string,number> = {PERSONAL_LOAN:10.5,HOME_LOAN:9.0,CAR_LOAN:10.0,VEHICLE_LOAN:10.0,EDUCATION_LOAN:9.5,BUSINESS_LOAN:13.5,LOAN_AGAINST_PROPERTY:11.0};
export async function demoFetch(input:RequestInfo|URL, init:RequestInit = {}):Promise<Response> {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return fetch(input,init);
  const path = new URL(String(input),window.location.origin).pathname;
  if (!path.startsWith('/api/')) return fetch(input,init);
  await delay();
  const method = (init.method || 'GET').toUpperCase();
  const body = ():Obj => { try { return JSON.parse(String(init.body || '{}')); } catch { return {}; } };
  if (path === '/api/auth/otp/request' || (path === '/api/auth/login/user' && method === 'POST')) return fetch(input,init);
  if (path === '/api/auth/login/admin' && method === 'POST') {
    const {username,password} = body();
    if (username !== 'demo.admin' || password !== 'Demo@123') return error('Invalid demo admin credentials.',401);
    return json({accessToken:'demo-admin-demo.admin'});
  }
  if (path === '/api/auth/logout') return json({message:'Signed out'});
  const user = getUser(init.headers);
  if (!user) return error('Please sign in to the demo again.',401);
  if (path.startsWith('/api/pricing/')) return json({interestRate:pricing[decodeURIComponent(path.split('/').pop() || '')] || 10.5});
  const db = read();
  if (path === '/api/applications' && method === 'GET') return json(db.applications.filter(a=>user.role==='ADMIN' || a.applicant?.mobileNumber===user.mobile).map(toRow));
  if (path === '/api/applications' && method === 'POST') {
    const payload=body(); const id=db.nextId++;
    const app=defaultApp(payload,id);
    if (user.role==='USER') app.applicant.mobileNumber=user.mobile;
    db.applications.push(app);save(db);return json(clone(app),201);
  }
  const m=path.match(/^\/api\/applications\/(\d+)(?:\/(.*))?$/);
  const adminReview=path.match(/^\/api\/admin\/applications\/(\d+)\/documents\/(\d+)\/review$/);
  if (adminReview && method==='PUT') {
    if (user.role!=='ADMIN') return error('Staff login required.',403);
    const d=db.documents.find(x=>x.applicationId===Number(adminReview[1]) && x.id===Number(adminReview[2]));
    if (!d) return error('Document not found.',404);
    const changes=body(); if (!['VERIFIED','REJECTED','DEFICIENCY_RAISED'].includes(changes.status)) return error('Invalid document status.');
    d.status=changes.status;d.verificationRemarks=changes.remarks || null;save(db);return json(clone(d));
  }
  const decision=path.match(/^\/api\/admin\/applications\/(\d+)\/decision$/);
  if (decision && method==='PUT') {
    if (user.role!=='ADMIN') return error('Staff login required.',403);
    const target=db.applications.find(a=>a.id===Number(decision[1]));
    if (!target) return error('Application not found.',404);
    if (!['SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED'].includes(target.status)) return error('Submit the application before an admin decision.');
    const {status,reason}=body();
    if (!['APPROVED','REJECTED','UNDER_REVIEW'].includes(status)) return error('Invalid decision status.');
    target.status=status;target.decisionReason=String(reason || 'Demo decision');target.updatedAt=new Date().toISOString();save(db);return json(clone(target));
  }
  if (!m) return error('Demo endpoint not found: '+path,404);
  const id=Number(m[1]);const sub=m[2] || '';
  const app=db.applications.find(x=>x.id===id);
  if (!app) return error('Application not found.',404);
  if (user.role!=='ADMIN' && app.applicant?.mobileNumber!==user.mobile) return error('This application belongs to another demo user.',403);
  if (!sub && method==='GET') return json(clone(app));
  if (!sub && method==='PUT') {
    if (['SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED'].includes(app.status)) return error('Submitted applications cannot be edited.');
    const payload=body();
    app.applicant={...app.applicant,...(payload.applicant || {}),mobileNumber:app.applicant.mobileNumber};
    app.employmentDetails={...app.employmentDetails,...(payload.employmentDetails || {})};
    app.loanDetails={...app.loanDetails,...(payload.loanDetails || {})};
    app.updatedAt=new Date().toISOString();save(db);return json(clone(app));
  }
  if (sub==='kyc' && method==='POST') {
    const payload=body();
    const status=payload.mockMode==='FAILED'?'FAILED':['MANUAL','MANUAL_REVIEW'].includes(payload.mockMode)?'MANUAL_REVIEW':'VERIFIED';
    app.kycStatus=status;save(db);await delay(650);return json({status,provider:'DEMO',message:'Simulated KYC result'});
  }
  if (sub==='credit-check' && method==='POST') {
    if (app.kycStatus!=='VERIFIED') return error('KYC must be verified before the simulated bureau check.');
    app.creditCheck={creditScore:765,provider:'DEMO',status:'COMPLETED'};app.status='CREDIT_CHECK_COMPLETED';save(db);await delay(650);return json(clone(app));
  }
  if (sub==='submit' && method==='POST') {
    if (!app.creditCheck) return error('Complete the simulated KYC and bureau check before submission.');
    app.status='SUBMITTED';app.losNumber=app.losNumber || `FE-${new Date().getFullYear()}-${String(id).padStart(6,'0')}`;
    app.updatedAt=new Date().toISOString();save(db);return json(clone(app));
  }
  if (sub==='documents' && method==='GET') return json(db.documents.filter(x=>x.applicationId===id).map(({fileData,...rest})=>rest));
  if (sub==='documents' && method==='POST') {
    const form=init.body;
    if (!(form instanceof FormData)) return error('Document upload must be multipart form data.');
    const file=form.get('file');
    if (!(file instanceof File)) return error('Choose a file to upload.');
    if (!['application/pdf','image/png','image/jpeg'].includes(file.type)) return error('Only PDF, JPG and PNG files are allowed.');
    if (file.size>5*1024*1024) return error('Document must be smaller than 5 MB.');
    const type=String(form.get('documentType') || '');
    const existing=db.documents.find(d=>d.applicationId===id && d.documentType===type);
    const entry:Obj={id:existing?.id || db.nextDocumentId++,applicationId:id,documentType:type,documentName:String(form.get('documentName')||type),status:'UPLOADED',fileName:file.name,fileSize:file.size,uploadedAt:new Date().toISOString(),error:null,verificationRemarks:null};
    // Only file metadata is retained; browser-local storage is not a secure document repository.
    if (existing) Object.assign(existing,entry);else db.documents.push(entry);
    save(db);return json(entry,201);
  }
  const docPath=sub.match(/^documents\/(\d+)$/);
  if (docPath) {
    const doc=db.documents.find(x=>x.applicationId===id && x.id===Number(docPath[1]));
    if (!doc) return error('Document not found.',404);
    if (method==='DELETE') {db.documents=db.documents.filter(x=>x!==doc);save(db);return json({message:'Removed'});}
    if (method==='GET') return error('This browser-only demo retains document metadata, not the original file. Please re-upload to preview.',404);
  }
  return error('Unsupported demo action: '+method+' '+path,404);
}
