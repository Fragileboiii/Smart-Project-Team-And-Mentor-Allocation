import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { studentApi, requestApi, allocationApi } from '../../services/api';
import { MentorRequest, Allocation } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import { Users, ClipboardList, Star, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [allocation, setAllocation] = useState<Allocation | null>(null);

  useEffect(() => {
    studentApi.getMe().then(r => setProfile(r.data)).catch(() => {});
    requestApi.list().then(r => setRequests(r.data.slice(0, 5))).catch(() => {});
    allocationApi.list().then(r => {
      const active = (r.data as Allocation[]).find(a => a.status === 'active');
      setAllocation(active || null);
    }).catch(() => {});
  }, []);

  const myTeam = profile ? { name: 'See Teams tab', status: 'active', member_count: 0 } : null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome, {user?.firstName}</h1>
          <p className="text-slate-400 text-sm mt-1">Your SmartAlloc dashboard</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Mentor',    value: allocation ? `${allocation.mentor_first} ${allocation.mentor_last}` : 'Not assigned', icon: <Star size={18} className="text-amber-400" /> },
            { label: 'Requests',  value: requests.length,              icon: <ClipboardList size={18} className="text-indigo-400" /> },
            { label: 'Skills',    value: profile?.skills?.length || 0, icon: <CheckCircle size={18} className="text-emerald-400" /> },
            { label: 'Semester',  value: profile?.semester || '—',      icon: <Users size={18} className="text-cyan-400" /> },
          ].map(s => (
            <div key={s.label} className="card flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className="text-white font-semibold text-sm truncate max-w-[100px]">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Mentor allocation card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Mentor Allocation</h2>
              <Link to="/student/mentors" className="text-xs text-indigo-400 hover:text-indigo-300">Find Mentor →</Link>
            </div>
            {allocation ? (
              <div>
                <p className="font-medium text-white">{allocation.mentor_first} {allocation.mentor_last}</p>
                <p className="text-xs text-slate-400 mt-1">Team: {allocation.team_name}</p>
                <div className="flex items-center gap-3 mt-3">
                  <StatusBadge status={allocation.status} />
                  <span className="text-xs text-slate-500">
                    Since {new Date(allocation.allocated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-slate-500 text-sm mb-3">No mentor assigned yet</p>
                <Link to="/student/mentors" className="btn-primary text-sm">Browse Mentors</Link>
              </div>
            )}
          </div>

          {/* Recent requests */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Recent Requests</h2>
              <Link to="/student/requests" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
            </div>
            {requests.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No requests yet</p>
            ) : (
              <div className="space-y-2">
                {requests.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-navy-700 rounded-lg px-3 py-2">
                    <span className="text-slate-300 truncate">{r.mentor_first} {r.mentor_last}</span>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'My Team',   to: '/student/teams',    color: 'border-indigo-500/30' },
            { label: 'Mentors',   to: '/student/mentors',  color: 'border-cyan-500/30' },
            { label: 'Requests',  to: '/student/requests', color: 'border-amber-500/30' },
            { label: 'Profile',   to: '/student/profile',  color: 'border-emerald-500/30' },
          ].map(l => (
            <Link key={l.to} to={l.to}
              className={`card ${l.color} text-center hover:bg-navy-700 transition-colors`}>
              <p className="text-sm font-medium text-white">{l.label}</p>
            </Link>
          ))}
        </div>

        {/* Skills */}
        {profile && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white">My Skills</h2>
              <Link to="/student/profile" className="text-xs text-indigo-400 hover:text-indigo-300">Edit →</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.skills || []).map((s: any) => (
                <span key={s.name} className="badge bg-indigo-500/20 text-indigo-300">{s.name}</span>
              ))}
              {!profile.skills?.length && (
                <p className="text-slate-500 text-sm">
                  Add skills to improve mentor matching.{' '}
                  <Link to="/student/profile" className="text-indigo-400">Edit profile →</Link>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
