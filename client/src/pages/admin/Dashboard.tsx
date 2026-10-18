import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { adminApi } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, BookOpen, Layers, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => { adminApi.analytics().then(r => setData(r.data)).catch(() => {}); }, []);

  if (!data) return <Layout><p className="text-slate-400">Loading...</p></Layout>;

  const { summary, mentorWorkload, requestStats, recentActivity } = data;

  const COLORS = ['#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#f43f5e'];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Admin Overview</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Students',    value: summary.totalStudents,    icon: <Users size={16} className="text-indigo-400" /> },
            { label: 'Mentors',     value: summary.totalMentors,     icon: <BookOpen size={16} className="text-cyan-400" /> },
            { label: 'Teams',       value: summary.totalTeams,       icon: <Layers size={16} className="text-emerald-400" /> },
            { label: 'Allocated',   value: summary.activeAllocations,icon: <CheckCircle size={16} className="text-emerald-400" /> },
            { label: 'Pending Req', value: summary.pendingRequests,  icon: <Clock size={16} className="text-amber-400" /> },
          ].map(s => (
            <div key={s.label} className="card flex items-center gap-2">
              {s.icon}
              <div>
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Mentor workload chart */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Mentor Workload</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={mentorWorkload.map((m: any) => ({
                name: m.first_name,
                active: Number(m.active_count),
                max: m.max_capacity,
              }))}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#e2e8f0', fontSize: 12 }} />
                <Bar dataKey="active" name="Active" radius={[4, 4, 0, 0]}>
                  {mentorWorkload.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Request status breakdown */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Request Status</h2>
            <div className="space-y-2">
              {requestStats.map((s: any) => (
                <div key={s.status} className="flex items-center justify-between">
                  <StatusBadge status={s.status} />
                  <span className="text-sm font-medium text-white">{s.cnt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Run Scheduler', to: '/admin/scheduler', color: 'border-indigo-500/40' },
            { label: 'OS Monitor',    to: '/admin/monitor',   color: 'border-cyan-500/40' },
            { label: 'Banker\'s Algo',to: '/admin/bankers',   color: 'border-amber-500/40' },
            { label: 'Analytics',     to: '/admin/analytics', color: 'border-emerald-500/40' },
          ].map(l => (
            <Link key={l.to} to={l.to} className={`card ${l.color} text-center hover:bg-navy-700 transition-colors`}>
              <p className="text-sm font-medium text-white">{l.label}</p>
            </Link>
          ))}
        </div>

        {/* Recent activity */}
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Recent Activity</h2>
          <div className="space-y-1">
            {recentActivity.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-navy-700 last:border-0">
                <span className="text-slate-400">{a.action}</span>
                <span className="text-slate-500">{a.first_name} · {new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
