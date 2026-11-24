import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPw, setForgotNewPw] = useState('');
  const [forgotStep, setForgotStep] = useState<'email'|'reset'>('email');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotErr, setForgotErr] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function sendForgot(e: React.FormEvent) {
    e.preventDefault(); setForgotBusy(true); setForgotErr(''); setForgotMsg('');
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg('Check your email for the reset token.');
      setForgotStep('reset');
    } catch (err: any) { setForgotErr(err.response?.data?.error || 'Failed'); }
    finally { setForgotBusy(false); }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault(); setForgotBusy(true); setForgotErr(''); setForgotMsg('');
    try {
      await api.post('/auth/reset-password', { email: forgotEmail, token: forgotToken, newPassword: forgotNewPw });
      setForgotMsg('Password reset! You can now sign in.'); setShowForgot(false); setForgotStep('email');
    } catch (err: any) { setForgotErr(err.response?.data?.error || 'Failed'); }
    finally { setForgotBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center font-bold text-white text-lg mx-auto mb-3">S</div>
          <h1 className="text-xl font-semibold text-white">Sign in to SmartAlloc</h1>
          <p className="text-sm text-slate-400 mt-1">Smart allocation for every student</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input type="email" className="input" placeholder="you@smartalloc.edu"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input type="password" className="input" placeholder="••••••••"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-xs text-slate-500 mt-4">
            No account? <Link to="/register" className="text-indigo-400 hover:text-indigo-300">Register</Link>
          </p>
        </div>

        {/* Quick login helpers */}
        {showForgot && (
          <div className="mt-4 card space-y-3">
            <p className="text-sm font-semibold text-white">{forgotStep === 'email' ? 'Forgot Password' : 'Enter Reset Token'}</p>
            {forgotMsg && <p className="text-xs text-emerald-400">{forgotMsg}</p>}
            {forgotErr && <p className="text-xs text-rose-400">{forgotErr}</p>}
            {forgotStep === 'email' ? (
              <form onSubmit={sendForgot} className="space-y-2">
                <input type="email" className="input text-sm" placeholder="Your email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                <button type="submit" disabled={forgotBusy} className="btn-primary w-full text-sm">{forgotBusy ? 'Sending...' : 'Send Reset Token'}</button>
              </form>
            ) : (
              <form onSubmit={doReset} className="space-y-2">
                <input className="input text-sm" placeholder="Reset token from email" value={forgotToken} onChange={e => setForgotToken(e.target.value)} required />
                <input type="password" className="input text-sm" placeholder="New password (min 8 chars)" value={forgotNewPw} onChange={e => setForgotNewPw(e.target.value)} required />
                <button type="submit" disabled={forgotBusy} className="btn-primary w-full text-sm">{forgotBusy ? 'Resetting...' : 'Reset Password'}</button>
              </form>
            )}
            <button onClick={() => setShowForgot(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        )}
        <p className="text-center text-xs text-slate-500 mt-2">
          <button onClick={() => { setShowForgot(v => !v); setForgotStep('email'); setForgotMsg(''); setForgotErr(''); }} className="text-indigo-400 hover:text-indigo-300">Forgot password?</button>
        </p>
        <div className="mt-4 space-y-2">
          <p className="text-xs text-slate-600 text-center">Quick demo login:</p>
          {[
            { role: 'Admin',   email: 'admin@smartalloc.edu',        pw: 'Admin@123' },
            { role: 'Mentor',  email: 'priya.sharma@smartalloc.edu', pw: 'Mentor@123' },
            { role: 'Student', email: 'aditya.bisht@smartalloc.edu', pw: 'Student@123' },
          ].map(c => (
            <button key={c.role} onClick={() => { setForm({ email: c.email, password: c.pw }); }}
              className="w-full text-left bg-navy-800 hover:bg-navy-700 border border-navy-700 rounded-lg px-3 py-2 transition-colors">
              <span className="text-xs text-slate-400">{c.role}: </span>
              <span className="text-xs text-slate-300 font-mono">{c.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
