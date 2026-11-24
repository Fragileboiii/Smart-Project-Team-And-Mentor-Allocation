import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

export interface TeamRow extends RowDataPacket {
  id: string; cycle_id: string; name: string; description: string;
  project_topic: string; project_domain: string; leader_id: string;
  status: string; created_at: Date; member_count: number;
}

export async function getTeamById(teamId: string): Promise<TeamRow | null> {
  const [rows] = await pool.execute<TeamRow[]>(
    `SELECT t.*, COUNT(tm.id) AS member_count
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     WHERE t.id = ?
     GROUP BY t.id`,
    [teamId]
  );
  return rows[0] || null;
}

export async function getTeamByStudentAndCycle(studentId: string, cycleId: string): Promise<TeamRow | null> {
  const [rows] = await pool.execute<TeamRow[]>(
    `SELECT t.*, COUNT(tm2.id) AS member_count
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id AND tm.student_id = ?
     LEFT JOIN team_members tm2 ON tm2.team_id = t.id
     WHERE t.cycle_id = ?
     GROUP BY t.id
     LIMIT 1`,
    [studentId, cycleId]
  );
  return rows[0] || null;
}

export async function getTeamMembers(teamId: string): Promise<RowDataPacket[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.roll_number, s.department, s.cgpa,
            u.first_name, u.last_name, u.email, tm.joined_at,
            (s.id = t.leader_id) AS is_leader
     FROM team_members tm
     JOIN students s ON s.id = tm.student_id
     JOIN users u ON u.id = s.user_id
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.team_id = ?`,
    [teamId]
  );
  return rows;
}

export async function isStudentInAnyCycleTeam(studentId: string, cycleId: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT tm.id FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.student_id = ? AND t.cycle_id = ?
     LIMIT 1`,
    [studentId, cycleId]
  );
  return rows.length > 0;
}

export async function countTeamMembers(teamId: string): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?',
    [teamId]
  );
  return (rows[0] as any).cnt;
}

export async function listTeams(cycleId?: string): Promise<TeamRow[]> {
  const where = cycleId ? 'WHERE t.cycle_id = ?' : '';
  const params = cycleId ? [cycleId] : [];
  const [rows] = await pool.execute<TeamRow[]>(
    `SELECT t.*, COUNT(tm.id) AS member_count
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     ${where}
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    params
  );
  return rows;
}
