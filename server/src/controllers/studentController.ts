import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { getStudentSkills } from '../repositories/studentRepository';

export async function listStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, u.first_name, u.last_name, u.email FROM students s JOIN users u ON u.id = s.user_id`
    );
    return res.json(rows);
  } catch (e) { next(e); }
}

export async function getStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, u.first_name, u.last_name, u.email FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });

    const [skills] = await pool.execute<RowDataPacket[]>(
      `SELECT sk.id AS skill_id, sk.name, sk.category, ss.proficiency 
       FROM student_skills ss JOIN skills sk ON sk.id = ss.skill_id WHERE ss.student_id = ?`,
      [req.params.id]
    );
    return res.json({ ...rows[0], skills });
  } catch (e) { next(e); }
}

const updateSchema = z.object({
  bio: z.string().optional(),
  cgpa: z.coerce.number().min(0).max(10).optional(),
  projectInterests: z.string().optional(),
  skills: z.array(z.object({ skillId: z.string(), proficiency: z.enum(['beginner','intermediate','advanced']) })).optional(),
});

export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body);
    const { id } = req.params;

    // Ensure only own profile
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM students WHERE id=? AND user_id=?', [id, req.user!.id]
    );
    if (!rows[0] && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot update another student profile' });
    }

    await pool.execute(
      `UPDATE students SET bio=COALESCE(?,bio), cgpa=COALESCE(?,cgpa), project_interests=COALESCE(?,project_interests), updated_at=NOW() WHERE id=?`,
      [body.bio ?? null, body.cgpa ?? null, body.projectInterests ?? null, id]
    );

    if (body.skills) {
      await pool.execute('DELETE FROM student_skills WHERE student_id=?', [id]);
      for (const sk of body.skills) {
        await pool.execute(
          'INSERT INTO student_skills (student_id,skill_id,proficiency) VALUES (?,?,?)',
          [id, sk.skillId, sk.proficiency]
        );
      }
    }
    return res.json({ message: 'Profile updated' });
  } catch (e) { next(e); }
}

export async function getMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, u.first_name, u.last_name, u.email FROM students s JOIN users u ON u.id = s.user_id WHERE s.user_id=?`,
      [req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student profile not found' });
    const [skills] = await pool.execute<RowDataPacket[]>(
      `SELECT sk.id AS skill_id, sk.name, sk.category, ss.proficiency 
       FROM student_skills ss JOIN skills sk ON sk.id=ss.skill_id WHERE ss.student_id=?`,
      [rows[0].id]
    );
    return res.json({ ...rows[0], skills });
  } catch (e) { next(e); }
}

export async function discoverStudents(req: Request, res: Response, next: NextFunction) {
  try {
    // Active project cycle
    const [cyc] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM project_cycles WHERE is_active = true LIMIT 1'
    );
    if (!cyc[0]) return res.json([]);
    const cycleId = cyc[0].id;

    // Current student
    const [me] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM students WHERE user_id = ?', [req.user!.id]
    );
    if (!me[0]) return res.json([]);
    const myId = me[0].id;

    // My team in this cycle (if any) — used to flag pending invitations
    const [myTeam] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.student_id = ? AND t.cycle_id = ? LIMIT 1`,
      [myId, cycleId]
    );
    const myTeamId = (myTeam[0] as any)?.id ?? null;

    // Students NOT in any team this cycle (excluding me)
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.id, s.roll_number, s.department, s.semester, s.cgpa, s.bio,
              s.project_interests, s.section, u.first_name, u.last_name, u.email
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id <> ?
         AND s.id NOT IN (
           SELECT tm.student_id FROM team_members tm
           JOIN teams t ON t.id = tm.team_id
           WHERE t.cycle_id = ?
         )
       ORDER BY u.first_name, u.last_name`,
      [myId, cycleId]
    );

    const withSkills = await Promise.all(rows.map(async (r: any) => ({
      ...r,
      skills: await getStudentSkills(r.id),
    })));

    // Flag students already invited by my team (so the UI can show "invite sent")
    let invitedSet = new Set<string>();
    if (myTeamId) {
      const [inv] = await pool.execute<RowDataPacket[]>(
        "SELECT invitee_id FROM team_invitations WHERE team_id = ? AND status = 'pending'",
        [myTeamId]
      );
      invitedSet = new Set(inv.map((x: any) => x.invitee_id));
    }

    const result = withSkills.map((s: any) => ({ ...s, invitedByMe: invitedSet.has(s.id) }));
    return res.json(result);
  } catch (e) { next(e); }
}
