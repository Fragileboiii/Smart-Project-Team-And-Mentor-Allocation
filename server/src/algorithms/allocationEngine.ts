/**
 * Allocation Engine
 *
 * OS Concepts demonstrated:
 * 1. Mutex / Semaphore-style synchronization:
 *    - An in-process Mutex map serializes requests for the same mentor within a single server process.
 *    - This prevents redundant concurrent DB hits and demonstrates mutual exclusion.
 *    - NOTE: This does NOT protect against multiple server instances. The real correctness
 *      guarantee is the database-level row lock (SELECT ... FOR UPDATE inside a transaction).
 *
 * 2. Row-level locking (OS: resource acquisition):
 *    - Before reading or writing mentor capacity, we acquire an exclusive row lock via
 *      SELECT ... FOR UPDATE inside a MySQL transaction.
 *    - No two concurrent transactions can both pass the capacity check for the same mentor
 *      slot, preventing double-booking (over-allocation).
 *
 * 3. ACID Transactions:
 *    - Every allocation that modifies multiple tables uses BEGIN / COMMIT / ROLLBACK,
 *      guaranteeing atomicity and consistency.
 *
 * 4. Deadlock avoidance:
 *    - Resource requests always lock exactly one mentor row; there is no circular
 *      dependency possible in the locking order.
 *    - The Banker's Algorithm educational simulator (bankersAlgorithm.ts) demonstrates
 *      the formal safe-sequence algorithm separately.
 */

import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { getMentorWithCapacityLocked } from '../repositories/mentorRepository';
import { PoolConnection } from 'mysql2/promise';

// ── In-process mutex map ──────────────────────────────────────────────────────
// Maps mentorId → promise chain so concurrent in-process requests are serialized
const mentorMutex: Map<string, Promise<void>> = new Map();

function acquireMutex(mentorId: string): { release: () => void; wait: Promise<void> } {
  let release!: () => void;
  const previous = mentorMutex.get(mentorId) || Promise.resolve();
  const current = new Promise<void>(resolve => { release = resolve; });
  mentorMutex.set(
    mentorId,
    previous.then(() => current)
  );
  return { release, wait: previous };
}

// ── Core allocation with DB row lock ────────────────────────────────────────
export async function allocateMentor(
  requestId: string,
  teamId: string,
  mentorId: string,
  cycleId: string,
  userId: string
): Promise<{ success: boolean; allocationId?: string; reason?: string }> {
  // Step 1: Acquire in-process mutex (demonstrates OS mutual exclusion)
  const { release, wait } = acquireMutex(mentorId);
  await wait; // wait for any prior in-process request to finish

  let conn: PoolConnection | undefined;
  const lockId = uuidv4();

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Step 2: Record lock acquisition attempt
    await conn.execute(
      `INSERT INTO resource_locks (id, resource_id, held_by, acquired_at, lock_status)
       VALUES (?, ?, ?, NOW(), 'acquired')`,
      [lockId, mentorId, requestId]
    );

    // Step 3: Acquire exclusive DB row lock on mentor (SELECT ... FOR UPDATE)
    // This is the OS-level equivalent of P(semaphore) — no other transaction can
    // read-for-update this row until we COMMIT or ROLLBACK.
    const mentor = await getMentorWithCapacityLocked(mentorId, conn);
    if (!mentor) throw Object.assign(new Error('Mentor not found'), { status: 404 });

    // Step 4: Check capacity (critical section)
    if (!mentor.is_available || mentor.remaining_capacity <= 0) {
      await conn.execute(
        `UPDATE mentor_requests SET status='waiting', updated_at=NOW() WHERE id=?`,
        [requestId]
      );
      await conn.execute(
        `UPDATE resource_locks SET lock_status='released', released_at=NOW() WHERE id=?`,
        [lockId]
      );
      await conn.commit();
      return { success: false, reason: 'No capacity available — request queued for waiting' };
    }

    // Step 5: Check team doesn't already have an active allocation this cycle
    const [existing] = await conn.execute<any[]>(
      `SELECT id FROM allocations WHERE team_id=? AND cycle_id=? AND status='active' LIMIT 1`,
      [teamId, cycleId]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return { success: false, reason: 'Team already has an active mentor allocation this cycle' };
    }

    // Step 6: Write allocation (atomic commit — either all or nothing)
    const allocationId = uuidv4();
    await conn.execute(
      `INSERT INTO allocations (id,team_id,mentor_id,cycle_id,request_id,status,allocated_at)
       VALUES (?,?,?,?,?,'active',NOW())`,
      [allocationId, teamId, mentorId, cycleId, requestId]
    );

    await conn.execute(
      `UPDATE mentor_requests SET status='allocated', processing_start=NOW(), completion_time=NOW(), updated_at=NOW() WHERE id=?`,
      [requestId]
    );
    await conn.execute(
      `UPDATE teams SET status='allocated', updated_at=NOW() WHERE id=?`,
      [teamId]
    );

    // Step 7: Release lock record (V(semaphore))
    await conn.execute(
      `UPDATE resource_locks SET lock_status='released', released_at=NOW() WHERE id=?`,
      [lockId]
    );

    // Step 8: Log scheduler event
    await conn.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status,metadata)
       VALUES (?,?,'ALLOCATED','queued','allocated',?)`,
      [uuidv4(), requestId, JSON.stringify({ allocationId, mentorId, teamId })]
    );

    await conn.commit();
    return { success: true, allocationId };

  } catch (err: any) {
    if (conn) {
      try {
        await conn.execute(
          `UPDATE resource_locks SET lock_status='failed', released_at=NOW() WHERE id=?`,
          [lockId]
        );
        await conn.rollback();
      } catch { /* best-effort rollback */ }
    }
    return { success: false, reason: err.message || 'Allocation failed' };
  } finally {
    if (conn) conn.release();
    release(); // Release in-process mutex (V(semaphore))
  }
}

export async function releaseAllocation(allocationId: string): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<any[]>(
      'SELECT * FROM allocations WHERE id=? FOR UPDATE',
      [allocationId]
    );
    if (!rows[0] || rows[0].status !== 'active') throw new Error('Allocation not found or not active');

    await conn.execute(
      `UPDATE allocations SET status='cancelled', released_at=NOW() WHERE id=?`,
      [allocationId]
    );
    await conn.execute(
      `UPDATE mentor_requests SET status='cancelled', updated_at=NOW() WHERE id=?`,
      [rows[0].request_id]
    );
    await conn.execute(
      `UPDATE teams SET status='active', updated_at=NOW() WHERE id=?`,
      [rows[0].team_id]
    );
    await conn.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status) VALUES (?,?,'RELEASED','active','cancelled')`,
      [uuidv4(), rows[0].request_id]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback(); throw e;
  } finally {
    conn.release();
  }
}
