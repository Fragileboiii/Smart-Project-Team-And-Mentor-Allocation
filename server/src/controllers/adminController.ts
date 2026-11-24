import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { writeAuditLog } from '../utils/audit';

export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const [[students]] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM students') as any;
    const [[mentors]]  = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM mentors') as any;
    const [[teams]]    = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM teams') as any;
    const [[activeAllocs]] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM allocations WHERE status='active'") as any;
    const [[pendingReqs]]  = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM mentor_requests WHERE status IN ('pending','queued','waiting')") as any;

    const [mentorWorkload] = await pool.execute<RowDataPacket[]>(
      `SELECT u.first_name, u.last_name, m.max_capacity,
              COUNT(a.id) AS active_count
       FROM mentors m 
       JOIN users u ON u.id=m.user_id
       LEFT JOIN allocations a ON a.mentor_id=m.id AND a.status='active'
       GROUP BY m.id, u.first_name, u.last_name, m.max_capacity`
    );

    const [requestStats] = await pool.execute<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS cnt FROM mentor_requests GROUP BY status`
    );

    const [recentActivity] = await pool.execute<RowDataPacket[]>(
      `SELECT al.action, al.entity_type, al.created_at, u.first_name, u.last_name
       FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id
       ORDER BY al.created_at DESC LIMIT 10`
    );

    return res.json({
      summary: {
        totalStudents: students.cnt,
        totalMentors: mentors.cnt,
        totalTeams: teams.cnt,
        activeAllocations: activeAllocs.cnt,
        pendingRequests: pendingReqs.cnt,
      },
      mentorWorkload,
      requestStats,
      recentActivity,
    });
  } catch (e) { next(e); }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '50');
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT al.*, u.first_name, u.last_name, u.email
       FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id
       ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[total]] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM audit_logs') as any;
    return res.json({ logs: rows, total: total.cnt, page, limit });
  } catch (e) { next(e); }
}

const settingsSchema = z.record(z.string());

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = settingsSchema.parse(req.body);
    for (const [key, value] of Object.entries(settings)) {
      await pool.execute(
        'INSERT INTO system_settings (key_name, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?',
        [key, value, value]
      );
    }
    return res.json({ message: 'Settings updated' });
  } catch (e) { next(e); }
}

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT key_name, value FROM system_settings');
    const settings: Record<string, string> = {};
    rows.forEach((r: any) => { settings[r.key_name] = r.value; });
    return res.json(settings);
  } catch (e) { next(e); }
}

export async function listAllUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, email, role, first_name, last_name, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json(rows);
  } catch (e) { next(e); }
}


const createCycleSchema = z.object({
  name: z.string().min(2).max(100),
  semester: z.string().min(1),
  year: z.coerce.number().int(),
  minTeamSize: z.coerce.number().int().min(1).optional(),
  maxTeamSize: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function createCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createCycleSchema.parse(req.body);
    const id = uuidv4();
    if (body.isActive) {
      await pool.execute('UPDATE project_cycles SET is_active=false');
    }
    await pool.execute(
      'INSERT INTO project_cycles (id,name,semester,year,min_team_size,max_team_size,is_active) VALUES (?,?,?,?,?,?,?)',
      [id, body.name, body.semester, body.year, body.minTeamSize ?? 2, body.maxTeamSize ?? 4, body.isActive ?? false]
    );
    await writeAuditLog(req.user!.id, 'CREATE_CYCLE', 'cycle', id, null, body, req.ip);
    return res.status(201).json({ id, message: 'Cycle created' });
  } catch (e) { next(e); }
}

const updateCycleSchema = z.object({
  name: z.string().optional(),
  semester: z.string().optional(),
  year: z.coerce.number().int().optional(),
  minTeamSize: z.coerce.number().int().min(1).optional(),
  maxTeamSize: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function updateCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateCycleSchema.parse(req.body);
    const { id } = req.params;
    if (body.isActive) {
      await pool.execute('UPDATE project_cycles SET is_active=false');
    }
    await pool.execute(
      `UPDATE project_cycles SET name=COALESCE(?,name), semester=COALESCE(?,semester), year=COALESCE(?,year), min_team_size=COALESCE(?,min_team_size), max_team_size=COALESCE(?,max_team_size) WHERE id=?`,
      [body.name ?? null, body.semester ?? null, body.year ?? null, body.minTeamSize ?? null, body.maxTeamSize ?? null, id]
    );
    if (body.isActive !== undefined) {
      await pool.execute('UPDATE project_cycles SET is_active=? WHERE id=?', [body.isActive, id]);
    }
    await writeAuditLog(req.user!.id, 'UPDATE_CYCLE', 'cycle', id, null, body, req.ip);
    return res.json({ message: 'Cycle updated' });
  } catch (e) { next(e); }
}

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateUserSchema.parse(req.body);
    const { id } = req.params;
    // Prevent deactivating yourself
    if (body.isActive === false && req.user!.id === id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    await pool.execute(
      `UPDATE users SET
        first_name = COALESCE(?, first_name),
        last_name  = COALESCE(?, last_name),
        is_active  = COALESCE(?, is_active),
        updated_at = NOW()
       WHERE id = ?`,
      [body.firstName ?? null, body.lastName ?? null, body.isActive ?? null, id]
    );
    await writeAuditLog(req.user!.id, 'ADMIN_UPDATE_USER', 'user', id, null, body, req.ip);
    return res.json({ message: 'User updated' });
  } catch (e) { next(e); }
}