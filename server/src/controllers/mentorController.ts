import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { listMentorsWithCapacity, getMentorWithCapacity, getMentorByUserId, getMentorSkills } from '../repositories/mentorRepository';
import { scoreMentor } from '../algorithms/matchingEngine';

export async function listMentors(req: Request, res: Response, next: NextFunction) {
  try {
    const mentors = await listMentorsWithCapacity();
    const withSkills = await Promise.all(mentors.map(async m => ({
      ...m,
      skills: await getMentorSkills(m.id),
    })));
    return res.json(withSkills);
  } catch (e) { next(e); }
}

export async function getMentor(req: Request, res: Response, next: NextFunction) {
  try {
    const mentor = await getMentorWithCapacity(req.params.id);
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    const skills = await getMentorSkills(mentor.id);
    return res.json({ ...mentor, skills });
  } catch (e) { next(e); }
}

export async function getMentorAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const mentor = await getMentorWithCapacity(req.params.id);
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    return res.json({
      mentorId: mentor.id,
      maxCapacity: mentor.max_capacity,
      activeAllocations: mentor.active_allocations,
      remainingCapacity: mentor.remaining_capacity,
      isAvailable: mentor.is_available && mentor.remaining_capacity > 0,
    });
  } catch (e) { next(e); }
}

const updateSchema = z.object({
  bio: z.string().optional(),
  maxCapacity: z.coerce.number().min(1).max(10).optional(),
  isAvailable: z.boolean().optional(),
  designation: z.string().optional(),
  domain: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
});

export async function updateMentor(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body);
    const { id } = req.params;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM mentors WHERE id=? AND user_id=?', [id, req.user!.id]
    );
    if (!rows[0] && req.user!.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    await pool.execute(
      `UPDATE mentors SET bio=COALESCE(?,bio), max_capacity=COALESCE(?,max_capacity),
       is_available=COALESCE(?,is_available), designation=COALESCE(?,designation),
       domain=COALESCE(?,domain), updated_at=NOW() WHERE id=?`,
      [body.bio ?? null, body.maxCapacity ?? null, body.isAvailable ?? null, body.designation ?? null, body.domain ?? null, id]
    );
    if (body.skillIds) {
      await pool.execute('DELETE FROM mentor_skills WHERE mentor_id=?', [id]);
      for (const sid of body.skillIds) {
        await pool.execute('INSERT INTO mentor_skills (mentor_id,skill_id) VALUES (?,?)', [id, sid]);
      }
    }
    return res.json({ message: 'Mentor profile updated' });
  } catch (e) { next(e); }
}

export async function getMyMentorProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const mentor = await getMentorByUserId(req.user!.id);
    if (!mentor) return res.status(404).json({ error: 'Mentor profile not found' });
    const skills = await getMentorSkills(mentor.id);
    const [teams] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.name, t.project_topic, t.project_domain,
              a.id AS allocation_id, a.request_id, a.allocated_at, a.status AS alloc_status, a.notes
       FROM allocations a JOIN teams t ON t.id = a.team_id
       WHERE a.mentor_id=? AND a.status='active'`, [mentor.id]
    );
    return res.json({ ...mentor, skills, assignedTeams: teams });
  } catch (e) { next(e); }
}

export async function getMatchScore(req: Request, res: Response, next: NextFunction) {
  try {
    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });

    const [teamRows] = await pool.execute<RowDataPacket[]>(
      'SELECT project_topic, project_domain FROM teams WHERE id=?', [teamId]
    );
    if (!teamRows[0]) return res.status(404).json({ error: 'Team not found' });

    const [memberSkills] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT sk.name FROM team_members tm
       JOIN student_skills ss ON ss.student_id = tm.student_id
       JOIN skills sk ON sk.id = ss.skill_id
       WHERE tm.team_id=?`, [teamId]
    );
    const teamSkills = memberSkills.map((r: any) => r.name);

    const mentors = await listMentorsWithCapacity();
    const results = await Promise.all(mentors.map(async m => {
      const skills = await getMentorSkills(m.id);
      const breakdown = scoreMentor(
        skills.map(s => s.name),
        skills.map(s => s.category),
        m.max_capacity,
        Number(m.remaining_capacity),
        teamSkills,
        teamRows[0].project_domain || '',
        m.domain || '',
      );
      return {
        mentorId: m.id,
        name: `${m.first_name} ${m.last_name}`,
        domain: m.domain,
        score: breakdown.score,
        breakdown,
        available: m.is_available && Number(m.remaining_capacity) > 0,
        remainingCapacity: m.remaining_capacity,
      };
    }));

    results.sort((a, b) => b.score - a.score);
    return res.json(results);
  } catch (e) { next(e); }
}

const rejectTeamSchema = z.object({
  comments: z.string().min(5, 'Please provide specific feedback/suggestions on improvements before reapplying'),
});

export async function rejectAssignedTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // allocation id
    const { comments } = rejectTeamSchema.parse(req.body);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, m.user_id AS mentor_user_id, t.name AS team_name
       FROM allocations a
       JOIN mentors m ON m.id = a.mentor_id
       JOIN teams t ON t.id = a.team_id
       WHERE a.id=?`,
      [id]
    );

    if (!rows[0] || rows[0].status !== 'active') {
      return res.status(404).json({ error: 'Active allocation not found' });
    }

    const alloc = rows[0];
    if (alloc.mentor_user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the assigned mentor or admin can reject this team' });
    }

    // Release allocation with rejection notes
    await pool.execute(
      `UPDATE allocations SET status='cancelled', notes=?, released_at=NOW() WHERE id=?`,
      [comments, alloc.id]
    );

    // Update request with rejection comments
    await pool.execute(
      `UPDATE mentor_requests
       SET status='rejected', rejection_comments=?, failure_reason='Rejected by mentor with feedback',
           completion_time=NOW(), updated_at=NOW()
       WHERE id=?`,
      [comments, alloc.request_id]
    );

    // Free the team back to active status so they can improve and reapply
    await pool.execute(
      `UPDATE teams SET status='active', updated_at=NOW() WHERE id=?`,
      [alloc.team_id]
    );

    // Record scheduler event
    const { v4: uuidv4 } = await import('uuid');
    await pool.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status,metadata)
       VALUES (?,?,'REJECTED_BY_MENTOR','allocated','rejected',?)`,
      [uuidv4(), alloc.request_id, JSON.stringify({ comments, mentorId: alloc.mentor_id, teamId: alloc.team_id })]
    );

    const { writeAuditLog } = await import('../utils/audit');
    await writeAuditLog(req.user!.id, 'MENTOR_REJECT_TEAM', 'allocation', alloc.id, null, { comments }, req.ip);

    return res.json({
      message: 'Team allocation rejected. Improvement feedback has been delivered to the team.',
      comments,
    });
  } catch (e) { next(e); }
}
