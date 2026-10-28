import {useEffect,useState} from 'react';
import {buildAuthHeaders,type AuthSession} from './auth';
type Event={id:number;actor:string|null;application_id:number|null;action:string;reason_code:string|null;created_at:string};
export function StaffAuditPortal({session}:{session:AuthSession}) {
 const [events,setEvents]=useState<Event[]>([]),[page,setPage]=useState(0),[error,setError]=useState('');
 useEffect(()=>{const headers=buildAuthHeaders(session);
  void fetch(`/api/staff/audit/events?page=${page}&size=50`,{headers})
   .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||`HTTP ${r.status}`);return d;})
   .then(d=>setEvents(d)).catch(e=>setError(String(e)));
 },[page,session]);
 return <section className="card form-card"><h2>Compliance & Audit</h2><p>Read-only staff activity and application decision log. No edit, sanction, or disbursement controls.</p>
  {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
  <div style={{overflowX:'auto'}}><table><thead><tr><th>Time</th><th>Actor</th><th>Application</th><th>Action</th><th>Reason</th></tr></thead>
   <tbody>{events.map(e=><tr key={e.id}><td>{e.created_at}</td><td>{e.actor||'—'}</td><td>{e.application_id??'—'}</td><td>{e.action}</td><td>{e.reason_code||'—'}</td></tr>)}</tbody></table></div>
  <div className="inline-actions"><button type="button" className="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button type="button" className="secondary" disabled={events.length<50} onClick={()=>setPage(p=>p+1)}>Next</button></div>
 </section>;
}
