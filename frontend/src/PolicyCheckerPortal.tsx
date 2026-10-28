import {useEffect,useState} from 'react';
import {buildAuthHeaders,type AuthSession} from './auth';
type Item={id:number;change_type:string;proposed_value:string;status:string;reason?:string;requested_by:string;created_at:string};
export function PolicyCheckerPortal({session}:{session:AuthSession}) {
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false);
 const request=async(url:string,init:RequestInit={})=>{
  const headers=buildAuthHeaders(session);if(init.body)headers.set('Content-Type','application/json');
  const r=await fetch(url,{...init,headers});const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.message||`HTTP ${r.status}`);return data;
 };
 const load=async()=>setItems(await request('/api/staff/policy/changes'));
 useEffect(()=>{void load().catch(e=>setError(String(e)));},[]);
 const review=async(id:number,decision:'APPROVED'|'REJECTED')=>{
  if(!reason.trim()){setError('Checker reason is mandatory.');return;}
  setBusy(true);setError('');setMessage('');
  try {const result=await request(`/api/staff/policy/changes/${id}/review`,{method:'POST',body:JSON.stringify({decision,reason:reason.trim()})});
   setMessage(`Request ${id}: ${result.status}. ${result.published?'Product configuration published.':'No configuration published.'}`);setReason('');await load();
  }catch(e){setError(String(e));}finally{setBusy(false);}
 };
 return <section className="card form-card"><h2>Policy Maker–Checker Review</h2><p>Independent approval required. Approving a supported change publishes it to product configuration. The maker cannot check their own request.</p>
  {error&&<p role="alert" style={{color:'#b91c1c',fontWeight:700}}>{error}</p>}
  {message&&<p role="status" style={{color:'#166534'}}>{message}</p>}
  <label>Decision reason *<input value={reason} maxLength={250} onChange={e=>setReason(e.target.value)}/></label>
  <button className="secondary" type="button" onClick={()=>void load().catch(e=>setError(String(e)))}>Refresh proposals</button>
  {items.map(i=><div key={i.id} style={{border:'1px solid #cbd5e1',borderRadius:8,padding:12,marginTop:12}}>
   <strong>#{i.id} · {i.change_type} · {i.status}</strong><p>Maker: {i.requested_by} · Submitted: {i.created_at}</p>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{i.proposed_value}</pre>
   {i.status==='PENDING'&&<div className="inline-actions">
    <button className="primary" disabled={busy||!reason.trim()} onClick={()=>void review(i.id,'APPROVED')}>Approve & Publish</button>
    <button className="secondary" disabled={busy||!reason.trim()} onClick={()=>void review(i.id,'REJECTED')}>Reject</button>
   </div>}
  </div>)}
 </section>;
}
