import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { mentorApi, teamApi, requestApi } from '../../services/api';
import { Mentor, Team } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import { Search, Send, Star, Clock, AlertTriangle, Zap, CheckCircle2, ShieldAlert } from 'lucide-react';

interface MatchResult {
  mentorId: string;
  name: string;
  domain?: string;
  score: number;
  available: boolean;
  remainingCapacity: number;
  breakdown: { skillOverlap: number; domainMatch: number; capacityFactor: number; matchedSkills: string[] };
}

// Client-side domain compatibility helper
function checkDomainMatch(teamDomain?: string, mentorDomain?: string, mentorCategories?: string[]): boolean {
  if (!teamDomain || !mentorDomain) return false;
  const a = teamDomain.trim().toLowerCase();
  const b = mentorDomain.trim().toLowerCase();
  if (a === b) return true;

  const tokensA = a.split(/[\s\/\-_,]+/).filter(t => t.length > 2);
  const tokensB = b.split(/[\s\/\-_,]+/).filter(t => t.length > 2);
  if (tokensA.some(t => tokensB.includes(t))) return true;

  const aliasGroups = [
    ['ml', 'machine learning', 'ai', 'artificial intelligence', 'deep learning'],
    ['os', 'dbms', 'operating systems', 'database', 'systems', 'os/dbms'],
    ['web', 'web development', 'frontend', 'backend', 'fullstack', 'full-stack'],
    ['cloud', 'devops', 'cloud computing', 'cloud/devops', 'kubernetes', 'docker'],
    ['security', 'cybersecurity', 'network security', 'cyber security', 'cryptography'],
    ['mobile', 'mobile computing', 'mobile development', 'android', 'ios', 'flutter', 'react native'],
    ['blockchain', 'blockchain/web3', 'web3', 'crypto', 'smart contracts'],
    ['data engineering', 'big data', 'data pipelines', 'data warehousing'],
  ];

  for (const group of aliasGroups) {
    const aMatch = group.some(e => a.includes(e) || e.includes(a));
    const bMatch = group.some(e => b.includes(e) || e.includes(b));
    if (aMatch && bMatch) return true;
  }

  if (mentorCategories && mentorCategories.length > 0) {
    for (const cat of mentorCategories) {
      if (checkDomainMatch(teamDomain, cat)) return true;
    }
  }

  return false;
}

