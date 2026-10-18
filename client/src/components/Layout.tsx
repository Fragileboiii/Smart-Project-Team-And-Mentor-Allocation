import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, UserCircle,
  LogOut, Brain, BarChart3, Activity, Shield, ChevronRight, Menu, X
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

interface NavItem { label: string; to: string; icon: React.ReactNode; }

const studentNav: NavItem[] = [
  { label: 'Dashboard',  to: '/student',          icon: <LayoutDashboard size={18} /> },
  { label: 'My Team',    to: '/student/teams',     icon: <Users size={18} /> },
  { label: 'Mentors',    to: '/student/mentors',   icon: <BookOpen size={18} /> },
  { label: 'Requests',   to: '/student/requests',  icon: <ClipboardList size={18} /> },
  { label: 'Profile',    to: '/student/profile',   icon: <UserCircle size={18} /> },
];

const mentorNav: NavItem[] = [
  { label: 'Dashboard', to: '/mentor', icon: <LayoutDashboard size={18} /> },
];

const adminNav: NavItem[] = [
  { label: 'Overview',   to: '/admin',            icon: <LayoutDashboard size={18} /> },
  { label: 'Scheduler',  to: '/admin/scheduler',  icon: <Activity size={18} /> },
  { label: 'OS Monitor', to: '/admin/monitor',    icon: <Shield size={18} /> },
  { label: 'Banker\'s',  to: '/admin/bankers',    icon: <Brain size={18} /> },
  { label: 'Analytics',  to: '/admin/analytics',  icon: <BarChart3 size={18} /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const nav = user?.role === 'admin' ? adminNav : user?.role === 'mentor' ? mentorNav : studentNav;

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex h-screen overflow-hidden bg-navy-900">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-navy-800 border-r border-navy-700 transition-all duration-200',
        sidebarOpen ? 'w-56' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-navy-700">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">S</div>
          {sidebarOpen && <span className="font-semibold text-white text-sm">SmartAlloc</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(item => {
            const active = location.pathname === item.to || 
              (item.to !== '/student' && item.to !== '/mentor' && item.to !== '/admin' && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to}
                className={clsx(
                  'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-1 transition-colors text-sm',
                  active ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-navy-700'
                )}>
                <span className="flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-navy-700">
          {sidebarOpen && (
            <div className="mb-2 px-2">
              <p className="text-xs text-white font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-rose-400 px-2 py-2 rounded-lg hover:bg-navy-700 transition-colors w-full text-sm">
            <LogOut size={16} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-navy-800 border-b border-navy-700 flex items-center px-4 gap-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(v => !v)} className="text-slate-400 hover:text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-1 text-slate-500 text-sm">
            {nav.find(n => location.pathname.startsWith(n.to))?.label}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge bg-indigo-500/20 text-indigo-300 capitalize">{user?.role}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
