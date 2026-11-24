import pool from '../config/database';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';

export interface MentorRow extends RowDataPacket {
  id: string; user_id: string; employee_id: string; department: string;
  designation: string; domain?: string; bio: string; max_capacity: number; is_available: boolean;
  first_name: string; last_name: string; email: string;
  active_allocations: number; remaining_capacity: number;
}

export async function getMentorWithCapacity(mentorId: string, conn?: PoolConnection): Promise<MentorRow | null> {
  const executor = conn || pool;
  const [rows] = await executor.execute<MentorRow[]>(
    `SELECT m.*, u.first_name, u.last_name, u.email,
       COUNT(CASE WHEN a.status='active' THEN 1 END) AS active_allocations,
       (m.max_capacity - COUNT(CASE WHEN a.status='active' THEN 1 END)) AS remaining_capacity
     FROM mentors m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN allocations a ON a.mentor_id = m.id
     WHERE m.id = ?
     GROUP BY m.id, m.user_id, m.employee_id, m.department, m.designation, m.domain,
              m.bio, m.max_capacity, m.is_available, m.created_at, m.updated_at,
              u.first_name, u.last_name, u.email`,
    [mentorId]
  );
  return rows[0] || null;
}

/**
 * Lock the mentor row first (SELECT FOR UPDATE), then compute capacity.
 * MySQL does not allow FOR UPDATE with GROUP BY, so we do two queries inside the same transaction.
 */
export async function getMentorWithCapacityLocked(mentorId: string, conn: PoolConnection): Promise<MentorRow | null> {
  // Step 1: acquire exclusive row lock
  await conn.execute('SELECT id FROM mentors WHERE id = ? FOR UPDATE', [mentorId]);

  // Step 2: read data (same transaction, lock is held)
  const [rows] = await conn.execute<MentorRow[]>(
    `SELECT m.*, u.first_name, u.last_name, u.email,
       COUNT(CASE WHEN a.status='active' THEN 1 END) AS active_allocations,
       (m.max_capacity - COUNT(CASE WHEN a.status='active' THEN 1 END)) AS remaining_capacity
     FROM mentors m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN allocations a ON a.mentor_id = m.id
     WHERE m.id = ?
     GROUP BY m.id, m.user_id, m.employee_id, m.department, m.designation, m.domain,
              m.bio, m.max_capacity, m.is_available, m.created_at, m.updated_at,
              u.first_name, u.last_name, u.email`,
    [mentorId]
  );
  return rows[0] || null;
}

export async function listMentorsWithCapacity(): Promise<MentorRow[]> {
  const [rows] = await pool.execute<MentorRow[]>(
    `SELECT m.*, u.first_name, u.last_name, u.email,
       COUNT(CASE WHEN a.status='active' THEN 1 END) AS active_allocations,
       (m.max_capacity - COUNT(CASE WHEN a.status='active' THEN 1 END)) AS remaining_capacity
     FROM mentors m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN allocations a ON a.mentor_id = m.id
     GROUP BY m.id, m.user_id, m.employee_id, m.department, m.designation, m.domain,
              m.bio, m.max_capacity, m.is_available, m.created_at, m.updated_at,
              u.first_name, u.last_name, u.email`
  );
  return rows;
}

export async function getMentorByUserId(userId: string): Promise<MentorRow | null> {
  const [rows] = await pool.execute<MentorRow[]>(
    `SELECT m.*, u.first_name, u.last_name, u.email,
       COUNT(CASE WHEN a.status='active' THEN 1 END) AS active_allocations,
       (m.max_capacity - COUNT(CASE WHEN a.status='active' THEN 1 END)) AS remaining_capacity
     FROM mentors m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN allocations a ON a.mentor_id = m.id
     WHERE m.user_id = ?
     GROUP BY m.id, m.user_id, m.employee_id, m.department, m.designation, m.domain,
              m.bio, m.max_capacity, m.is_available, m.created_at, m.updated_at,
              u.first_name, u.last_name, u.email`,
    [userId]
  );
  return rows[0] || null;
}

export async function getMentorSkills(mentorId: string): Promise<{ name: string; category: string }[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.name, s.category FROM mentor_skills ms JOIN skills s ON s.id = ms.skill_id WHERE ms.mentor_id = ?`,
    [mentorId]
  );
  return rows as { name: string; category: string }[];
}
