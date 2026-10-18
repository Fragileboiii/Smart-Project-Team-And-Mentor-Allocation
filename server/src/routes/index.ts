import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

import { register, login, me } from '../controllers/authController';
import { listStudents, getStudent, updateStudent, getMyProfile } from '../controllers/studentController';
import { listMentors, getMentor, getMentorAvailability, updateMentor, getMyMentorProfile, getMatchScore, rejectAssignedTeam } from '../controllers/mentorController';
import { listTeamsHandler, createTeam, getTeam, sendInvitation, respondToInvitation, sendJoinRequest } from '../controllers/teamController';
import { createMentorRequest, listMentorRequests, getMentorRequest, cancelMentorRequest, cancelAllocation, listAllocations, rejectMentorRequest, getTeamCooldown } from '../controllers/mentorRequestController';
import { getQueue, runSchedulerHandler, getMetrics, getEvents } from '../controllers/schedulerController';
import { getResources, getProcesses, getLocks, checkSafety, simulateBankersRequest, getDeadlockGraph, runSimulation, resetSimulation } from '../controllers/osController';
import { getAnalytics, getAuditLogs, updateSettings, getSettings, listAllUsers } from '../controllers/adminController';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authenticate, me);

// ── Students ──────────────────────────────────────────────────────────────────
router.get('/students', authenticate, listStudents);
router.get('/students/me', authenticate, requireRole('student'), getMyProfile);
router.get('/students/:id', authenticate, getStudent);
router.put('/students/:id', authenticate, requireRole('student', 'admin'), updateStudent);

// ── Mentors ───────────────────────────────────────────────────────────────────
router.get('/mentors', authenticate, listMentors);
router.get('/mentors/me', authenticate, requireRole('mentor'), getMyMentorProfile);
router.get('/mentors/match', authenticate, getMatchScore);
router.get('/mentors/:id', authenticate, getMentor);
router.get('/mentors/:id/availability', authenticate, getMentorAvailability);
router.put('/mentors/:id', authenticate, requireRole('mentor', 'admin'), updateMentor);

// ── Teams ─────────────────────────────────────────────────────────────────────
router.get('/teams', authenticate, listTeamsHandler);
router.post('/teams', authenticate, requireRole('student'), createTeam);
router.get('/teams/:id', authenticate, getTeam);
router.get('/teams/:teamId/cooldown', authenticate, getTeamCooldown);
router.post('/teams/:id/invitations', authenticate, requireRole('student'), sendInvitation);
router.post('/teams/:id/join-requests', authenticate, requireRole('student'), sendJoinRequest);
router.post('/invitations/:id/respond', authenticate, requireRole('student'), respondToInvitation);

// ── Mentor Requests ───────────────────────────────────────────────────────────
router.post('/mentor-requests', authenticate, requireRole('student'), createMentorRequest);
router.get('/mentor-requests', authenticate, listMentorRequests);
router.get('/mentor-requests/:id', authenticate, getMentorRequest);
router.post('/mentor-requests/:id/cancel', authenticate, cancelMentorRequest);
router.post('/mentor-requests/:id/reject', authenticate, requireRole('mentor', 'admin'), rejectMentorRequest);
router.get('/allocations', authenticate, listAllocations);
router.post('/allocations/:id/cancel', authenticate, cancelAllocation);
router.post('/allocations/:id/reject', authenticate, requireRole('mentor', 'admin'), rejectAssignedTeam);

// ── Scheduler ─────────────────────────────────────────────────────────────────
router.get('/scheduler/queue', authenticate, getQueue);
router.post('/scheduler/run', authenticate, requireRole('admin'), runSchedulerHandler);
router.get('/scheduler/metrics', authenticate, getMetrics);
router.get('/scheduler/events', authenticate, getEvents);

// ── OS Simulation ─────────────────────────────────────────────────────────────
router.get('/os/resources', authenticate, getResources);
router.get('/os/processes', authenticate, getProcesses);
router.get('/os/locks', authenticate, getLocks);
router.post('/os/simulation/run', authenticate, requireRole('admin'), runSimulation);
router.post('/os/simulation/reset', authenticate, requireRole('admin'), resetSimulation);
router.post('/os/bankers/check-safety', authenticate, checkSafety);
router.post('/os/bankers/simulate-request', authenticate, simulateBankersRequest);
router.get('/os/deadlock-graph', authenticate, getDeadlockGraph);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/analytics', authenticate, requireRole('admin'), getAnalytics);
router.get('/admin/audit-logs', authenticate, requireRole('admin'), getAuditLogs);
router.get('/admin/settings', authenticate, requireRole('admin'), getSettings);
router.put('/admin/settings', authenticate, requireRole('admin'), updateSettings);
router.get('/admin/users', authenticate, requireRole('admin'), listAllUsers);

// ── Skills ────────────────────────────────────────────────────────────────────
router.get('/skills', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM skills ORDER BY category, name');
    return res.json(rows);
  } catch (e) { next(e); }
});

// ── Cycles ────────────────────────────────────────────────────────────────────
router.get('/cycles', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM project_cycles ORDER BY created_at DESC');
    return res.json(rows);
  } catch (e) { next(e); }
});

export default router;
