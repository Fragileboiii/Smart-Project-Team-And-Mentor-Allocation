import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { teamApi } from '../../services/api';
import { Inbox, Check, X, UserPlus, Mail } from 'lucide-react';

interface InvitationItem {
  id: string;
  team_id: string;
  team_name: string;
  project_topic?: string;
  project_domain?: string;
  message?: string;
  created_at: string;
  inviter_first: string;
  inviter_last: string;
  member_count: number;
  type: 'invite' | 'join_request';
}

export default function StudentInvitations() {
  const [items, setItems] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    setLoading(true);
    teamApi.myInvitations().then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function respond(id: string, accept: boolean) {
    setActing(id);
    setMsg(null);
    try {
      await teamApi.respondInvitation(id, accept);
      setMsg({ type: 'ok', text: accept ? 'Accepted!' : 'Rejected' });
      load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Action failed' });
    } finally {
      setActing(null);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Inbox size={22} className="text-indigo-400" />
          <h1 className="text-xl font-bold text-white">Invitations</h1>
        </div>

        <p className="text-xs text-slate-500">
          Team invitations sent to you, plus join requests from students who want to join your team.
          Accept or reject below.
        </p>

        {msg && (
          <div className={'rounded-lg px-4 py-2 text-sm ' + (msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : items.length === 0 ? (
          <div className="card text-center py-12">
            <Inbox size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">No pending invitations or join requests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(it => {
              const isJoin = it.type === 'join_request';
              return (
                <div key={it.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isJoin ? <UserPlus size={15} className="text-cyan-400" /> : <Mail size={15} className="text-indigo-400" />}
                        <span className="font-semibold text-white text-sm">{it.team_name}</span>
                        {it.project_domain && <span className="badge bg-indigo-500/20 text-indigo-300 text-xs">{it.project_domain}</span>}
                      </div>
                      <p className="text-xs text-slate-400">
                        {isJoin
                          ? (it.inviter_first + ' ' + it.inviter_last + ' wants to join your team')
                          : ('Invited by ' + it.inviter_first + ' ' + it.inviter_last)}
                      </p>
                      {it.project_topic && <p className="text-xs text-slate-500">Topic: {it.project_topic}</p>}
                      {it.message && <p className="text-xs text-slate-500 italic">{it.message}</p>}
                      <p className="text-xs text-slate-500">{it.member_count} / 4 members</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => respond(it.id, true)} disabled={acting === it.id}
                        className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                        <Check size={13} /> Accept
                      </button>
                      <button onClick={() => respond(it.id, false)} disabled={acting === it.id}
                        className="btn-secondary text-xs flex items-center gap-1 px-3 py-1.5">
                        <X size={13} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}