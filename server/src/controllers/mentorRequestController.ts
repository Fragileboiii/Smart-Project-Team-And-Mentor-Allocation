import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../utils/audit';
import { allocateMentor, releaseAllocation } from '../algorithms/allocationEngine';
import { getMentorWithCapacity, getMentorSkills } from '../repositories/mentorRepository';
import { areDomainsCompatible } from '../algorithms/matchingEngine';

async function getActiveCycleId(): Promise<string> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM project_cycles WHERE is_active=true LIMIT 1'
  );
  if (!rows[0]) throw new AppError('No active project cycle', 404);
  return rows[0].id;
}

export async function getTeamCooldown(req: Request, res: Response, next: NextFunction) {
  try {
    const { teamId } = req.params;
    const [cooldownSetting] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='request_cooldown_minutes'"
    );
    const cooldownMinutes = parseInt(cooldownSetting[0]?.value || '5', 10);
    const cooldownSeconds = cooldownMinutes * 60;

    const [recentReqs] = await pool.execute<RowDataPacket[]>(
      `SELECT id, status, rejection_comments, updated_at, created_at,
              TIMESTAMPDIFF(SECOND, updated_at, NOW()) AS seconds_since_update,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_since_create
       FROM mentor_requests
       WHERE team_id=?
       ORDER BY updated_at DESC LIMIT 1`,
      [teamId]
    );

    if (recentReqs.length === 0) {
      return res.json({ cooldownActive: false, remainingSeconds: 0, cooldownMinutes });
    }

    const lastReq = recentReqs[0];
    const elapsed = Math.min(
      lastReq.seconds_since_create ?? Infinity,
      lastReq.seconds_since_update ?? Infinity
    );

    if (elapsed < cooldownSeconds) {
      const remainingSeconds = cooldownSeconds - elapsed;
      return res.json({
        cooldownActive: true,
        remainingSeconds,
        cooldownMinutes,
        lastStatus: lastReq.status,
        rejectionComments: lastReq.rejection_comments || null,
      });
    }

    return res.json({
      cooldownActive: false,
      remainingSeconds: 0,
      cooldownMinutes,
      lastStatus: lastReq.status,
      rejectionComments: lastReq.rejection_comments || null,
    });
  } catch (e) { next(e); }
}

const createRequestSchema = z.object({
  teamId: z.string(),
  mentorId: z.string(),
  message: z.string().optional(),
  priority: z.coerce.number().min(0).max(10).optional(),
});

