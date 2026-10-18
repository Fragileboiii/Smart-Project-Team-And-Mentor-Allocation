import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { requestApi, allocationApi } from '../../services/api';
import { MentorRequest, Allocation } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import { ClipboardList, X, AlertCircle, MessageSquareQuote } from 'lucide-react';

export default function StudentRequests() {
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    Promise.all([requestApi.list(), allocationApi.list()])
      .then(([r, a]) => { setRequests(r.data); setAllocations(a.data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function cancelRequest(id: string) {
    try {
      await requestApi.cancel(id);
      setMsg({ type: 'ok', text: 'Request cancelled' });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    }
  }

  async function cancelAllocation(id: string) {
    try {
      await allocationApi.cancel(id);
      setMsg({ type: 'ok', text: 'Allocation cancelled' });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="text-xl font-bold text-white">Mentor Requests & Allocations</h1>

        {msg && (
          <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {msg.text}
          </div>
        )}

        {/* Active allocations */}
        {allocations.filter(a => a.status === 'active').length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Active Allocations (First-Come Basis)</h2>
            <div className="space-y-2">
              {allocations.filter(a => a.status === 'active').map(a => (
                <div key={a.id} className="card border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm">{a.mentor_first} {a.mentor_last}</p>
                      {a.mentor_domain && (
                        <span className="badge bg-indigo-500/20 text-indigo-300 text-xs">
                          {a.mentor_domain}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.team_name} {a.project_domain ? `(${a.project_domain})` : ''} · Allocated {new Date(a.allocated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={a.status} />
                    <button onClick={() => cancelAllocation(a.id)} className="text-rose-400 hover:text-rose-300 transition-colors" title="Release Allocation">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Request queue */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">All Requests</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : requests.length === 0 ? (
            <div className="card text-center py-10">
              <ClipboardList size={36} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">No requests yet. Go to Mentors to submit one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{r.mentor_first} {r.mentor_last}</span>
                        {r.mentor_domain && (
                          <span className="badge bg-indigo-500/20 text-indigo-300 text-xs">
                            {r.mentor_domain}
                          </span>
                        )}
                        <StatusBadge status={r.status} />
                      </div>

                      <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Team: <span className="text-slate-300">{r.team_name}</span> {r.project_domain ? `(${r.project_domain})` : ''}</span>
                        <span>Priority Score: <span className="text-slate-300">{Number(r.priority_score).toFixed(2)}</span></span>
                        <span>Queued: <span className="text-slate-300">{new Date(r.enqueue_time).toLocaleString()}</span></span>
                        {r.failure_reason && <span className="text-rose-400">{r.failure_reason}</span>}
                      </div>

                      {/* Mentor Rejection Improvement Comments */}
                      {r.status === 'rejected' && r.rejection_comments && (
                        <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1">
                          <div className="flex items-center gap-1.5 text-rose-300 font-semibold text-xs">
                            <MessageSquareQuote size={15} />
                            <span>Mentor Feedback & Required Improvements Before Reapplying:</span>
                          </div>
                          <p className="text-slate-200 text-xs pl-5 font-mono bg-navy-900/60 p-2 rounded border border-rose-500/20">
                            "{r.rejection_comments}"
                          </p>
                          <p className="text-[11px] text-slate-400 pl-5">
                            💡 Review these required improvements with your team and address them before submitting a new request once cooldown finishes.
                          </p>
                        </div>
                      )}
                    </div>

                    {['pending', 'queued'].includes(r.status) && (
                      <button onClick={() => cancelRequest(r.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-1" title="Cancel request">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
