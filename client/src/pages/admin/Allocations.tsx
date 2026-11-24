import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { allocationApi, mentorApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import { RefreshCw, ArrowRightLeft, Check, X } from 'lucide-react';

export default function AdminAllocations() {
  const [allocations, setAllocations] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [pickedMentor, setPickedMentor] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([allocationApi.list(), mentorApi.list()])
      .then(([a, m]) => { setAllocations(a.data); setMentors(m.data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function confirmReassign(allocId: string) {
    if (!pickedMentor) { setMsg({ type: 'err', text: 'Select a mentor first' }); return; }
    setBusy(true); setMsg(null);
    try {
      await allocationApi.reassign(allocId, pickedMentor);
      setMsg({ type: 'ok', text: 'Allocation reassigned' });
      setReassignId(null); setPickedMentor('');
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Reassign failed' });
    } finally { setBusy(false); }
  }

  const active = allocations.filter(a => a.status === 'active');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Allocations</h1>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <p className="text-xs text-slate-500">Active mentor allocations. Admins can reassign a team to a different mentor (capacity permitting).</p>

        {msg && (
          <div className={'rounded-lg px-4 py-2 text-sm ' + (msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : active.length === 0 ? (
          <div className="card text-center py-12"><p className="text-slate-400 text-sm">No active allocations.</p></div>
        ) : (
          <div className="space-y-3">
            {active.map(a => (
              <div key={a.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{a.team_name}</span>
                      {a.project_domain && <span className="badge bg-indigo-500/20 text-indigo-300 text-xs">{a.project_domain}</span>}
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="text-xs text-slate-400">Mentor: {a.mentor_first} {a.mentor_last} {a.mentor_domain ? ('(' + a.mentor_domain + ')') : ''}</p>
                    <p className="text-xs text-slate-500">Allocated {new Date(a.allocated_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    {reassignId === a.id ? (
                      <div className="flex items-center gap-2">
                        <select className="input text-xs w-44" value={pickedMentor} onChange={e => setPickedMentor(e.target.value)}>
                          <option value="">Select new mentor</option>
                          {mentors.filter(m => m.id !== a.mentor_id).map(m => (
                            <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.remaining_capacity} left)</option>
                          ))}
                        </select>
                        <button onClick={() => confirmReassign(a.id)} disabled={busy} className="btn-primary text-xs flex items-center gap-1"><Check size={13} /> Confirm</button>
                        <button onClick={() => { setReassignId(null); setPickedMentor(''); }} className="btn-secondary text-xs flex items-center gap-1"><X size={13} /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setReassignId(a.id); setPickedMentor(''); }} className="btn-secondary text-xs flex items-center gap-1">
                        <ArrowRightLeft size={13} /> Reassign
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}