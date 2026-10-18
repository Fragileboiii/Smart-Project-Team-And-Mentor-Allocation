import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  register: (d: any) => api.post('/auth/register', d),
  login: (d: any) => api.post('/auth/login', d),
  me: () => api.get('/auth/me'),
};

// Students
export const studentApi = {
  list: () => api.get('/students'),
  get: (id: string) => api.get(`/students/${id}`),
  getMe: () => api.get('/students/me'),
  update: (id: string, d: any) => api.put(`/students/${id}`, d),
};

// Mentors
export const mentorApi = {
  list: () => api.get('/mentors'),
  get: (id: string) => api.get(`/mentors/${id}`),
  getMe: () => api.get('/mentors/me'),
  update: (id: string, d: any) => api.put(`/mentors/${id}`, d),
  availability: (id: string) => api.get(`/mentors/${id}/availability`),
  matchScore: (teamId: string) => api.get(`/mentors/match?teamId=${teamId}`),
  rejectTeam: (allocationId: string, comments: string) => api.post(`/allocations/${allocationId}/reject`, { comments }),
};

// Teams
export const teamApi = {
  list: (cycleId?: string) => api.get('/teams' + (cycleId ? `?cycleId=${cycleId}` : '')),
  get: (id: string) => api.get(`/teams/${id}`),
  getCooldown: (teamId: string) => api.get(`/teams/${teamId}/cooldown`),
  create: (d: any) => api.post('/teams', d),
  invite: (id: string, d: any) => api.post(`/teams/${id}/invitations`, d),
  joinRequest: (id: string) => api.post(`/teams/${id}/join-requests`),
  respondInvitation: (id: string, accept: boolean) => api.post(`/invitations/${id}/respond`, { accept }),
};

// Mentor requests
export const requestApi = {
  create: (d: any) => api.post('/mentor-requests', d),
  list: (params?: any) => api.get('/mentor-requests', { params }),
  get: (id: string) => api.get(`/mentor-requests/${id}`),
  cancel: (id: string) => api.post(`/mentor-requests/${id}/cancel`),
  reject: (id: string, comments: string) => api.post(`/mentor-requests/${id}/reject`, { comments }),
};

// Allocations
export const allocationApi = {
  list: () => api.get('/allocations'),
  cancel: (id: string) => api.post(`/allocations/${id}/cancel`),
  reject: (id: string, comments: string) => api.post(`/allocations/${id}/reject`, { comments }),
};

// Scheduler
export const schedulerApi = {
  queue: () => api.get('/scheduler/queue'),
  run: (algorithm: string) => api.post('/scheduler/run', { algorithm }),
  metrics: () => api.get('/scheduler/metrics'),
  events: (limit = 50) => api.get(`/scheduler/events?limit=${limit}`),
};

// OS
export const osApi = {
  resources: () => api.get('/os/resources'),
  processes: () => api.get('/os/processes'),
  locks: () => api.get('/os/locks'),
  runSimulation: () => api.post('/os/simulation/run'),
  checkSafety: (state: any) => api.post('/os/bankers/check-safety', state),
  simulateRequest: (d: any) => api.post('/os/bankers/simulate-request', d),
  deadlockGraph: () => api.get('/os/deadlock-graph'),
};

// Admin
export const adminApi = {
  analytics: () => api.get('/admin/analytics'),
  auditLogs: (page = 1) => api.get(`/admin/audit-logs?page=${page}`),
  settings: () => api.get('/admin/settings'),
  updateSettings: (d: any) => api.put('/admin/settings', d),
  users: () => api.get('/admin/users'),
};

// Misc
export const skillsApi = { list: () => api.get('/skills') };
export const cyclesApi = { list: () => api.get('/cycles') };
