import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { osApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import { RefreshCw, Lock, Activity, Database, Network } from 'lucide-react';

export default function AdminMonitor() {
  const [resources, setResources] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [locks, setLocks] = useState<any[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([osApi.resources(), osApi.processes(), osApi.locks(), osApi.deadlockGraph()])
      .then(([r, p, l, g]) => {
        setResources(r.data);
        setProcesses(p.data);
        setLocks(l.data);
        setGraph(g.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const stateColors: Record<string, string> = {
    pending:    'bg-amber-500',
    queued:     'bg-amber-500',
    processing: 'bg-blue-500',
    allocated:  'bg-emerald-500',
    waiting:    'bg-orange-500',
    failed:     'bg-rose-500',
    cancelled:  'bg-slate-500',
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">OS Resource Monitor</h1>
          <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* OS concept explainer */}
        <div className="card border-cyan-500/30">
          <p className="text-xs text-slate-400 font-medium mb-1">OS Concepts Demonstrated</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
            <div><span className="text-cyan-400 font-medium">Mutex:</span> In-process lock map serializes same-mentor requests</div>
            <div><span className="text-cyan-400 font-medium">Row Lock:</span> SELECT…FOR UPDATE prevents concurrent over-allocation</div>
            <div><span className="text-cyan-400 font-medium">Semaphore:</span> max_capacity acts as counting semaphore</div>
            <div><span className="text-cyan-400 font-medium">ACID:</span> All allocations in transactions with rollback</div>
          </div>
        </div>

        {/* Resource availability */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-indigo-400" />
            <h2 className="font-semibold text-white text-sm">Mentor Resources (Semaphore State)</h2>
          </div>
          <div className="space-y-3">
            {resources.map(r => (
              <div key={r.id} className="flex items-center gap-4">
                <div className="w-36 text-sm text-slate-300 truncate">{r.name}</div>
                <div className="flex-1">
                  <div className="h-2 bg-navy-700 rounded-full">
                    <div className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(r.activeAllocations / r.maxCapacity) * 100}%`,
                        backgroundColor: r.activeAllocations >= r.maxCapacity ? '#f43f5e' : '#34d399'
                      }} />
                  </div>
                </div>
                <div className="text-xs text-slate-400 w-24 text-right">
                  {r.activeAllocations}/{r.maxCapacity} used
                </div>
                <StatusBadge status={r.isAvailable && r.remainingCapacity > 0 ? 'active' : 'waiting'} />
              </div>
            ))}
          </div>
        </div>

        {/* Process state table */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-emerald-400" />
            <h2 className="font-semibold text-white text-sm">Request Process States</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-navy-700">
                  <th className="text-left pb-2 pr-3">Team</th>
                  <th className="text-left pb-2 pr-3">Mentor</th>
                  <th className="text-left pb-2 pr-3">State</th>
                  <th className="text-right pb-2 pr-3">Wait (s)</th>
                  <th className="text-right pb-2">Turnaround (s)</th>
                </tr>
              </thead>
              <tbody>
                {processes.slice(0, 15).map((p, i) => (
                  <tr key={i} className="border-t border-navy-700 hover:bg-navy-700/30">
                    <td className="py-1.5 pr-3 text-slate-300">{p.team_name}</td>
                    <td className="py-1.5 pr-3 text-slate-400">{p.mentor_first} {p.mentor_last}</td>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${stateColors[p.status] || 'bg-slate-500'}`} />
                        <StatusBadge status={p.status} />
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-slate-400">{p.wait_sec}</td>
                    <td className="py-1.5 text-right text-slate-400">{p.turnaround_sec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lock log */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={16} className="text-amber-400" />
            <h2 className="font-semibold text-white text-sm">Resource Lock Log (Mutex Events)</h2>
          </div>
          {locks.length === 0 ? (
            <p className="text-slate-500 text-sm">No lock events recorded</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {locks.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-navy-700 last:border-0">
                  <span className="text-slate-400 font-mono">{l.first_name} {l.last_name}</span>
                  <StatusBadge status={l.lock_status} />
                  <span className="text-slate-500">{new Date(l.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resource allocation graph */}
        {graph && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Network size={16} className="text-rose-400" />
              <h2 className="font-semibold text-white text-sm">Resource-Allocation Graph</h2>
            </div>
            <p className="text-xs text-slate-500 mb-3">{graph.note}</p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-medium mb-2">Nodes ({graph.nodes.length})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {graph.nodes.map((n: any) => (
                    <div key={n.id} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${n.type === 'mentor' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                      <span className="text-slate-300">{n.label}</span>
                      <span className="text-slate-600">({n.type})</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-slate-400 font-medium mb-2">Edges ({graph.edges.length})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {graph.edges.map((e: any, i: number) => (
                    <div key={i} className="text-slate-400">
                      <span className={e.type === 'requesting' ? 'text-amber-400' : 'text-emerald-400'}>
                        {e.type === 'requesting' ? '→ requests' : '← assigned'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
