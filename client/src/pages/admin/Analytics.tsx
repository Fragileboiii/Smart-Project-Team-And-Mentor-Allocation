import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { adminApi } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { FileText } from 'lucide-react';

const COLORS = ['#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#f43f5e', '#a78bfa'];

export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    adminApi.analytics().then(r => setData(r.data));
    adminApi.auditLogs(page).then(r => {
      setAuditLogs(r.data.logs);
      setTotalLogs(r.data.total);
    });
  }, [page]);

  if (!data) return <Layout><p className="text-slate-400">Loading...</p></Layout>;

  const workloadData = data.mentorWorkload.map((m: any) => ({
    name: m.first_name,
    active: Number(m.active_count),
    remaining: m.max_capacity - Number(m.active_count),
    max: m.max_capacity,
  }));

  const requestPieData = data.requestStats.map((s: any) => ({
    name: s.status,
    value: Number(s.cnt),
  }));

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-white">Analytics</h1>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Students',    value: data.summary.totalStudents },
            { label: 'Total Mentors',     value: data.summary.totalMentors },
            { label: 'Total Teams',       value: data.summary.totalTeams },
            { label: 'Active Allocations',value: data.summary.activeAllocations },
            { label: 'Pending Requests',  value: data.summary.pendingRequests },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Mentor workload stacked bar */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 text-sm">Mentor Capacity Utilization</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workloadData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#e2e8f0', fontSize: 12 }} />
                <Bar dataKey="active" name="Active" stackId="a" fill="#6366f1" radius={[0,0,0,0]} />
                <Bar dataKey="remaining" name="Remaining" stackId="a" fill="#334155" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Request status pie */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4 text-sm">Request Status Distribution</h2>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={requestPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {requestPieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 text-xs">
                {requestPieData.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-400 capitalize">{s.name}</span>
                    <span className="text-white font-medium ml-auto pl-2">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audit log */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-indigo-400" />
              <h2 className="font-semibold text-white text-sm">Audit Log</h2>
              <span className="text-xs text-slate-500">({totalLogs} total)</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">← Prev</button>
              <span className="text-xs text-slate-400">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= totalLogs}
                className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">Next →</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-navy-700">
                  <th className="text-left pb-2 pr-3">Action</th>
                  <th className="text-left pb-2 pr-3">Entity</th>
                  <th className="text-left pb-2 pr-3">User</th>
                  <th className="text-right pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => (
                  <tr key={i} className="border-t border-navy-700 hover:bg-navy-700/30">
                    <td className="py-1.5 pr-3 text-indigo-300 font-mono">{log.action}</td>
                    <td className="py-1.5 pr-3 text-slate-400">{log.entity_type} · {log.entity_id?.slice(0, 8)}…</td>
                    <td className="py-1.5 pr-3 text-slate-300">{log.first_name || '—'} {log.last_name || ''}</td>
                    <td className="py-1.5 text-right text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
