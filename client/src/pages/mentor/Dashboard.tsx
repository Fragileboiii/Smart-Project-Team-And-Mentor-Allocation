import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { mentorApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import { Users, Activity, ToggleLeft, ToggleRight, Save, UserX, Info, AlertTriangle } from 'lucide-react';

export default function MentorDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ bio: '', maxCapacity: 3, isAvailable: true, domain: '' });
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Reject modal state
  const [rejectingTeam, setRejectingTeam] = useState<any | null>(null);
  const [rejectionComments, setRejectionComments] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  function loadProfile() {
    mentorApi.getMe().then(r => {
      setProfile(r.data);
      setForm({
        bio: r.data.bio || '',
        maxCapacity: r.data.max_capacity,
        isAvailable: r.data.is_available,
        domain: r.data.domain || '',
      });
    }).catch(() => {});
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function save() {
    try {
      await mentorApi.update(profile.id, form);
      setMsg({ type: 'ok', text: 'Profile updated' });
      loadProfile();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    }
  }

  async function handleRejectTeam() {
    if (!rejectingTeam || !rejectionComments.trim()) return;
    setRejectLoading(true);
    try {
      await mentorApi.rejectTeam(rejectingTeam.allocation_id, rejectionComments);
      setMsg({ type: 'ok', text: `Team "${rejectingTeam.name}" rejected. Feedback delivered to the team.` });
      setRejectingTeam(null);
      setRejectionComments('');
      loadProfile();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed to reject team' });
    } finally {
      setRejectLoading(false);
    }
  }

  if (!profile) return <Layout><p className="text-slate-400 p-4">Loading...</p></Layout>;

  const usedPct = Math.round((Number(profile.active_allocations) / profile.max_capacity) * 100);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{profile.first_name} {profile.last_name}</h1>
            {profile.domain && (
              <span className="badge bg-indigo-500/20 text-indigo-300 text-xs">
                Domain: {profile.domain}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">{profile.designation} · {profile.department}</p>
        </div>

        {/* First-Come Allotment Notice */}
        <div className="card border-indigo-500/30 flex items-start gap-3 bg-indigo-950/20">
          <Info size={18} className="text-indigo-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-indigo-200">System-Governed First-Come Allotment (FCFS)</p>
            <p className="text-slate-400">
              Teams are automatically allotted on a First-Come, First-Served basis according to matching domain.
              Mentors cannot manually pick or select teams. However, mentors can review allocated teams and reject
              them with constructive improvement feedback before they reapply.
            </p>
          </div>
        </div>

        {msg && (
          <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {msg.text}
          </div>
        )}

        {/* Capacity widget */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Max Capacity', value: profile.max_capacity, color: 'text-white' },
            { label: 'Active Teams', value: profile.active_allocations, color: 'text-indigo-400' },
            { label: 'Remaining Slots', value: profile.remaining_capacity, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Capacity bar */}
        <div className="card">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-slate-400">Workload</span>
            <span className="text-white font-medium">{usedPct}%</span>
          </div>
          <div className="h-3 bg-navy-700 rounded-full">
            <div className="h-3 rounded-full transition-all duration-500"
              style={{
                width: `${usedPct}%`,
                backgroundColor: usedPct > 80 ? '#f43f5e' : usedPct > 50 ? '#f59e0b' : '#34d399'
              }} />
          </div>
        </div>

        {/* Skills */}
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Expertise & Skills</h2>
          <div className="flex flex-wrap gap-2">
            {(profile.skills || []).map((s: any) => (
              <span key={s.name} className="badge bg-indigo-500/20 text-indigo-300">{s.name}</span>
            ))}
            {!profile.skills?.length && <p className="text-slate-500 text-sm">No skills listed</p>}
          </div>
        </div>

        {/* Assigned teams */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-400" />
              <h2 className="font-semibold text-white">Assigned Teams</h2>
            </div>
            <span className="text-xs text-slate-400">
              {(profile.assignedTeams || []).length} / {profile.max_capacity} Slots Filled
            </span>
          </div>

          {(profile.assignedTeams || []).length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No teams allocated yet. Teams will be alloted on a first-come basis.</p>
          ) : (
            <div className="space-y-3">
              {profile.assignedTeams.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between bg-navy-700/80 rounded-lg p-3 border border-navy-600">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white font-medium">{t.name}</p>
                      {t.project_domain && (
                        <span className="badge bg-navy-800 text-indigo-300 text-xs">
                          {t.project_domain}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">Topic: {t.project_topic || 'Not specified'}</p>
                    <p className="text-xs text-slate-500">Allocated: {new Date(t.allocated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={t.alloc_status} />
                    <button
                      onClick={() => setRejectingTeam(t)}
                      className="px-2.5 py-1 text-xs text-rose-400 hover:text-white hover:bg-rose-500/30 border border-rose-500/40 rounded-lg flex items-center gap-1 transition-colors"
                      title="Reject team with feedback on what improvements to make">
                      <UserX size={13} />
                      Reject Team
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reject Team Modal */}
        {rejectingTeam && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="card max-w-lg w-full bg-navy-800 border-rose-500/30 space-y-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Reject Team Allocation</h3>
                  <p className="text-xs text-slate-400">
                    Team: <span className="text-indigo-300 font-medium">{rejectingTeam.name}</span> · Domain: <span className="text-slate-300">{rejectingTeam.project_domain || 'General'}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  What improvements should the team make before reapplying? <span className="text-rose-400">*</span>
                </label>
                <textarea
                  className="input h-28 resize-none text-sm"
                  placeholder="e.g. Please refine your system architecture diagram, specify the database schema, and demonstrate a working prototype of module A before reapplying..."
                  value={rejectionComments}
                  onChange={e => setRejectionComments(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-slate-500">
                  This comment is delivered directly to the team so they know how to improve before requesting again.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-navy-700">
                <button
                  type="button"
                  onClick={() => { setRejectingTeam(null); setRejectionComments(''); }}
                  className="btn-secondary text-sm"
                  disabled={rejectLoading}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectTeam}
                  disabled={rejectLoading || rejectionComments.trim().length < 5}
                  className="btn-danger text-sm flex items-center gap-1.5 disabled:opacity-40">
                  <UserX size={14} />
                  {rejectLoading ? 'Submitting...' : 'Reject Team with Feedback'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit profile settings */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-cyan-400" />
            <h2 className="font-semibold text-white">Settings</h2>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Domain</label>
            <input className="input" placeholder="Primary Domain (e.g. OS/DBMS, Machine Learning, Cybersecurity)" value={form.domain}
              onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Bio</label>
            <textarea className="input h-16 resize-none" value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max Capacity</label>
              <input type="number" min="1" max="10" className="input"
                value={form.maxCapacity} onChange={e => setForm(f => ({ ...f, maxCapacity: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Availability</label>
              <button onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
                className="flex items-center gap-2 text-sm mt-1">
                {form.isAvailable
                  ? <><ToggleRight size={24} className="text-emerald-400" /><span className="text-emerald-400">Available</span></>
                  : <><ToggleLeft size={24} className="text-slate-500" /><span className="text-slate-500">Unavailable</span></>
                }
              </button>
            </div>
          </div>
          <button onClick={save} className="btn-primary flex items-center gap-2 text-sm">
            <Save size={14} /> Save Changes
          </button>
        </div>
      </div>
    </Layout>
  );
}
