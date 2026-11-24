import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Simple in-process counting semaphore for each mentor.
 * It mirrors the mentor's max_capacity and remaining slots.
 * All modifications are also reflected in the database via the mentor
 * table, which remains the source of truth. The semaphore is only used
 * to coordinate concurrent allocation requests within this server instance.
 */
interface SemaphoreState {
  max: number;
  available: number;
  queue: Array<() => void>;
}

// Map mentorId -> semaphore state
const mentorSemaphores: Map<string, SemaphoreState> = new Map();

/** Initialize semaphores for all mentors from the DB.
 * Must be called during server start before handling allocations.
 */
export async function initSemaphores(): Promise<void> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, max_capacity, (max_capacity - IFNULL(allocated, 0)) AS available
       FROM mentors m
       LEFT JOIN (
         SELECT mentor_id, COUNT(*) AS allocated
           FROM allocations
          WHERE status = 'active'
          GROUP BY mentor_id
       ) a ON a.mentor_id = m.id`
  );
  for (const r of rows as any[]) {
    const id = r.id as string;
    const max = Number(r.max_capacity);
    const available = Number(r.available);
    mentorSemaphores.set(id, { max, available, queue: [] });
  }
}

/** Acquire a permit for a mentor. Returns a promise that resolves when the permit is granted. */
export async function acquirePermit(mentorId: string): Promise<void> {
  const sem = mentorSemaphores.get(mentorId);
  if (!sem) {
    // If semaphore missing, initialize lazily
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, max_capacity FROM mentors WHERE id = ?`,
      [mentorId]
    );
    if (!rows[0]) throw new Error('Mentor not found');
    const max = Number(rows[0].max_capacity);
    mentorSemaphores.set(mentorId, { max, available: max, queue: [] });
    return acquirePermit(mentorId);
  }

  if (sem.available > 0) {
    sem.available -= 1;
    return;
  }
  // No permits - enqueue a resolver
  return new Promise<void>((resolve) => {
    sem.queue.push(() => {
      sem.available -= 1;
      resolve();
    });
  });
}

/** Release a previously acquired permit. */
export function releasePermit(mentorId: string): void {
  const sem = mentorSemaphores.get(mentorId);
  if (!sem) return;
  if (sem.queue.length > 0) {
    // Wake the next waiting request
    const next = sem.queue.shift();
    if (next) next();
  } else {
    // Increment available, but never exceed max
    sem.available = Math.min(sem.max, sem.available + 1);
  }
}

/** Utility to get current semaphore state - useful for monitoring. */
export function getSemaphoreState(mentorId: string): { max: number; available: number; queued: number } | undefined {
  const sem = mentorSemaphores.get(mentorId);
  if (!sem) return undefined;
  return { max: sem.max, available: sem.available, queued: sem.queue.length };
}