export async function createMentorRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createRequestSchema.parse(req.body);
    const cycleId = await getActiveCycleId();

    // Verify requester is the team leader
    const [teamRows] = await pool.execute<RowDataPacket[]>(
      `SELECT t.leader_id, t.project_domain, s.user_id FROM teams t JOIN students s ON s.id = t.leader_id WHERE t.id=?`,
      [body.teamId]
    );
    if (!teamRows[0]) throw new AppError('Team not found', 404);
    if (teamRows[0].user_id !== req.user!.id) throw new AppError('Only team leader can request a mentor', 403);

    // 1. Check Cooldown before requesting
    const [cooldownSetting] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='request_cooldown_minutes'"
    );
    const cooldownMinutes = parseInt(cooldownSetting[0]?.value || '5', 10);
    const cooldownSeconds = cooldownMinutes * 60;

    const [recentReqs] = await pool.execute<RowDataPacket[]>(
      `SELECT id, status, updated_at, created_at,
              TIMESTAMPDIFF(SECOND, updated_at, NOW()) AS seconds_since_update,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_since_create
       FROM mentor_requests
       WHERE team_id=?
       ORDER BY updated_at DESC LIMIT 1`,
      [body.teamId]
    );

    if (recentReqs.length > 0) {
      const lastReq = recentReqs[0];
      const elapsed = Math.min(
        lastReq.seconds_since_create ?? Infinity,
        lastReq.seconds_since_update ?? Infinity
      );
      if (elapsed < cooldownSeconds) {
        const remainingSeconds = cooldownSeconds - elapsed;
        const remMin = Math.floor(remainingSeconds / 60);
        const remSec = remainingSeconds % 60;
        return res.status(429).json({
          error: `Request Cooldown Active: Please wait ${remMin}m ${remSec}s before submitting another mentor request.`,
          cooldownActive: true,
          remainingSeconds,
        });
      }
    }

    // 2. Check no active allocation already
    const [allocRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM allocations WHERE team_id=? AND cycle_id=? AND status='active' LIMIT 1",
      [body.teamId, cycleId]
    );
    if (allocRows.length) throw new AppError('Team already has an active mentor allocation', 409);

    // 3. Check no duplicate pending request for same mentor
    const [dupRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM mentor_requests WHERE team_id=? AND mentor_id=? AND cycle_id=? AND status IN ('pending','queued','processing') LIMIT 1",
      [body.teamId, body.mentorId, cycleId]
    );
    if (dupRows.length) throw new AppError('A request for this mentor is already pending', 409);

    // 4. Domain Check: mentor and teams should have the same domain
    const teamDomain = teamRows[0].project_domain || '';
    const mentor = await getMentorWithCapacity(body.mentorId);
    if (!mentor) throw new AppError('Mentor not found', 404);

    const mentorDomain = mentor.domain || '';
    const mentorSkills = await getMentorSkills(mentor.id);
    const mentorCategories = mentorSkills.map(s => s.category);

    const isDomainMatch = areDomainsCompatible(teamDomain, mentorDomain) ||
      mentorCategories.some(c => areDomainsCompatible(teamDomain, c));

    if (!isDomainMatch && teamDomain) {
      throw new AppError(
        `Domain mismatch: Your team domain ('${teamDomain}') must match the mentor's domain ('${mentorDomain}'). Teams can only request mentors within the same domain.`,
        400
      );
    }

    // 5. Compute priority score (Domain priority bonus + user priority + team CGPA)
    const [cgpaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT AVG(s.cgpa) AS avg_cgpa FROM team_members tm JOIN students s ON s.id=tm.student_id WHERE tm.team_id=?`,
      [body.teamId]
    );
    const avgCgpa = parseFloat(cgpaRows[0]?.avg_cgpa || '0');
    const domainPriorityBonus = isDomainMatch ? 50 : 0;
    const priorityScore = (body.priority || 0) + avgCgpa * 0.1 + domainPriorityBonus;

    const reqId = uuidv4();
    await pool.execute(
      `INSERT INTO mentor_requests (id,team_id,mentor_id,cycle_id,status,priority,priority_score,message,enqueue_time)
       VALUES (?,?,?,?,'pending',?,?,?,NOW())`,
      [reqId, body.teamId, body.mentorId, cycleId, body.priority || 0, priorityScore, body.message || null]
    );
    await pool.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,new_status) VALUES (?,?,'ENQUEUED','pending')`,
      [uuidv4(), reqId]
    );

    // 6. First-Come Basis Allotment:
    // If mentor has available capacity, allocate immediately on FCFS basis!
    if (mentor.is_available && Number(mentor.remaining_capacity) > 0) {
      const allocResult = await allocateMentor(reqId, body.teamId, body.mentorId, cycleId, req.user!.id);
      if (allocResult.success) {
        await writeAuditLog(req.user!.id, 'CREATE_MENTOR_REQUEST_ALLOCATED_FCFS', 'allocation', allocResult.allocationId!, null, body, req.ip);
        return res.status(201).json({
          requestId: reqId,
          allocationId: allocResult.allocationId,
          status: 'allocated',
          message: 'Mentor allocated immediately on First-Come, First-Served basis!',
        });
      }
    }

    await writeAuditLog(req.user!.id, 'CREATE_MENTOR_REQUEST', 'mentor_request', reqId, null, body, req.ip);
    return res.status(201).json({
      requestId: reqId,
      status: 'pending',
      message: 'Mentor request queued in First-Come, First-Served order (mentor currently at capacity).'
    });
  } catch (e) { next(e); }
}

