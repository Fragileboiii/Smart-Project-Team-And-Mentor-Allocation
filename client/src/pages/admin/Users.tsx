import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { adminApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import { RefreshCw, Pencil, Check, X, UserX, UserCheck } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '' });
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  function load() {
    setLoading(true);
    adminApi.users().then(r => setUsers(r.data)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function saveEdit(id: string) {
    setBusy(true); setMsg(null);
    try {
      await adminApi.updateUser(id, { firstName: editForm.firstName, lastName: editForm.lastName });
      setMsg({ type: 'ok', text: 'User updated' });
      setEditing(null);
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    } finally { setBusy(false); }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setBusy(true); setMsg(null);
    try {
      await adminApi.updateUser(id, { isActive: !isActive });
      setMsg({ type: 'ok', text: isActive ? 'User deactivated' : 'User reactivated' });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    } finally { setBusy(false); }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const textOk = (u.first_name + ' ' + u.last_name + ' ' + u.email).toLowerCase().includes(q);
    const roleOk = roleFilter === 'all' || u.role === roleFilter;
    return textOk && roleOk;
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-white">User Management</h1>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {msg && (
          <div className={'rounded-lg px-4 py-2 text-sm ' + (msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <input className="input flex-1 min-w-[200px] text-sm" placeholder="Search by name or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input w-32 text-sm" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-navy-700">
                  <th className="text-left pb-2 pr-3">Name</th>
                  <th className="text-left pb-2 pr-3">Email</th>
                  <th className="text-left pb-2 pr-3">Role</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-left pb-2 pr-3">Joined</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-t border-navy-700 hover:bg-navy-700/30">
                    <td className="py-2 pr-3">
                      {editing === u.id ? (
                        <div className="flex gap-1">
                          <input className="input text-xs w-20 py-0.5" value={editForm.firstName}
                            onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
                          <input className="input text-xs w-20 py-0.5" value={editForm.lastName}
                            onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
                        </div>
                      ) : (
                        <span className="text-slate-200">{u.first_name} {u.last_name}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-400 font-mono">{u.email}</td>
                    <td className="py-2 pr-3"><StatusBadge status={u.role} /></td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={u.is_active ? 'active' : 'cancelled'} />
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {editing === u.id ? (
                          <>
                            <button onClick={() => saveEdit(u.id)} disabled={busy} title="Save"
                              className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditing(null)} title="Cancel"
                              className="p-1 text-slate-400 hover:text-white transition-colors">
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => { setEditing(u.id); setEditForm({ firstName: u.first_name, lastName: u.last_name }); }}
                            disabled={busy} title="Edit name"
                            className="p-1 text-slate-400 hover:text-white transition-colors">
                            <Pencil size={14} />
                          </button>
                        )}
                        {u.id !== me?.id && (
                          <button onClick={() => toggleActive(u.id, u.is_active)} disabled={busy}
                            title={u.is_active ? 'Deactivate' : 'Reactivate'}
                            className={'p-1 transition-colors ' + (u.is_active ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300')}>
                            {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No users match your filter.</p>}
          </div>
        )}
      </div>
    </Layout>
  );
}