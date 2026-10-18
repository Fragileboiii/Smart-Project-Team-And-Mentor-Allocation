import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Student
import StudentDashboard from './pages/student/Dashboard';
import StudentTeams from './pages/student/Teams';
import StudentMentors from './pages/student/Mentors';
import StudentRequests from './pages/student/Requests';
import StudentProfile from './pages/student/Profile';

// Mentor
import MentorDashboard from './pages/mentor/Dashboard';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminScheduler from './pages/admin/Scheduler';
import AdminBankers from './pages/admin/Bankers';
import AdminMonitor from './pages/admin/Monitor';
import AdminAnalytics from './pages/admin/Analytics';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-slate-400">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'mentor') return <Navigate to="/mentor" replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

          {/* Student */}
          <Route path="/student" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/teams" element={<ProtectedRoute roles={['student']}><StudentTeams /></ProtectedRoute>} />
          <Route path="/student/mentors" element={<ProtectedRoute roles={['student']}><StudentMentors /></ProtectedRoute>} />
          <Route path="/student/requests" element={<ProtectedRoute roles={['student']}><StudentRequests /></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute roles={['student']}><StudentProfile /></ProtectedRoute>} />

          {/* Mentor */}
          <Route path="/mentor" element={<ProtectedRoute roles={['mentor']}><MentorDashboard /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/scheduler" element={<ProtectedRoute roles={['admin']}><AdminScheduler /></ProtectedRoute>} />
          <Route path="/admin/bankers" element={<ProtectedRoute roles={['admin']}><AdminBankers /></ProtectedRoute>} />
          <Route path="/admin/monitor" element={<ProtectedRoute roles={['admin']}><AdminMonitor /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']}><AdminAnalytics /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
