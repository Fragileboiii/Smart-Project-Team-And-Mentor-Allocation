import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface UserRow extends RowDataPacket {
  id: string; email: string; password_hash: string;
  role: string; first_name: string; last_name: string; is_active: boolean;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT * FROM users WHERE email = ? AND is_active = true LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

export async function createUser(
  id: string, email: string, passwordHash: string,
  role: string, firstName: string, lastName: string
): Promise<void> {
  await pool.execute(
    'INSERT INTO users (id,email,password_hash,role,first_name,last_name) VALUES (?,?,?,?,?,?)',
    [id, email, passwordHash, role, firstName, lastName]
  );
}
