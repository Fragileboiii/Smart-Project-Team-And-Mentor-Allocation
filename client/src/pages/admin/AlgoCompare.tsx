import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { schedulerApi } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ALGO_INFO = [
  {
    name: 'FCFS',
    fullName: 'First-Come, First-Served',
    color: '#6366f1',
    description: 'Processes requests strictly in arrival order. Simple and fair — no request is ever skipped. Can cause a "convoy effect" where short requests wait behind long ones.',
  },
  {
    name: 'PRIORITY',
    fullName: 'Priority Scheduling with Aging',
    color: '#22d3ee',
    description: 'Assigns a score (user priority + team CGPA) and processes highest-score first. Aging increases score over time (score += wait_minutes x 0.1) so low-priority requests are never starved.',
  },
  {
    name: 'ROUND ROBIN',
    fullName: 'Round Robin',
    color: '#34d399',
    description: 'Each request gets one allocation attempt (quantum). A request that cannot be allocated returns to the back of the ready queue and receives another turn next tick — giving fair cyclic access.',
  },
];

export default function AdminAlgoCompare() {
  const [metrics, setMetrics] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([schedulerApi.metrics(), schedulerApi.events(100)])
      .then(([m, e]) => { setMetrics(m.data); setEvents(e.data); })
      .finally(() => setLoading(false));
  }, []);

  const timing = metrics?.timing;

  const chartData = ALGO_INFO.map(a => ({
    name: a.name,
    color: a.color,
    avgWait: a.name === 'FCFS' ? Number(timing?.avg_wait_sec || 0) : 0,
    avgTurnaround: a.name === 'FCFS' ? Number(timing?.avg_turnaround_sec || 0) : 0,
  }));

  const statusCounts: Record<string, number> = {};
  if (metrics?.counts) {
    for (const row of metrics.counts) { statusCounts[row.status] = Number(row.cnt); }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-white">CPU Scheduling Algorithm Comparison</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ALGO_INFO.map(a => (
            <div key={a.name} className="card" style={{ borderColor: a.color + '44' }}>
              <div className="text-xs font-mono font-bold mb-1" style={{ color: a.color }}>{a.name}</div>
              <div className="text-sm font-semibold text-white mb-2">{a.fullName}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{a.description}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <h2 className="font-semibold text-white mb-3 text-sm">Live Timing Metrics (current scheduler run)</h2>
            {loading ? <p className="text-slate-500 text-sm">Loading...</p> : (
              <div className="space-y-3">
                {[
                  { label: 'Avg Wait Time', value: Math.round(Number(timing?.avg_wait_sec || 0)) + 's' },
                  { label: 'Avg Turnaround', value: Math.round(Number(timing?.avg_turnaround_sec || 0)) + 's' },
                  { label: 'Total Allocated', value: String(timing?.throughput || 0) },
                ].map(m => (
                  <div key={m.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{m.label}</span>
                    <span className="font-bold text-white">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-3 text-sm">Request Status Distribution</h2>
            {loading ? <p className="text-slate-500 text-sm">Loading...</p> : (
              <div className="space-y-1">
                {Object.entries(statusCounts).map(([status, cnt]) => (
                  <div key={status} className="flex justify-between text-xs">
                    <span className="text-slate-400 capitalize">{status}</span>
                    <span className="text-white font-medium">{cnt}</span>
                  </div>
                ))}
                {Object.keys(statusCounts).length === 0 && <p className="text-slate-500 text-xs">No requests yet</p>}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-white mb-4 text-sm">Avg Wait Time by Algorithm (live data from FCFS runs)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="s" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#e2e8f0', fontSize: 12 }} />
              <Bar dataKey="avgWait" name="Avg Wait (s)" radius={[4,4,0,0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="font-semibold text-white mb-3 text-sm">OS Concept: Why These Algorithms Matter</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div>
              <p className="text-slate-300 font-medium mb-1">Starvation Prevention</p>
              <p>Priority scheduling without aging can starve low-priority processes indefinitely. Aging ensures every waiting request eventually gets a high enough score to be scheduled.</p>
            </div>
            <div>
              <p className="text-slate-300 font-medium mb-1">Fairness vs Efficiency</p>
              <p>FCFS is maximally fair (no process is ever passed over) but inefficient when long requests block short ones. Round Robin trades some efficiency for even resource sharing.</p>
            </div>
            <div>
              <p className="text-slate-300 font-medium mb-1">Turnaround vs Wait Time</p>
              <p>Turnaround = completion - arrival. Wait = processing_start - arrival. Priority scheduling minimises average wait for high-score requests at the expense of low-priority ones.</p>
            </div>
            <div>
              <p className="text-slate-300 font-medium mb-1">Throughput</p>
              <p>All three algorithms achieve the same maximum throughput (bounded by mentor capacity). The difference is in which requests get served first and how fairly waiting time is distributed.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-white mb-3 text-sm">Recent Scheduler Events</h2>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {events.slice(0, 50).map((e, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-navy-700 last:border-0">
                <span className="text-indigo-300 font-mono w-40 truncate">{e.event_type}</span>
                <span className="text-slate-500 flex-1 text-center truncate">{e.team_name || '--'}</span>
                <span className="text-slate-500">{new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
            {events.length === 0 && <p className="text-slate-500 text-xs">No events yet. Run the scheduler to generate events.</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}