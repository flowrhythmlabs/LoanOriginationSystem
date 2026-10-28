import { useEffect, useState } from 'react';
import { buildAuthHeaders, type AuthSession } from './auth';

type Row = { id:number; application_number:string|null; applicant_name:string|null; loan_type:string|null; requested_loan_amount:number|null; status:string; updated_at:string; last_action:string|null };
type RecordMap = Record<string,unknown>;
const actionsByStage:Record<string,string[]> = {
  APPLICATION_PROCESSOR:['PROCESS_FORWARD'],
  CREDIT_UNDERWRITER:['RECOMMEND_APPROVE','RECOMMEND_DECLINE'],
  CREDIT_MANAGER:['APPROVE','DECLINE','HOLD','SEND_BACK'],
  SUPER_ADMIN:[], OPERATIONS:[], AUDIT:[]
};
const documentTypes: [string,string][] = [
  ['PAN_DOCUMENT','PAN'],['AADHAAR_DOCUMENT','Aadhaar'],['BANK_STATEMENT','Bank statements (3 months)'],
  ['BUSINESS_PROOF','Business / professional proof'],['QUALIFICATION_PROOF','Professional qualification proof'],
  ['PHOTOGRAPH','Passport-size photograph'],['SIGNATURE','Signature / e-sign'],
  ['CANCELLED_CHEQUE','Cancelled cheque / bank proof'],['ADDRESS_PROOF','Address proof'],
  ['EDUCATION_DOCUMENTS','Education documents'],['ITR','ITR (last 2 years with computation)']
];
const reasonsByStage:Record<string,string[]> = {
  APPLICATION_PROCESSOR:['DOCUMENTS_VERIFIED','KYC_VERIFIED','PROCESSING_COMPLETE','DEFICIENCY_RESOLVED'],
  CREDIT_UNDERWRITER:['CREDIT_POLICY_MET','AFFORDABILITY_VERIFIED','INSUFFICIENT_INCOME','HIGH_CREDIT_RISK','BUREAU_ADVERSE'],
  CREDIT_MANAGER:['APPROVED_WITHIN_AUTHORITY','POLICY_EXCEPTION','INSUFFICIENT_EVIDENCE','CREDIT_RISK','ADDITIONAL_REVIEW_REQUIRED']
};
const human = (s:string) => s.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
function Details({label,value}:{label:string;value:unknown}) { return <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}><tbody><tr><th scope='row' style={{width:'35%',padding:8,textAlign:'left',border:'1px solid #e5e7eb'}}>{label}</th><td style={{padding:8,border:'1px solid #e5e7eb',overflowWrap:'anywhere'}}>{value==null || value===''?'—':String(value)}</td></tr></tbody></table>; }
function Section({title,data}:{title:string;data:RecordMap|undefined}) {
  return <section style={{marginTop:18}}><h4>{title}</h4>{data ? Object.entries(data).filter(([key])=>!['additionalDetails'].includes(key)).map(([key,value])=><Details key={key} label={human(key)} value={typeof value==='object' ? JSON.stringify(value) : value}/>) : <p>Not provided</p>}{data?.additionalDetails && <details><summary>Additional details</summary>{Object.entries(data.additionalDetails as RecordMap).map(([k,v])=><Details key={k} label={human(k)} value={v}/>)}</details>}</section>;
}
export function UnderwritingWorkspace({session}:{session:AuthSession}) {
  const [stage,setStage]=useState(''); const [queue,setQueue]=useState<Row[]>([]); const [selected,setSelected]=useState<Row|null>(null);
  const [detail,setDetail]=useState<RecordMap|null>(null); const [timeline,setTimeline]=useState<RecordMap[]>([]);
  const [action,setAction]=useState(''); const [reasonCode,setReasonCode]=useState(''); const [notes,setNotes]=useState('');
  const [reviews,setReviews]=useState<RecordMap[]>([]);
  const [checkType,setCheckType]=useState('DOCUMENTS');
  const [outcome,setOutcome]=useState('PENDING');
  const [evidenceReference,setEvidenceReference]=useState('');
  const [reviewNotes,setReviewNotes]=useState('');
  const [reviewLoading,setReviewLoading]=useState(false);
  const [offer,setOffer]=useState<RecordMap|null>(null);
  const [operationRef,setOperationRef]=useState('');
  const [beneficiaryAccount,setBeneficiaryAccount]=useState('');
  const [beneficiaryIfsc,setBeneficiaryIfsc]=useState('');
  const [disbursal,setDisbursal]=useState<RecordMap|null>(null);
  const canRecordReview=['APPLICATION_PROCESSOR','CREDIT_UNDERWRITER','CREDIT_MANAGER'].includes(stage);
  const checks=['KYC','BUREAU','INCOME','BANK_ACCOUNT','FRAUD','POLICY','DOCUMENTS'];
  const [previewUrl,setPreviewUrl]=useState<string|null>(null); const [previewType,setPreviewType]=useState(''); const [previewName,setPreviewName]=useState(''); const [previewBusy,setPreviewBusy]=useState(false);
  const [message,setMessage]=useState(''); const [messageType,setMessageType]=useState<'error'|'success'>('error'); const [busy,setBusy]=useState(false);
  const showError=(value:string)=>{setMessageType('error');setMessage(value);};
  const showSuccess=(value:string)=>{setMessageType('success');setMessage(value);};
  const request=async(path:string,init:RequestInit={})=>{
    const headers=buildAuthHeaders(session); if(init.body)headers.set('Content-Type','application/json');
    const response=await fetch(path,{...init,headers}); const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.message||`Request failed (${response.status})`); return body;
  };
  const closePreview=()=>{setPreviewUrl(old=>{if(old)URL.revokeObjectURL(old);return null;});setPreviewName('');};
  const previewDocument=async(document:RecordMap)=>{
    if(!selected||!document.id)return;
    setPreviewBusy(true);closePreview();
    try{
      const response=await fetch(`/api/staff/underwriting/${selected.id}/documents/${document.id}/preview`,{headers:buildAuthHeaders(session)});
      if(!response.ok)throw new Error(`Unable to preview document (${response.status})`);
      const type=(response.headers.get('Content-Type')||'').split(';')[0];
      if(!['application/pdf','image/jpeg','image/png'].includes(type))throw new Error('Unsupported preview format');
      const blob=await response.blob();
      setPreviewType(type);setPreviewName(String(document.document_name||document.document_type));setPreviewUrl(URL.createObjectURL(blob));
    }catch(e){showError(e instanceof Error?e.message:'Unable to preview document');}
    finally{setPreviewBusy(false);}
  };
  const refresh=async()=>{const rows=await request('/api/staff/underwriting/queue?page=0&size=100');setQueue(rows);};
  const loadReviews=async(applicationId:number)=>{
    const data=await request(`/api/staff/verification/${applicationId}`);
    setReviews(Array.isArray(data)?data:[]);
  };
  const recordReview=async()=>{
    if(!selected||!canRecordReview)return;
    if(!evidenceReference.trim()){showError('Evidence reference is required.');return;}
    setReviewLoading(true);
    try{
      await request(`/api/staff/verification/${selected.id}`,{
        method:'POST',body:JSON.stringify({checkType,outcome,evidenceReference:evidenceReference.trim(),notes:reviewNotes})
      });
      await loadReviews(selected.id);
      setEvidenceReference('');setReviewNotes('');
      showSuccess('Manual review recorded. Evidence history refreshed.');
    }catch(e){showError(e instanceof Error?e.message:'Unable to record manual review');}
    finally{setReviewLoading(false);}
  };
  const loadOffer=async(applicationId:number)=>{
    try {setOffer(await request(`/api/fulfilment/${applicationId}/offer`));}
    catch {setOffer(null);}
  };
  const loadDisbursal=async(applicationId:number)=>{try{setDisbursal(await request(`/api/staff/disbursal/${applicationId}`));}catch{setDisbursal(null);}};
  const processDisbursal=async()=>{
    if(!selected)return;
    if(!window.confirm('Submit this approved application to the configured external disbursal provider? This may initiate a real transfer.'))return;
    setBusy(true);
    try{
      const result=await request(`/api/staff/disbursal/${selected.id}/process`,{method:'POST',body:JSON.stringify({beneficiaryAccount,beneficiaryIfsc:beneficiaryIfsc.toUpperCase(),reference:operationRef})});
      setDisbursal(result);
      if(result.status==='SUCCESS')showSuccess(`Disbursal acknowledged; loan number: ${result.loan_number}`);
      else showError(`Provider result: ${result.status}. Do not retry until reconciled.`);
    }catch(e){showError(e instanceof Error?e.message:'Disbursal failed');await loadDisbursal(selected.id);}
    finally{setBusy(false);}
  };
  const open=async(row:Row)=>{
    closePreview();setSelected(row);setOffer(null);if(stage==='OPERATIONS'){void loadOffer(row.id);void loadDisbursal(row.id);}setReviews([]);setMessage('');setMessageType('error');setBusy(true);
    try {const [d,t,v]=await Promise.all([request(`/api/staff/underwriting/${row.id}/review`),request(`/api/staff/underwriting/${row.id}/timeline`),request(`/api/staff/verification/${row.id}`).catch(()=>[])]);setDetail(d);setTimeline(t);setReviews(Array.isArray(v)?v:[]);}
    catch(e){showError(e instanceof Error?e.message:'Unable to open application');setDetail(null);}finally{setBusy(false);}
  };
  useEffect(()=>{(async()=>{try{const ctx=await request('/api/staff/underwriting/context');setStage(ctx.stage);setAction((actionsByStage[ctx.stage]||[])[0]||'');await refresh();}catch(e){showError(e instanceof Error?e.message:'Unable to load applications');}})();},[]);
  const submit=async()=>{
    if(!selected || !action)return;
    if(!/^[A-Z0-9_]{3,80}$/.test(reasonCode)){showError('Enter a reason code (3–80 uppercase letters, numbers or underscores).');return;}
    setBusy(true);
    try {const result=await request(`/api/staff/underwriting/${selected.id}/decision`,{method:'POST',body:JSON.stringify({action,reasonCode,notes})});
      showSuccess(`${human(result.action)} saved. Application moved to its next workflow stage.`);setReasonCode('');setNotes('');await refresh();setSelected(null);setDetail(null);
    }catch(e){showError(e instanceof Error?e.message:'Unable to save action');}finally{setBusy(false);}
  };
  const app=detail?.application as RecordMap|undefined;
  return <section className="card form-card">
    <h2>{stage==='APPLICATION_PROCESSOR'?'Pending Applications':stage==='OPERATIONS'?'Operations – Approved Applications':'Recent Applications'}</h2>
    <p>Signed in as: {human(stage||'Staff')}. Applications are routed according to the latest recorded workflow action.</p>
    {message&&<p role={messageType==='error'?'alert':'status'} aria-live={messageType==='error'?'assertive':'polite'} style={{padding:'12px 14px',borderRadius:8,fontWeight:600,background:messageType==='error'?'#fff1f2':'#ecfdf5',border:`1px solid ${messageType==='error'?'#fda4af':'#86efac'}`,color:messageType==='error'?'#b91c1c':'#166534'}}>{message}</p>}
    <button type="button" className="secondary" onClick={()=>void refresh()}>Refresh applications</button>
    <table><thead><tr><th>Application</th><th>Applicant</th><th>Product</th><th>Amount</th><th>Status</th><th>Previous action</th><th/></tr></thead>
    <tbody>{queue.length===0?<tr><td colSpan={7}>No applications currently assigned to this stage.</td></tr>:queue.map(r=><tr key={r.id}><td>{r.application_number||`DRAFT-${r.id}`}</td><td>{r.applicant_name||'—'}</td><td>{human(r.loan_type||'—')}</td><td>{r.requested_loan_amount??'—'}</td><td>{human(r.status)}</td><td>{r.last_action?human(r.last_action):'Awaiting processor'}</td><td><button className="secondary" type="button" onClick={()=>void open(r)}>Review full application</button></td></tr>)}</tbody></table>
    {selected&&<section style={{marginTop:24,borderTop:'2px solid #cbd5e1',paddingTop:16}}>
      <button className="secondary" type="button" onClick={()=>{closePreview();setSelected(null);setDetail(null);}}>← Back to applications</button>
      <h3>Full application — {selected.application_number}</h3>
      {busy&&!detail?<p>Loading application…</p>:null}
      {app&&<><Details label="Application status" value={app.status}/><Details label="Created" value={app.createdAt}/>
        <Section title="Applicant and KYC details" data={app.applicant as RecordMap}/>
        <Section title="Employment and income" data={app.employmentDetails as RecordMap}/>
        <Section title="Loan terms" data={app.loanDetails as RecordMap}/>
        <Section title="Credit score (self-reported unless bureau evidence is available)" data={app.creditCheck as RecordMap}/>
        <h4>Uploaded documents</h4><p style={{fontSize:13}}>Select Preview to inspect the original uploaded PDF or image. Preview does not mark the document as verified.</p>
        <div style={{overflowX:'auto'}}><table><thead><tr><th>Document Type</th><th>Description</th><th>Status</th><th>Preview</th></tr></thead><tbody>
          {documentTypes.map(([type,description])=>{
            const doc=((detail?.documents as RecordMap[])||[]).find(d=>d.document_type===type);
            return <tr key={type}><td>{type}</td><td>{description}</td><td>{String(doc?.status||'NOT_UPLOADED')}</td><td>
              {doc?.id&&String(doc.status||'').toUpperCase()!=='NOT_UPLOADED'?<button type="button" className="secondary" aria-label={`Preview ${description}`} title={`Preview ${description}`} disabled={previewBusy} onClick={()=>void previewDocument(doc)}>📄 Preview</button>:<span>—</span>}
            </td></tr>;
          })}
          {((detail?.documents as RecordMap[])||[]).filter(d=>!documentTypes.some(([type])=>type===d.document_type)).map(d=><tr key={String(d.id)}><td>{String(d.document_type)}</td><td>{String(d.document_name||'Additional document')}</td><td>{String(d.status||'NOT_UPLOADED')}</td><td><button type="button" className="secondary" disabled={previewBusy} onClick={()=>void previewDocument(d)}>📄 Preview</button></td></tr>)}
        </tbody></table></div>
        {previewUrl&&<section aria-label="Document preview" style={{border:'1px solid #cbd5e1',borderRadius:8,padding:12,marginTop:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:8}}><strong>Preview: {previewName}</strong><button type="button" className="secondary" onClick={closePreview}>Close preview</button></div>
          {previewType==='application/pdf'?<iframe title={`Preview ${previewName}`} src={previewUrl} style={{width:'100%',height:600,border:0}}/>:<img src={previewUrl} alt={`Preview ${previewName}`} style={{maxWidth:'100%',maxHeight:600,objectFit:'contain'}}/>}
        </section>}
        <h4>Verification evidence</h4>
        {reviews.length?reviews.map((v,i)=><p key={i}><strong>{human(String(v.check_type))}: {human(String(v.outcome))}</strong> — {String(v.evidence_reference||'—')} ({String(v.reviewer_username||'—')}) {v.notes?`— ${String(v.notes)}`:''}</p>):<p>No manual reviews recorded. {canRecordReview?'Use the form below to record evidence before forwarding.':'This role has read-only access to verification evidence.'}</p>}
        {canRecordReview&&<section style={{padding:16,border:'1px solid #cbd5e1',borderRadius:8,marginTop:12}}>
          <h4>Record Manual Review</h4><p style={{fontSize:13}}>Manual evidence is not live provider verification.</p>
          <div className="field-grid">
            <label>Verification check<select value={checkType} onChange={e=>setCheckType(e.target.value)}>{checks.map(v=><option key={v} value={v}>{human(v)}</option>)}</select></label>
            <label>Outcome<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="PENDING">Pending</option></select></label>
            <label className="full-width">Evidence reference *<input value={evidenceReference} onChange={e=>setEvidenceReference(e.target.value)} maxLength={250} placeholder="Document ID / evidence reference" /></label>
            <label className="full-width">Review remarks<textarea value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)} maxLength={2000} rows={3}/></label>
          </div>
          <button type="button" className="primary" disabled={reviewLoading||busy||!evidenceReference.trim()} onClick={()=>void recordReview()}>{reviewLoading?'Saving review…':'Record Manual Review'}</button>
        </section>}
        {stage==='OPERATIONS'&&<section style={{padding:16,border:'1px solid #cbd5e1',borderRadius:8,marginTop:12}}>
          <h4>Disbursal and Loan Account</h4>
          <p>External disbursal is available only after provider URLs are configured. The provider must support idempotent request IDs.</p>
          <Details label="Application status" value={selected.status}/>
          <Details label="Offer status" value={offer?.status||'No offer recorded'}/>
          <Details label="Disbursal status" value={disbursal?.status||'NOT_STARTED'}/>
          <Details label="Loan number" value={disbursal?.loan_number}/>
          <Details label="Provider reference" value={disbursal?.provider_reference}/>
          <div className="field-grid">
            <label>Beneficiary account<input value={beneficiaryAccount} onChange={e=>setBeneficiaryAccount(e.target.value)} maxLength={20}/></label>
            <label>Beneficiary IFSC<input value={beneficiaryIfsc} onChange={e=>setBeneficiaryIfsc(e.target.value.toUpperCase())} maxLength={11}/></label>
            <label>Disbursal reference<input value={operationRef} onChange={e=>setOperationRef(e.target.value)} maxLength={100}/></label>
          </div>
          <button type="button" className="primary" disabled={busy||selected.status!=='APPROVED'||(disbursal?.status&&disbursal.status!=='NOT_STARTED')} onClick={()=>void processDisbursal()}>Process Disbursal</button>
          <button type="button" className="secondary" disabled={busy} onClick={()=>void loadDisbursal(selected.id)}>Refresh Provider Status</button>
        </section>}
        <h4>Decision timeline</h4>{timeline.length?timeline.map((t,i)=><p key={i}>{human(String(t.action))} — {String(t.reason_code)} by {String(t.actor)} ({String(t.created_at)})</p>):<p>No decisions yet.</p>}
        {(actionsByStage[stage]||[]).length>0&&<section style={{marginTop:20,padding:16,border:'1px solid #cbd5e1',borderRadius:8}}><h3>{stage==='APPLICATION_PROCESSOR'?'Forward to Credit Underwriter':stage==='CREDIT_UNDERWRITER'?'Underwriting recommendation':'Credit Manager decision'}</h3>
          {stage==='CREDIT_MANAGER'&&<p>Final approval is permitted only in an explicitly enabled local demo, after a separate underwriter recommendation, authority check, current manual PASS evidence and bureau consent. Demo approval is not a real sanction.</p>}
          <div className="field-grid"><label>Action<select value={action} onChange={e=>setAction(e.target.value)}>{actionsByStage[stage].map(a=><option key={a} value={a}>{human(a)}</option>)}</select></label>
          <label>Reason code<select value={reasonCode} onChange={e=>setReasonCode(e.target.value)}><option value="">Select reason</option>{(reasonsByStage[stage]||[]).map(v=><option key={v} value={v}>{human(v)}</option>)}</select></label>
          <label className="full-width">Review remarks<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label></div>
          <button className="primary" type="button" disabled={busy} onClick={()=>void submit()}>{stage==='APPLICATION_PROCESSOR'?'Forward to Underwriter':'Submit Decision'}</button></section>}
      </>}
    </section>}
  </section>;
}