export default function StudentMentors() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<'all' | 'matching'>('all');
  const [requesting, setRequesting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Cooldown state
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [lastRejectionFeedback, setLastRejectionFeedback] = useState<string | null>(null);

  function loadData() {
    mentorApi.list().then(r => setMentors(r.data));
    teamApi.list().then(r => {
      if (r.data[0]) {
        const team = r.data[0];
        setMyTeam(team);
        mentorApi.matchScore(team.id).then(mr => setMatches(mr.data)).catch(() => {});
        // Check cooldown
        teamApi.getCooldown(team.id).then(cr => {
          if (cr.data.cooldownActive && cr.data.remainingSeconds > 0) {
            setCooldownRemaining(cr.data.remainingSeconds);
            if (cr.data.rejectionComments) {
              setLastRejectionFeedback(cr.data.rejectionComments);
            }
          }
        }).catch(() => {});
      }
    });
  }

  useEffect(() => {
    loadData();
  }, []);

  // Live countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  async function requestMentor(mentorId: string) {
    if (!myTeam) { setMsg({ type: 'err', text: 'Join a team first' }); return; }
    setRequesting(mentorId);
    try {
      const res = await requestApi.create({ teamId: myTeam.id, mentorId, message: 'Mentor request from team' });
      setMsg({
        type: 'ok',
        text: res.data.message || 'Mentor request submitted — alloted on first-come basis!'
      });
      loadData();
    } catch (e: any) {
      if (e.response?.status === 429 && e.response?.data?.remainingSeconds) {
        setCooldownRemaining(e.response.data.remainingSeconds);
      }
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    } finally {
      setRequesting(null);
    }
  }

  const matchMap = new Map(matches.map(m => [m.mentorId, m]));

  const filtered = mentors
    .filter(m => {
      const q = search.toLowerCase();
      const textMatch = `${m.first_name} ${m.last_name} ${m.department} ${m.designation} ${m.domain || ''}`
        .toLowerCase().includes(q);
      if (!textMatch) return false;

      if (domainFilter === 'matching' && myTeam?.project_domain) {
        const isMatch = checkDomainMatch(myTeam.project_domain, m.domain);
        if (!isMatch) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Prioritize mentors with matching domains
      if (myTeam?.project_domain) {
        const aMatch = checkDomainMatch(myTeam.project_domain, a.domain);
        const bMatch = checkDomainMatch(myTeam.project_domain, b.domain);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      return 0;
    });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-white">Mentor Directory</h1>
            <p className="text-xs text-slate-400">Allotted on First-Come, First-Served basis for matching domains</p>
          </div>
          {myTeam && (
            <div className="text-right">
              <span className="text-xs text-slate-400">Team: <span className="text-indigo-300 font-medium">{myTeam.name}</span></span>
              {myTeam.project_domain && (
                <div className="text-xs text-slate-400">
                  Domain: <span className="text-emerald-400 font-semibold">{myTeam.project_domain}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cooldown Active Banner */}
        {cooldownRemaining > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2 text-sm animate-pulse">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <Clock size={18} />
              <span>Request Cooldown Active</span>
              <span className="ml-auto font-mono text-base bg-amber-500/20 px-2.5 py-0.5 rounded border border-amber-500/30">
                {Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s
              </span>
            </div>
            <p className="text-xs text-amber-200/80">
              Teams must wait for the cooldown to expire before submitting another mentor request.
            </p>
            {lastRejectionFeedback && (
              <div className="mt-2 p-2 rounded bg-navy-900/60 border border-amber-500/20 text-xs text-slate-300">
                <span className="font-semibold text-amber-300">Previous Mentor Feedback: </span>
                <span>{lastRejectionFeedback}</span>
              </div>
            )}
          </div>
        )}

        {msg && (
          <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
            {msg.text}
          </div>
        )}

        {/* Policy Explainer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card border-indigo-500/30 bg-indigo-950/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Zap size={14} />
              <span>First-Come, First-Served Allotment</span>
            </div>
            <p className="text-xs text-slate-400">
              Mentors cannot pick and choose teams. When a team submits a request, available slots are allotted immediately on a first-come basis.
            </p>
          </div>

          <div className="card border-emerald-500/30 bg-emerald-950/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <CheckCircle2 size={14} />
              <span>Domain Priority & Requirements</span>
            </div>
            <p className="text-xs text-slate-400">
              Mentors and teams must share the same project domain. Teams with matching domains have highest priority in queueing and allocation.
            </p>
          </div>
        </div>

        {/* Search & Domain Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9 text-sm" placeholder="Search mentors by name, department, or domain..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          {myTeam?.project_domain && (
            <button
              onClick={() => setDomainFilter(f => f === 'all' ? 'matching' : 'all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                domainFilter === 'matching'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-navy-800 border-navy-700 text-slate-400 hover:text-white'
              }`}>
              <CheckCircle2 size={14} />
              {domainFilter === 'matching' ? `Filtered: ${myTeam.project_domain}` : 'Filter Same Domain'}
            </button>
          )}
        </div>

        {/* Mentor Cards */}
        <div className="space-y-3">
          {filtered.map(mentor => {
            const match = matchMap.get(mentor.id);
            const scorePercent = match ? Math.round(match.score * 100) : null;
            const isDomainMatch = myTeam?.project_domain
              ? checkDomainMatch(myTeam.project_domain, mentor.domain, (mentor.skills || []).map(s => s.category))
              : true;

            return (
              <div
                key={mentor.id}
                className={`card transition-colors ${
                  isDomainMatch ? 'hover:border-indigo-500/40 border-navy-700' : 'opacity-85 border-navy-800 bg-navy-900/60'
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{mentor.first_name} {mentor.last_name}</h3>
                      {mentor.domain && (
                        <span className="badge bg-indigo-500/20 text-indigo-300 text-xs font-medium">
                          Domain: {mentor.domain}
                        </span>
                      )}
                      {!mentor.is_available && <StatusBadge status="unavailable" />}
                    </div>

                    <p className="text-xs text-slate-400">{mentor.designation} · {mentor.department}</p>
                    {mentor.bio && <p className="text-xs text-slate-400 line-clamp-2">{mentor.bio}</p>}

                    {/* Domain match status pill */}
                    {myTeam?.project_domain && (
                      <div className="pt-1">
                        {isDomainMatch ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Same Domain ({mentor.domain || myTeam.project_domain})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            <ShieldAlert size={11} /> Domain Mismatch (Team: {myTeam.project_domain})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(mentor.skills || []).map((s: any) => (
                        <span key={s.name} className="badge bg-navy-700 text-slate-300 text-xs">{s.name}</span>
                      ))}
                    </div>

                    {/* Match breakdown */}
                    {match && (
                      <div className="mt-2 flex gap-3 text-xs text-slate-400">
                        <span>Skills: {Math.round(match.breakdown.skillOverlap * 100)}%</span>
                        <span>Domain Priority: {match.breakdown.domainMatch ? '✓ Top' : '✗ Lower'}</span>
                        <span>Matched: {match.breakdown.matchedSkills.join(', ') || 'none'}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right space-y-2 flex-shrink-0">
                    {/* Capacity bar */}
                    <div className="text-xs text-slate-400">
                      {Number(mentor.remaining_capacity)} / {mentor.max_capacity} slots
                    </div>
                    <div className="w-24 h-1.5 bg-navy-700 rounded-full">
                      <div className="h-1.5 rounded-full bg-emerald-400"
                        style={{ width: `${(Number(mentor.remaining_capacity) / mentor.max_capacity) * 100}%` }} />
                    </div>

                    {/* Compatibility score */}
                    {scorePercent !== null && (
                      <div className="flex items-center gap-1 justify-end">
                        <Star size={12} className="text-amber-400" />
                        <span className="text-xs font-medium text-amber-400">{scorePercent}% Match</span>
                      </div>
                    )}

                    <button
                      onClick={() => requestMentor(mentor.id)}
                      disabled={
                        requesting === mentor.id ||
                        Number(mentor.remaining_capacity) <= 0 ||
                        !mentor.is_available ||
                        cooldownRemaining > 0 ||
                        !isDomainMatch
                      }
                      title={
                        cooldownRemaining > 0
                          ? `Cooldown active (${cooldownRemaining}s remaining)`
                          : !isDomainMatch
                          ? `Domain mismatch: Mentor and team must have the same domain`
                          : Number(mentor.remaining_capacity) <= 0
                          ? 'Mentor currently at capacity'
                          : 'Request mentor allotment'
                      }
                      className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40 ml-auto">
                      <Send size={12} />
                      {requesting === mentor.id
                        ? 'Requesting...'
                        : cooldownRemaining > 0
                        ? `Cooldown (${cooldownRemaining}s)`
                        : !isDomainMatch
                        ? 'Domain Mismatch'
                        : 'Request (FCFS)'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-slate-400 text-sm">No mentors match your search criteria.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
