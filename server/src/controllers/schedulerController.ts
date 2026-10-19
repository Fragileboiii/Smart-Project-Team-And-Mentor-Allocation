import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { runScheduler, getSchedulerMetrics } from '../algorithms/scheduler';
import { writeAuditLog } from '../utils/audit';

export async function getQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT mr.*, t.name AS team_name, u.first_name AS mentor_first, u.last_name AS mentor_last,
              TIMESTAMPDIFF(SECOND, mr.enqueue_time, NOW()) AS wait_seconds
       FROM mentor_requests mr
       JOIN teams t ON t.id = mr.team_id
       JOIN mentors m ON m.id = mr.mentor_id
       JOIN users u ON u.id = m.user_id
       WHERE mr.status IN ('pending','queued','processing','waiting')
       ORDER BY mr.priority_score DESC, mr.enqueue_time ASC`
    );
    return res.json(rows);
  } catch (e) { next(e); }
}

export async function runSchedulerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const algorithm = (req.body.algorithm || 'FCFS') as 'FCFS' | 'PRIORITY';
    const result = await runScheduler(algorithm, req.user!.id);
    await writeAuditLog(req.user!.id, 'RUN_SCHEDULER', 'scheduler', 'global', null, { algorithm, ...result }, req.ip);
    return res.json({ algorithm, ...result });
  } catch (e) { next(e); }
}

export async function getMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = await getSchedulerMetrics();
    return res.json(metrics);
  } catch (e) { next(e); }
}

export async function getEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string || '50');
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT se.*, mr.status AS request_status, t.name AS team_name
       FROM scheduler_events se
       LEFT JOIN mentor_requests mr ON mr.id = se.request_id
       LEFT JOIN teams t ON t.id = mr.team_id
       ORDER BY se.created_at DESC LIMIT ?`,
      [limit]
    );
    return res.json(rows);
  } catch (e) { next(e); }
}
