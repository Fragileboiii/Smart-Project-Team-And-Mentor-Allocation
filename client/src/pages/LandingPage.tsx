import { Link } from 'react-router-dom';
import { Brain, Users, Shield, BarChart3, ArrowRight, Lock, Zap, Database } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-navy-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white">S</div>
          <span className="font-semibold text-white">SmartAlloc</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-slate-400 hover:text-white text-sm transition-colors">Sign In</Link>
          <Link to="/register" className="btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 py-24 max-w-5xl mx-auto text-center">
        <div className="badge bg-indigo-500/20 text-indigo-300 mb-6">Academic Resource Allocation System</div>
        <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
          Smart Project, Team<br />&amp; Mentor Allocation
        </h1>
        <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
          A database-backed platform where students form teams and request mentors, while an OS-inspired
          allocation engine — mutual exclusion, request queues, Banker's algorithm — guarantees fair,
          deadlock-free assignments.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/register" className="btn-primary flex items-center gap-2">
            Get Started <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn-secondary">Sign In</Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <Users size={24} className="text-indigo-400" />, title: 'Team Formation', desc: 'Students browse profiles, form teams, send invites, and track membership with size validation.' },
            { icon: <Brain size={24} className="text-cyan-400" />, title: 'Banker\'s Algorithm', desc: 'Interactive deadlock-avoidance simulator with safety sequence, step-by-step state changes.' },
            { icon: <Lock size={24} className="text-amber-400" />, title: 'Mutex / Semaphore', desc: 'Row-level DB locks + in-process mutex prevent concurrent over-allocation of mentor slots.' },
            { icon: <Zap size={24} className="text-emerald-400" />, title: 'Priority Scheduling', desc: 'FCFS and priority-based request queues with aging to prevent starvation.' },
            { icon: <Shield size={24} className="text-rose-400" />, title: 'OS Monitor', desc: 'Live view of request states, resource locks, allocation graph, and system safety.' },
            { icon: <Database size={24} className="text-indigo-400" />, title: 'ACID Transactions', desc: 'Normalized 3NF schema, parameterized queries, explicit transactions with rollback.' },
            { icon: <Users size={24} className="text-cyan-400" />, title: '3 Role Dashboards', desc: 'Separate views and API authorization for students, mentors, and administrators.' },
            { icon: <BarChart3 size={24} className="text-emerald-400" />, title: 'Analytics', desc: 'Workload distribution, scheduler throughput, wait times, and audit trail.' },
          ].map(f => (
            <div key={f.title} className="card hover:border-navy-600 transition-colors">
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* OS Concepts Preview */}
      <section className="px-8 py-16 max-w-5xl mx-auto">
        <div className="card border-indigo-500/30">
          <h2 className="text-xl font-semibold text-white mb-4">OS Resource Allocation Preview</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Available Slots', value: '7', color: 'text-emerald-400' },
              { label: 'Allocated', value: '8', color: 'text-indigo-400' },
              { label: 'Queued Requests', value: '3', color: 'text-amber-400' },
            ].map(r => (
              <div key={r.label} className="bg-navy-700 rounded-lg p-4 text-center">
                <div className={`text-2xl font-bold ${r.color}`}>{r.value}</div>
                <div className="text-slate-400 text-xs mt-1">{r.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Mentor supervision slots are treated as finite resources. Concurrent requests go through a mutex-protected
            critical section backed by <code className="text-indigo-300">SELECT ... FOR UPDATE</code> transactions.
          </p>
        </div>
      </section>

      {/* Demo credentials */}
      <section className="px-8 pb-16 max-w-5xl mx-auto">
        <div className="card border-emerald-500/20">
          <h3 className="font-semibold text-white mb-3">Demo Credentials</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {[
              { role: 'Admin',   email: 'admin@smartalloc.edu',        pw: 'Admin@123' },
              { role: 'Mentor',  email: 'priya.sharma@smartalloc.edu', pw: 'Mentor@123' },
              { role: 'Student', email: 'aditya.bisht@smartalloc.edu', pw: 'Student@123' },
            ].map(c => (
              <div key={c.role} className="bg-navy-700 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">{c.role}</div>
                <div className="text-slate-300 font-mono text-xs">{c.email}</div>
                <div className="text-slate-400 font-mono text-xs">{c.pw}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-navy-700 px-8 py-6 text-center text-xs text-slate-600">
        SmartAlloc — BTECH CSE & ID | OSDBMS-V-2026-T084 | Team: The Incredibles
      </footer>
    </div>
  );
}
