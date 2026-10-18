import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { studentApi, skillsApi } from '../../services/api';
import { UserCircle, Save } from 'lucide-react';

export default function StudentProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [form, setForm] = useState({ bio: '', cgpa: '', projectInterests: '' });
  const [selectedSkills, setSelectedSkills] = useState<{ skillId: string; proficiency: string }[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    studentApi.getMe().then(r => {
      setProfile(r.data);
      setForm({ bio: r.data.bio || '', cgpa: r.data.cgpa || '', projectInterests: r.data.project_interests || '' });
      // Skills from API return {name, category, proficiency} — match against allSkills by name after allSkills loads
      setSelectedSkills([]);
    });
    skillsApi.list().then(r => {
      setAllSkills(r.data);
      // Re-fetch profile after skills are loaded so we can map names to IDs
      studentApi.getMe().then(p => {
        const skillNames: string[] = (p.data.skills || []).map((s: any) => s.name);
        setSelectedSkills(
          r.data
            .filter((sk: any) => skillNames.includes(sk.name))
            .map((sk: any) => {
              const match = (p.data.skills || []).find((s: any) => s.name === sk.name);
              return { skillId: sk.id, proficiency: match?.proficiency || 'intermediate' };
            })
        );
      });
    });
  }, []);

  function toggleSkill(skillId: string) {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skillId === skillId);
      if (exists) return prev.filter(s => s.skillId !== skillId);
      return [...prev, { skillId, proficiency: 'intermediate' }];
    });
  }

  function setProficiency(skillId: string, proficiency: string) {
    setSelectedSkills(prev => prev.map(s => s.skillId === skillId ? { ...s, proficiency } : s));
  }

  async function save() {
    try {
      await studentApi.update(profile.id, { ...form, skills: selectedSkills });
      setMsg({ type: 'ok', text: 'Profile saved' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Failed' });
    }
  }

  if (!profile) return <Layout><p className="text-slate-400">Loading...</p></Layout>;

  const categories = [...new Set(allSkills.map(s => s.category))];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <UserCircle size={32} className="text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold text-white">{profile.first_name} {profile.last_name}</h1>
            <p className="text-xs text-slate-400">{profile.roll_number} · {profile.department} · Sem {profile.semester}</p>
          </div>
        </div>

        {msg && (
          <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {msg.text}
          </div>
        )}

        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Profile Details</h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Bio</label>
            <textarea className="input h-20 resize-none" placeholder="Tell mentors about yourself..."
              value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">CGPA</label>
              <input type="number" step="0.01" min="0" max="10" className="input"
                value={form.cgpa} onChange={e => setForm(f => ({ ...f, cgpa: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Project Interests</label>
              <input className="input" placeholder="e.g. OS, ML, Web"
                value={form.projectInterests} onChange={e => setForm(f => ({ ...f, projectInterests: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Skills</h2>
          <p className="text-xs text-slate-500">These are used to compute your team's compatibility score with mentors.</p>
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs text-slate-500 mb-2 font-medium">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {allSkills.filter(s => s.category === cat).map(skill => {
                  const selected = selectedSkills.find(s => s.skillId === skill.id);
                  return (
                    <div key={skill.id} className="flex items-center gap-1">
                      <button
                        onClick={() => toggleSkill(skill.id)}
                        className={`badge cursor-pointer transition-colors ${selected ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50' : 'bg-navy-700 text-slate-400 hover:text-slate-300'}`}>
                        {skill.name}
                      </button>
                      {selected && (
                        <select
                          value={selected.proficiency}
                          onChange={e => setProficiency(skill.id, e.target.value)}
                          className="bg-navy-700 text-xs text-slate-300 border border-navy-600 rounded px-1 py-0.5">
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button onClick={save} className="btn-primary flex items-center gap-2">
          <Save size={16} /> Save Profile
        </button>
      </div>
    </Layout>
  );
}
