import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { schedulerApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import { Play, RefreshCw, Clock, Zap } from 'lucide-react';

export default function AdminScheduler() {
  const [queue, setQueue] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [algorithm, setAlgorithm] = useState<'FCFS' | 'PRIORITY'>('FCFS');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  function load() {
    schedulerApi.queue().then(r => setQueue(r.data));
    schedulerApi.events(20).then(r => setEvents(r.data));
    schedulerApi.metrics().then(r => setMetrics(r.data));
  }

  useEffect(() => { load(); }, []);

  async function runScheduler() {
    setRunning(true);
    try {
      const r = await schedulerApi.run(algorithm);
      setResult(r.data);
      load();
    } catch (e: any) {
      setResult({ error: e.response?.data?.error || 'Failed' });
    } finally {
      setRunning(false);
    }
  }

  const timing = metrics?.timing;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <h1 className="text-xl font-bold text-white">Request Scheduler</h1>

        {/* Algorithm explainer */}
        <div className="card border-indigo-500/30">
          <p className="text-xs text-slate-400 font-medium mb-1">OS Concept: CPU Scheduling</p>
          <p className="text-xs text-slate-500">
            FCFS processes requests in arrival order (enqueue_time ASC) — simple, fair, no starvation.
            Priority scheduling uses a score based on user priority + CGPA average, with aging (score += wait_minutes × 0.1)
            to prevent low-priority requests from waiting indefinitely.
          </p>
        </div>

        {/* Controls */}
        <div className="card flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {(['FCFS', 'PRIORITY'] as const).map(a => (
              <button key={a} onClick={() => setAlgorithm(a)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${algorithm === a ? 'bg-indigo-500 text-white' : 'bg-navy-700 text-slate-400 hover:text-white'}`}>
                {a}
              </button>
            ))}
          </div>
          <button onClick={runScheduler} disabled={running}
            className="btn-primary flex items-center gap-2 text-sm">
            <Play size={14} /> {running ? 'Running...' : 'Run Scheduler'}
          </button>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Last run result */}
        {result && (
          <div className={`card ${result.error ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
            {result.error ? (
              <p className="text-rose-400 text-sm">{result.error}</p>
            ) : (
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { label: 'Processed', value: result.processed, color: 'text-white' },
                  { label: 'Allocated', value: result.allocated, color: 'text-emerald-400' },
                  { label: 'Waiting',   value: result.waiting,   color: 'text-amber-400' },
                  { label: 'Failed',    value: result.failed,    color: 'text-rose-400' },
                ].map(s => (
                  <div key={s.label}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metrics */}
        {timing && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Avg Wait Time',       value: `${Math.round(timing.avg_wait_sec || 0)}s`,       icon: <Clock size={14} className="text-amber-400" /> },
              { label: 'Avg Turnaround',      value: `${Math.round(timing.avg_turnaround_sec || 0)}s`, icon: <Zap size={14} className="text-indigo-400" /> },
              { label: 'Total Allocated',     value: timing.throughput || 0,                            icon: <Play size={14} className="text-emerald-400" /> },
            ].map(m => (
              <div key={m.label} className="card flex items-center gap-3">
                {m.icon}
                <div>
                  <p className="text-xs text-slate-400">{m.label}</p>
                  <p className="text-lg font-bold text-white">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Queue */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3">Current Queue ({queue.length})</h2>
            {queue.length === 0 ? (
              <p className="text-slate-500 text-sm">Queue is empty</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {queue.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 bg-navy-700 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-500 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-white">{r.team_name}</p>
                      <p className="text-slate-500">→ {r.mentor_first} {r.mentor_last} · wait {r.wait_seconds}s</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={r.status} />
                      <p className="text-slate-500 mt-0.5">score: {Number(r.priority_score).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event log */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3">Event Log</h2>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {events.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-navy-700 last:border-0">
                  <span className="text-indigo-300 font-mono">{e.event_type}</span>
                  <span className="text-slate-500">{e.team_name || '—'}</span>
                  <StatusBadge status={e.new_status || 'pending'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
