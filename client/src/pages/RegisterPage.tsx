import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    role: 'student', email: '', password: '', firstName: '', lastName: '',
    rollNumber: '', department: 'CSE', semester: '5',
    employeeId: '', designation: '', maxCapacity: '3',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(form);
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center font-bold text-white text-lg mx-auto mb-3">S</div>
          <h1 className="text-xl font-semibold text-white">Create Account</h1>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">First Name</label>
                <input className="input" placeholder="Aditya" value={form.firstName} onChange={set('firstName')} required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Last Name</label>
                <input className="input" placeholder="Bisht" value={form.lastName} onChange={set('lastName')} required />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input type="email" className="input" placeholder="you@smartalloc.edu" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input type="password" className="input" placeholder="Min 8 chars" value={form.password} onChange={set('password')} required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role</label>
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="student">Student</option>
                <option value="mentor">Mentor</option>
              </select>
            </div>

            {form.role === 'student' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Roll Number</label>
                    <input className="input" placeholder="24021285" value={form.rollNumber} onChange={set('rollNumber')} required />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Semester</label>
                    <input type="number" className="input" min="1" max="8" value={form.semester} onChange={set('semester')} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Department</label>
                  <input className="input" placeholder="CSE" value={form.department} onChange={set('department')} required />
                </div>
              </>
            )}

            {form.role === 'mentor' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Employee ID</label>
                    <input className="input" placeholder="EMP001" value={form.employeeId} onChange={set('employeeId')} required />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Max Capacity</label>
                    <input type="number" className="input" min="1" max="10" value={form.maxCapacity} onChange={set('maxCapacity')} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Designation</label>
                  <input className="input" placeholder="Assistant Professor" value={form.designation} onChange={set('designation')} required />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Department</label>
                  <input className="input" placeholder="CSE" value={form.department} onChange={set('department')} required />
                </div>
              </>
            )}

            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-xs text-slate-500 mt-4">
            Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
