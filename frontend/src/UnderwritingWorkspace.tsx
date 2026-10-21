import { useEffect, useState } from 'react';
import { buildAuthHeaders, type AuthSession } from './auth';

type QueueRow = {
  id: number;
  application_number: string | null;
  status: string;
  updated_at: string;
  loan_type: string | null;
  requested_loan_amount: number | null;
};

type TimelineRow = {
  action: string;
  reason_code: string;
  notes: string | null;
  actor: string;
  created_at: string;
};

const ACTIONS = ['RECOMMEND_APPROVE', 'RECOMMEND_DECLINE', 'APPROVE', 'DECLINE', 'HOLD', 'SEND_BACK'];

export function UnderwritingWorkspace({ session }: { session: AuthSession }) {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [action, setAction] = useState('RECOMMEND_APPROVE');
  const [reasonCode, setReasonCode] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const request = async (path: string, init: RequestInit = {}) => {
    const headers = buildAuthHeaders(session);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || `Request failed (${response.status}).`);
    return body;
  };

  const loadQueue = async () => {
    setLoading(true);
    try {
      setQueue(await request('/api/staff/underwriting/queue'));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load the underwriting queue.');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async (row: QueueRow) => {
    setSelected(row);
    try {
      setTimeline(await request(`/api/staff/underwriting/${row.id}/timeline`));
    } catch (error) {
      setTimeline([]);
      setMessage(error instanceof Error ? error.message : 'Unable to load the timeline.');
    }
  };

  const submitDecision = async () => {
    if (!selected) return;
    if (!/^[A-Z0-9_]{3,80}$/.test(reasonCode)) {
      setMessage('Reason code must be 3-80 characters: uppercase letters, numbers and underscores.');
      return;
    }
    try {
      const result = await request(`/api/staff/underwriting/${selected.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action, reasonCode, notes: notes || null })
      });
      setMessage(`${result.action} recorded. Application status: ${result.status}.`);
      setReasonCode('');
      setNotes('');
      await loadQueue();
      await loadTimeline({ ...selected, status: result.status });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Decision could not be saved.');
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  return (
    <section className="card form-card">
      <h2>Underwriting Queue</h2>
      {message && <p role="status">{message}</p>}
      <button type="button" className="secondary" onClick={() => void loadQueue()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      <table>
        <thead><tr><th>Application</th><th>Loan type</th><th>Amount</th><th>Status</th><th>Updated</th><th /></tr></thead>
        <tbody>
          {queue.length === 0 && <tr><td colSpan={6}>No applications in the queue.</td></tr>}
          {queue.map(row => (
            <tr key={row.id}>
              <td>{row.application_number || `DRAFT-${row.id}`}</td>
              <td>{row.loan_type || '-'}</td>
              <td>{row.requested_loan_amount ?? '-'}</td>
              <td>{row.status}</td>
              <td>{new Date(row.updated_at).toLocaleString()}</td>
              <td><button type="button" className="secondary" onClick={() => void loadTimeline(row)}>Review</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div style={{ marginTop: 24 }}>
          <h3>{selected.application_number || `DRAFT-${selected.id}`} – decision</h3>
          <div className="field-grid">
            <label>Action
              <select value={action} onChange={event => setAction(event.target.value)}>
                {ACTIONS.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label>Reason code
              <input value={reasonCode} onChange={event => setReasonCode(event.target.value.toUpperCase())} placeholder="e.g. INCOME_VERIFIED" maxLength={80} />
            </label>
            <label className="full-width">Notes
              <textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={4000} rows={3} />
            </label>
          </div>
          <button type="button" className="primary" onClick={() => void submitDecision()}>Submit decision</button>

          <h3 style={{ marginTop: 24 }}>Timeline</h3>
          {timeline.length === 0 ? <p>No underwriting actions recorded yet.</p> : (
            <ul>
              {timeline.map((item, index) => (
                <li key={index}>
                  <strong>{item.action}</strong> ({item.reason_code}) by {item.actor} on {new Date(item.created_at).toLocaleString()}
                  {item.notes ? ` – ${item.notes}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
