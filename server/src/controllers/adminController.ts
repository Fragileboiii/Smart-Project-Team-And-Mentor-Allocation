import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

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