export async function listMentorRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, teamId, mentorId } = req.query;
    let sql = `SELECT mr.*, t.name AS team_name, t.project_domain,
                      u.first_name AS mentor_first, u.last_name AS mentor_last, m.domain AS mentor_domain
               FROM mentor_requests mr
               JOIN teams t ON t.id = mr.team_id
               JOIN mentors m ON m.id = mr.mentor_id
               JOIN users u ON u.id = m.user_id
               WHERE 1=1`;
    const params: any[] = [];
    if (status)   { sql += ' AND mr.status=?';    params.push(status); }
    if (teamId)   { sql += ' AND mr.team_id=?';   params.push(teamId); }
    if (mentorId) { sql += ' AND mr.mentor_id=?'; params.push(mentorId); }
    sql += ' ORDER BY mr.enqueue_time ASC';
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return res.json(rows);
  } catch (e) { next(e); }
}

export async function getMentorRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT mr.*, t.name AS team_name, u.first_name AS mentor_first, u.last_name AS mentor_last
       FROM mentor_requests mr
       JOIN teams t ON t.id = mr.team_id
       JOIN mentors m ON m.id = mr.mentor_id
       JOIN users u ON u.id = m.user_id
       WHERE mr.id=?`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    return res.json(rows[0]);
  } catch (e) { next(e); }
}

export async function cancelMentorRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT mr.*, t.leader_id, s.user_id FROM mentor_requests mr JOIN teams t ON t.id=mr.team_id JOIN students s ON s.id=t.leader_id WHERE mr.id=?",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    if (rows[0].user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.execute(
      "UPDATE mentor_requests SET status='cancelled', updated_at=NOW() WHERE id=?", [req.params.id]
    );
    return res.json({ message: 'Request cancelled' });
  } catch (e) { next(e); }
}

export async function cancelAllocation(req: Request, res: Response, next: NextFunction) {
  try {
    await releaseAllocation(req.params.id);
    await writeAuditLog(req.user!.id, 'CANCEL_ALLOCATION', 'allocation', req.params.id, null, null, req.ip);
    return res.json({ message: 'Allocation cancelled' });
  } catch (e) { next(e); }
}

export async function listAllocations(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, t.name AS team_name, t.project_domain, u.first_name AS mentor_first, u.last_name AS mentor_last, m.domain AS mentor_domain
       FROM allocations a
       JOIN teams t ON t.id = a.team_id
       JOIN mentors m ON m.id = a.mentor_id
       JOIN users u ON u.id = m.user_id
       ORDER BY a.allocated_at DESC`
    );
    return res.json(rows);
  } catch (e) { next(e); }
}

const rejectRequestSchema = z.object({
  comments: z.string().min(5, 'Please provide specific feedback/suggestions on improvements before reapplying'),
});

export async function rejectMentorRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { comments } = rejectRequestSchema.parse(req.body);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT mr.*, m.user_id AS mentor_user_id, t.name AS team_name
       FROM mentor_requests mr
       JOIN mentors m ON m.id = mr.mentor_id
       JOIN teams t ON t.id = mr.team_id
       WHERE mr.id=?`,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    const mr = rows[0];

    if (mr.mentor_user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the requested mentor or admin can reject this request' });
    }

    await pool.execute(
      `UPDATE mentor_requests
       SET status='rejected', rejection_comments=?, failure_reason='Rejected by mentor with feedback',
           completion_time=NOW(), updated_at=NOW()
       WHERE id=?`,
      [comments, id]
    );

    await pool.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status,metadata)
       VALUES (?,?,'REJECTED_BY_MENTOR',?,'rejected',?)`,
      [uuidv4(), id, mr.status, JSON.stringify({ comments, mentorId: mr.mentor_id, teamId: mr.team_id })]
    );

    await writeAuditLog(req.user!.id, 'MENTOR_REJECT_REQUEST', 'mentor_request', id, null, { comments }, req.ip);
    return res.json({ message: 'Request rejected. Improvement feedback delivered to the team.', comments });
  } catch (e) { next(e); }
}
