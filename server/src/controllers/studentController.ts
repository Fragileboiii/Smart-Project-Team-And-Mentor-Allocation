import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

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
