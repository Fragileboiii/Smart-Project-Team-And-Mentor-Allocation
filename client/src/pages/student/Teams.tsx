import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { teamApi } from '../../services/api';
import { Team } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import { Plus, Users } from 'lucide-react';

export default function StudentTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', projectTopic: '', projectDomain: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    teamApi.list().then(r => setTeams(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await teamApi.create(form);
      setSuccess('Team created!');
      setShowCreate(false);
      teamApi.list().then(r => setTeams(r.data));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create team');
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Teams</h1>
          <button onClick={() => setShowCreate(v => !v)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Create Team
          </button>
        </div>

        {success && <div className="bg-emerald-500/20 text-emerald-400 rounded-lg px-4 py-2 text-sm">{success}</div>}

        {showCreate && (
          <div className="card">
            <h2 className="font-semibold text-white mb-4">New Team</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input className="input" placeholder="Team name *" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <input className="input" placeholder="Description" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <input className="input" placeholder="Project topic" value={form.projectTopic}
                onChange={e => setForm(f => ({ ...f, projectTopic: e.target.value }))} />
              <input className="input" placeholder="Project domain (e.g. OS/DBMS, ML)" value={form.projectDomain}
                onChange={e => setForm(f => ({ ...f, projectDomain: e.target.value }))} />
              {error && <p className="text-rose-400 text-xs">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary text-sm">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : teams.length === 0 ? (
          <div className="card text-center py-12">
            <Users size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No teams found. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map(team => (
              <div key={team.id} className="card hover:border-navy-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{team.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{team.project_topic || 'No topic'}</p>
                    {team.project_domain && (
                      <span className="badge bg-navy-700 text-slate-400 mt-2">{team.project_domain}</span>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <StatusBadge status={team.status} />
                    <p className="text-xs text-slate-500">{team.member_count} / 4 members</p>
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
