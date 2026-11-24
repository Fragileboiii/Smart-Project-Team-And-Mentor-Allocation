import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

export interface StudentSkillRow {
  name: string;
  category: string;
  proficiency: string;
}

export async function getStudentSkills(studentId: string): Promise<StudentSkillRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT sk.name, sk.category, ss.proficiency
     FROM student_skills ss
     JOIN skills sk ON sk.id = ss.skill_id
     WHERE ss.student_id = ?`,
    [studentId]
  );
  return rows as StudentSkillRow[];
}

export async function getStudentByUserId(userId: string): Promise<RowDataPacket | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM students WHERE user_id = ?',
    [userId]
  );
  return rows[0] || null;
}
