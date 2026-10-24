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
const human = (s:string) => s.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
function Details({label,value}:{label:string;value:unknown}) { return <div style={{padding:'8px 0',borderBottom:'1px solid #e5e7eb'}}><strong>{label}: </strong>{value==null || value===''?'—':String(value)}</div>; }
function Section({title,data}:{title:string;data:RecordMap|undefined}) {
  return <section style={{marginTop:18}}><h4>{title}</h4>{data ? Object.entries(data).filter(([key])=>!['additionalDetails'].includes(key)).map(([key,value])=><Details key={key} label={human(key)} value={typeof value==='object' ? JSON.stringify(value) : value}/>) : <p>Not provided</p>}{!!data?.additionalDetails && <details><summary>Additional details</summary>{Object.entries(data.additionalDetails as RecordMap).map(([k,v])=><Details key={k} label={human(k)} value={v}/>)}</details>}</section>;
}
export function UnderwritingWorkspace({session}:{session:AuthSession}) {
  const [stage,setStage]=useState(''); const [queue,setQueue]=useState<Row[]>([]); const [selected,setSelected]=useState<Row|null>(null);
  const [detail,setDetail]=useState<RecordMap|null>(null); const [timeline,setTimeline]=useState<RecordMap[]>([]);
  const [action,setAction]=useState(''); const [reasonCode,setReasonCode]=useState(''); const [notes,setNotes]=useState('');
  const [message,setMessage]=useState(''); const [messageType,setMessageType]=useState<'error'|'success'>('error'); const [busy,setBusy]=useState(false);
  const showError=(value:string)=>{setMessageType('error');setMessage(value);};
  const showSuccess=(value:string)=>{setMessageType('success');setMessage(value);};
  const request=async(path:string,init:RequestInit={})=>{
    const headers=buildAuthHeaders(session); if(init.body)headers.set('Content-Type','application/json');
    const response=await fetch(path,{...init,headers}); const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.message||`Request failed (${response.status})`); return body;
  };
  const refresh=async()=>{const rows=await request('/api/staff/underwriting/queue?page=0&size=100');setQueue(rows);};
  const open=async(row:Row)=>{
    setSelected(row);setMessage('');setMessageType('error');setBusy(true);
    try {const [d,t]=await Promise.all([request(`/api/staff/underwriting/${row.id}/review`),request(`/api/staff/underwriting/${row.id}/timeline`)]);setDetail(d);setTimeline(t);}
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
    <h2>{stage==='APPLICATION_PROCESSOR'?'Pending Applications':stage==='OPERATIONS'?'Operations – Demo Approved Applications':'Recent Applications'}</h2>
    <p>Signed in as: {human(stage||'Staff')}. Applications are routed according to the latest recorded workflow action.</p>
    {message&&<p role={messageType==='error'?'alert':'status'} aria-live={messageType==='error'?'assertive':'polite'} style={{padding:'12px 14px',borderRadius:8,fontWeight:600,background:messageType==='error'?'#fff1f2':'#ecfdf5',border:`1px solid ${messageType==='error'?'#fda4af':'#86efac'}`,color:messageType==='error'?'#b91c1c':'#166534'}}>{message}</p>}
    <button type="button" className="secondary" onClick={()=>void refresh()}>Refresh applications</button>
    <table><thead><tr><th>Application</th><th>Applicant</th><th>Product</th><th>Amount</th><th>Status</th><th>Previous action</th><th/></tr></thead>
    <tbody>{queue.length===0?<tr><td colSpan={7}>No applications currently assigned to this stage.</td></tr>:queue.map(r=><tr key={r.id}><td>{r.application_number||`DRAFT-${r.id}`}</td><td>{r.applicant_name||'—'}</td><td>{human(r.loan_type||'—')}</td><td>{r.requested_loan_amount??'—'}</td><td>{human(r.status)}</td><td>{r.last_action?human(r.last_action):'Awaiting processor'}</td><td><button className="secondary" type="button" onClick={()=>void open(r)}>Review full application</button></td></tr>)}</tbody></table>
    {selected&&<section style={{marginTop:24,borderTop:'2px solid #cbd5e1',paddingTop:16}}>
      <button className="secondary" type="button" onClick={()=>{setSelected(null);setDetail(null);}}>← Back to applications</button>
      <h3>Full application — {selected.application_number}</h3>
      {busy&&!detail?<p>Loading application…</p>:null}
      {app&&<><Details label="Application status" value={app.status}/><Details label="Created" value={app.createdAt}/>
        <Section title="Applicant and KYC details" data={app.applicant as RecordMap}/>
        <Section title="Employment and income" data={app.employmentDetails as RecordMap}/>
        <Section title="Loan terms" data={app.loanDetails as RecordMap}/>
        <Section title="Credit score (self-reported unless bureau evidence is available)" data={app.creditCheck as RecordMap}/>
        <h4>Uploaded documents</h4>{((detail?.documents as RecordMap[])||[]).length?((detail?.documents as RecordMap[])||[]).map((d,i)=><div key={i}><Details label={String(d.document_type)} value={`${d.document_name||''} — ${d.status||'Pending'}`}/></div>):<p>No documents found.</p>}
        <h4>Verification evidence</h4>{((detail?.verifications as RecordMap[])||[]).length?((detail?.verifications as RecordMap[])||[]).map((v,i)=><p key={i}>{String(v.check_type)}: {String(v.outcome)} — {String(v.evidence_reference)} ({String(v.reviewer_username)})</p>):<p>No manual reviews recorded. Use the verification screen to record evidence before forwarding.</p>}
        <h4>Decision timeline</h4>{timeline.length?timeline.map((t,i)=><p key={i}>{human(String(t.action))} — {String(t.reason_code)} by {String(t.actor)} ({String(t.created_at)})</p>):<p>No decisions yet.</p>}
        {(actionsByStage[stage]||[]).length>0&&<section style={{marginTop:20,padding:16,border:'1px solid #cbd5e1',borderRadius:8}}><h3>{stage==='APPLICATION_PROCESSOR'?'Forward to Credit Underwriter':stage==='CREDIT_UNDERWRITER'?'Underwriting recommendation':'Credit Manager decision'}</h3>
          {stage==='CREDIT_MANAGER'&&<p>Final approval is permitted only in an explicitly enabled local demo, after a separate underwriter recommendation, authority check, current manual PASS evidence and bureau consent. Demo approval is not a real sanction.</p>}
          <div className="field-grid"><label>Action<select value={action} onChange={e=>setAction(e.target.value)}>{actionsByStage[stage].map(a=><option key={a} value={a}>{human(a)}</option>)}</select></label>
          <label>Reason code<input value={reasonCode} onChange={e=>setReasonCode(e.target.value.toUpperCase())} placeholder="REVIEW_COMPLETED" maxLength={80}/></label>
          <label className="full-width">Review remarks<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label></div>
          <button className="primary" type="button" disabled={busy} onClick={()=>void submit()}>{stage==='APPLICATION_PROCESSOR'?'Forward to Underwriter':'Submit Decision'}</button></section>}
      </>}
    </section>}
  </section>;
}
