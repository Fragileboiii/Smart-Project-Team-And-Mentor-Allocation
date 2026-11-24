import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { cyclesApi, adminApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import { Plus, RefreshCw, CheckCircle, Circle } from 'lucide-react';

interface Cycle {
  id: string;
  name: string;
  semester: string;
  year: number;
  min_team_size: number;
  max_team_size: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminCycles() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', semester: 'Odd', year: new Date().getFullYear(), minTeamSize: 2, maxTeamSize: 4, isActive: false });
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    cyclesApi.list().then(r => setCycles(r.data)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await adminApi.createCycle(form);
      setMsg({ type: 'ok', text: 'Cycle created' });
      setShowCreate(false);
      setForm({ name: '', semester: 'Odd', year: new Date().getFullYear(), minTeamSize: 2, maxTeamSize: 4, isActive: false });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    } finally { setBusy(false); }
  }

  async function setActive(id: string) {
    setBusy(true); setMsg(null);
    try {
      await adminApi.updateCycle(id, { isActive: true });
      setMsg({ type: 'ok', text: 'Active cycle updated' });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    } finally { setBusy(false); }
  }

  async function closeCycle(id: string) {
    setBusy(true); setMsg(null);
    try {
      await adminApi.updateCycle(id, { isActive: false });
      setMsg({ type: 'ok', text: 'Cycle closed' });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    } finally { setBusy(false); }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-white">Project Cycles</h1>
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setShowCreate(v => !v)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> New Cycle
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">Create and manage project cycles. Only one cycle can be active at a time — activating a cycle automatically deactivates all others.</p>

        {msg && (
          <div className={'rounded-lg px-4 py-2 text-sm ' + (msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')}>
            {msg.text}
          </div>
        )}

        {showCreate && (
          <div className="card">
            <h2 className="font-semibold text-white mb-4">New Cycle</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name *</label>
                  <input className="input" placeholder="PBL Semester 5" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Year</label>
                  <input type="number" className="input" value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Semester</label>
                  <select className="input" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}>
                    <option>Odd</option>
                    <option>Even</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Team Size</label>
                  <input type="number" min="1" max="10" className="input" value={form.minTeamSize}
                    onChange={e => setForm(f => ({ ...f, minTeamSize: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Team Size</label>
                  <input type="number" min="1" max="10" className="input" value={form.maxTeamSize}
                    onChange={e => setForm(f => ({ ...f, maxTeamSize: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                <label htmlFor="isActive" className="text-xs text-slate-400">Set as active cycle immediately</label>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={busy} className="btn-primary text-sm">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : cycles.length === 0 ? (
          <div className="card text-center py-10"><p className="text-slate-400 text-sm">No cycles yet. Create one above.</p></div>
        ) : (
          <div className="space-y-3">
            {cycles.map(cy => (
              <div key={cy.id} className={'card ' + (cy.is_active ? 'border-emerald-500/40' : 'border-navy-700')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {cy.is_active
                        ? <CheckCircle size={16} className="text-emerald-400" />
                        : <Circle size={16} className="text-slate-500" />}
                      <span className="font-semibold text-white">{cy.name}</span>
                      {cy.is_active && <StatusBadge status="active" />}
                    </div>
                    <p className="text-xs text-slate-400">{cy.semester} {cy.year} | Team size {cy.min_team_size}-{cy.max_team_size}</p>
                    <p className="text-xs text-slate-500">Created {new Date(cy.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    {!cy.is_active && (
                      <button onClick={() => setActive(cy.id)} disabled={busy} className="btn-primary text-xs">
                        Set Active
                      </button>
                    )}
                    {cy.is_active && (
                      <button onClick={() => closeCycle(cy.id)} disabled={busy} className="btn-secondary text-xs">
                        Close Cycle
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