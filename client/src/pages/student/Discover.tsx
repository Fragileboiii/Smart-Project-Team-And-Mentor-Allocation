import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import SwipeCard, { SwipeCardHandle } from '../../components/SwipeCard';
import { studentApi, teamApi } from '../../services/api';
import { Student } from '../../types';
import { Heart, X, Users, Sparkles, Loader2 } from 'lucide-react';

export default function StudentDiscover() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<SwipeCardHandle>(null);

  function load() {
    setLoading(true);
    Promise.all([studentApi.discover(), teamApi.mine()])
      .then(([s, t]) => {
        setStudents(s.data);
        setMyTeam(t.data);
        setMsg(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSwipe(dir: 'left' | 'right') {
    const current = students[0];
    if (!current) return;
    setStudents(prev => prev.slice(1));
    if (dir === 'left') return;
    setBusy(true);
    try {
      if (!myTeam) {
        setMsg({ type: 'err', text: 'You need a team first — create one or use Auto-Match.' });
      } else {
        await teamApi.invite(myTeam.id, { inviteeId: current.id, message: 'Team-up request from Discover' });
        setMsg({ type: 'ok', text: `Team invite sent to ${current.first_name} ${current.last_name}!` });
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Could not send invite' });
    } finally {
      setBusy(false);
    }
  }

  function swipeButton(dir: 'left' | 'right') {
    cardRef.current?.swipe(dir);
  }

  const current = students[0];
  const next = students[1];

  return (
    <Layout>
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Heart size={20} className="text-rose-400" /> Discover Teammates
            </h1>
            <p className="text-xs text-slate-400">Swipe right to invite to your team · left to skip</p>
          </div>
          <span className="badge bg-navy-700 text-slate-300">{students.length} left</span>
        </div>

        {myTeam ? (
          <div className="text-xs text-slate-400">
            Inviting to: <span className="text-indigo-300 font-medium">{myTeam.name}</span> ({myTeam.member_count}/4)
          </div>
        ) : (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300 flex items-center justify-between">
            <span>No team yet — create one or Auto-Match to start inviting.</span>
            <Link to="/student/teams" className="underline whitespace-nowrap">Teams →</Link>
          </div>
        )}

        {msg && (
          <div className={`rounded-lg px-3 py-2 text-xs ${msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-slate-500" size={28} /></div>
        ) : !current ? (
          <div className="card text-center py-16">
            <Users size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No more profiles to browse.</p>
            <Link to="/student/teams" className="btn-primary text-sm mt-4 inline-block">Go to Teams</Link>
          </div>
        ) : (
          <>
            <div className="relative h-[34rem]">
              {next && <SwipeCard key={next.id} student={next} onSwipe={() => {}} active={false} />}
              <SwipeCard key={current.id} ref={cardRef} student={current} onSwipe={handleSwipe} active />
            </div>
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => swipeButton('left')}
                disabled={busy}
                className="w-14 h-14 rounded-full bg-navy-700 border border-navy-600 text-slate-300 hover:text-rose-400 hover:border-rose-400 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X size={26} />
              </button>
              <button
                onClick={() => swipeButton('right')}
                disabled={busy || !myTeam}
                title={myTeam ? 'Invite to your team' : 'Create a team first'}
                className="w-16 h-16 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/30"
              >
                <Heart size={28} fill="currentColor" />
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <Sparkles size={11} /> Shown students are not yet in a team this cycle
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
