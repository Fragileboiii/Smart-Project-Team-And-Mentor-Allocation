import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import {
  getTeamById, getTeamMembers, listTeams,
  isStudentInAnyCycleTeam, countTeamMembers,
} from '../repositories/teamRepository';
import { writeAuditLog } from '../utils/audit';
import { AppError } from '../middleware/errorHandler';

async function getActiveCycleId(): Promise<string> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM project_cycles WHERE is_active=true LIMIT 1'
  );
  if (!rows[0]) throw new AppError('No active project cycle found', 404);
  return rows[0].id;
}

async function getStudentId(userId: string): Promise<string> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM students WHERE user_id=?', [userId]
  );
  if (!rows[0]) throw new AppError('Student profile not found', 404);
  return rows[0].id;
}

export async function listTeamsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const cycleId = req.query.cycleId as string | undefined;
    const teams = await listTeams(cycleId);
    return res.json(teams);
  } catch (e) { next(e); }
}

const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  projectTopic: z.string().optional(),
  projectDomain: z.string().optional(),
});

export async function createTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createTeamSchema.parse(req.body);
    const cycleId = await getActiveCycleId();
    const studentId = await getStudentId(req.user!.id);

    // Check if student already has a team in this cycle
    const already = await isStudentInAnyCycleTeam(studentId, cycleId);
    if (already) throw new AppError('You are already in a team for this cycle', 409);

    const [settings] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='max_team_size'"
    );
    const maxSize = parseInt(settings[0]?.value || '4');

    const teamId = uuidv4();
    await pool.execute(
      `INSERT INTO teams (id,cycle_id,name,description,project_topic,project_domain,leader_id,status)
       VALUES (?,?,?,?,?,?,?,'forming')`,
      [teamId, cycleId, body.name, body.description || null, body.projectTopic || null, body.projectDomain || null, studentId]
    );
    await pool.execute(
      'INSERT INTO team_members (id,team_id,student_id) VALUES (?,?,?)',
      [uuidv4(), teamId, studentId]
    );

    await writeAuditLog(req.user!.id, 'CREATE_TEAM', 'team', teamId, null, body, req.ip);
    return res.status(201).json({ teamId, message: 'Team created' });
  } catch (e) { next(e); }
}

export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await getTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const members = await getTeamMembers(req.params.id);
    return res.json({ ...team, members });
  } catch (e) { next(e); }
}

const inviteSchema = z.object({ inviteeId: z.string(), message: z.string().optional() });

export async function sendInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { inviteeId, message } = inviteSchema.parse(req.body);
    const team = await getTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const inviterId = await getStudentId(req.user!.id);
    if (team.leader_id !== inviterId) throw new AppError('Only the team leader can send invitations', 403);

    const [settings] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='max_team_size'"
    );
    const maxSize = parseInt(settings[0]?.value || '4');
    const currentCount = await countTeamMembers(team.id);
    if (currentCount >= maxSize) throw new AppError(`Team is full (max ${maxSize} members)`, 409);

    // Check no pending invite already exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM team_invitations WHERE team_id=? AND invitee_id=? AND status='pending'",
      [team.id, inviteeId]
    );
    if (existing.length) throw new AppError('Invitation already pending', 409);

    await pool.execute(
      'INSERT INTO team_invitations (id,team_id,invitee_id,inviter_id,message) VALUES (?,?,?,?,?)',
      [uuidv4(), team.id, inviteeId, inviterId, message || null]
    );
    return res.status(201).json({ message: 'Invitation sent' });
  } catch (e) { next(e); }
}

const respondSchema = z.object({ accept: z.boolean() });

export async function respondToInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { accept } = respondSchema.parse(req.body);
    const inviteeStudentId = await getStudentId(req.user!.id);

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM team_invitations WHERE id=? AND invitee_id=? AND status='pending'",
      [req.params.id, inviteeStudentId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Invitation not found' });

    const inv = rows[0];
    if (!accept) {
      await pool.execute(
        "UPDATE team_invitations SET status='rejected', responded_at=NOW() WHERE id=?", [inv.id]
      );
      return res.json({ message: 'Invitation rejected' });
    }

    const team = await getTeamById(inv.team_id);
    if (!team) throw new AppError('Team not found', 404);
    const cycleId = team.cycle_id;

    const already = await isStudentInAnyCycleTeam(inviteeStudentId, cycleId);
    if (already) throw new AppError('You are already in a team for this cycle', 409);

    const [settings] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='max_team_size'"
    );
    const maxSize = parseInt(settings[0]?.value || '4');
    const currentCount = await countTeamMembers(inv.team_id);
    if (currentCount >= maxSize) throw new AppError(`Team is full (max ${maxSize})`, 409);

    await pool.execute('INSERT INTO team_members (id,team_id,student_id) VALUES (?,?,?)',
      [uuidv4(), inv.team_id, inviteeStudentId]
    );
    await pool.execute(
      "UPDATE team_invitations SET status='accepted', responded_at=NOW() WHERE id=?", [inv.id]
    );
    return res.json({ message: 'Joined team successfully' });
  } catch (e) { next(e); }
}

export async function sendJoinRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await getTeamById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const studentId = await getStudentId(req.user!.id);
    const already = await isStudentInAnyCycleTeam(studentId, team.cycle_id);
    if (already) throw new AppError('Already in a team this cycle', 409);

    // Reuse invitation table with self-invite pattern (inviter = invitee, leader approves)
    await pool.execute(
      'INSERT INTO team_invitations (id,team_id,invitee_id,inviter_id,message,status) VALUES (?,?,?,?,?,?)',
      [uuidv4(), team.id, studentId, studentId, 'Join request from student', 'pending']
    );
    return res.status(201).json({ message: 'Join request sent' });
  } catch (e) { next(e); }
}
