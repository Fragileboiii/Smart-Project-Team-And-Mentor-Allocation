import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '../config/env';
import { findUserByEmail, findUserById, createUser } from '../repositories/userRepository';
import pool from '../config/database';
import { writeAuditLog } from '../utils/audit';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['student', 'mentor']),
  // student fields
  rollNumber: z.string().optional(),
  department: z.string().optional(),
  semester: z.coerce.number().optional(),
  // mentor fields
  employeeId: z.string().optional(),
  designation: z.string().optional(),
  maxCapacity: z.coerce.number().min(1).max(10).optional(),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await findUserByEmail(body.email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const userId = uuidv4();
    const hash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
    await createUser(userId, body.email, hash, body.role, body.firstName, body.lastName);

    if (body.role === 'student') {
      if (!body.rollNumber || !body.department || !body.semester) {
        return res.status(400).json({ error: 'rollNumber, department, semester required for student' });
      }
      const sid = uuidv4();
      await pool.execute(
        'INSERT INTO students (id,user_id,roll_number,department,semester) VALUES (?,?,?,?,?)',
        [sid, userId, body.rollNumber, body.department, body.semester]
      );
    } else if (body.role === 'mentor') {
      if (!body.employeeId || !body.department || !body.designation) {
        return res.status(400).json({ error: 'employeeId, department, designation required for mentor' });
      }
      const mid = uuidv4();
      await pool.execute(
        'INSERT INTO mentors (id,user_id,employee_id,department,designation,max_capacity) VALUES (?,?,?,?,?,?)',
        [mid, userId, body.employeeId, body.department, body.designation, body.maxCapacity || 3]
      );
    }

    await writeAuditLog(userId, 'REGISTER', 'user', userId, null, { role: body.role }, req.ip);
    return res.status(201).json({ message: 'Registered successfully' });
  } catch (e) { next(e); }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    await writeAuditLog(user.id, 'LOGIN', 'user', user.id, null, null, req.ip);
    return res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name },
    });
  } catch (e) { next(e); }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await findUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({
      id: user.id, email: user.email, role: user.role,
      firstName: user.first_name, lastName: user.last_name,
    });
  } catch (e) { next(e); }
}
