/**
 * Allocation Engine
 *
 * OS Concepts demonstrated:
 * 1. Mutex: in-process Map-based promise chain serializes requests per mentor.
 * 2. Row-level locking: SELECT ... FOR UPDATE inside a MySQL transaction.
 * 3. ACID Transactions: BEGIN / COMMIT / ROLLBACK across multiple tables.
 * 4. Deadlock avoidance: single-row lock order prevents circular waits.
 * 5. MySQL 1213 retry: exponential backoff when MySQL kills us as deadlock victim.
 */

import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { getMentorWithCapacityLocked, listMentorsWithCapacity } from '../repositories/mentorRepository';
import { PoolConnection } from 'mysql2/promise';
import { acquirePermit, releasePermit } from '../utils/semaphore';
import { safetyAlgorithm, BankersState } from './bankersAlgorithm';

// ── MySQL 1213 (deadlock victim) retry with exponential backoff ───────────────
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── In-process mutex map ──────────────────────────────────────────────────────
const mentorMutex: Map<string, Promise<void>> = new Map();

function acquireMutex(mentorId: string): { release: () => void; wait: Promise<void> } {
  let release!: () => void;
  const previous = mentorMutex.get(mentorId) || Promise.resolve();
  const current = new Promise<void>(resolve => { release = resolve; });
  mentorMutex.set(mentorId, previous.then(() => current));
  return { release, wait: previous };
}

// ── Single allocation attempt (throws on DB error so retry wrapper can catch) ─
async function attemptAllocate(
  requestId: string,
  teamId: string,
  mentorId: string,
  cycleId: string,
  _userId: string,
  lockId: string
): Promise<{ success: boolean; allocationId?: string; reason?: string }> {
  // ── Banker's Algorithm safety gate ───────────────────────────────────────────
  {
    // Build live resource state using pool (outside any transaction)
    const mentors = await listMentorsWithCapacity();
    const [allocRows] = await pool.execute<any[]>(
      `SELECT team_id, mentor_id FROM allocations WHERE status='active'`
    );
    const [reqRows] = await pool.execute<any[]>(
      `SELECT DISTINCT team_id FROM mentor_requests WHERE status IN ('allocated','pending','queued','waiting','processing')`
    );

    // Build process list: all teams with existing requests + the requesting team
    const teamSet = new Set<string>(reqRows.map((r: any) => r.team_id));
    teamSet.add(teamId);
    const processes = Array.from(teamSet);
    const teamIndex = processes.indexOf(teamId);

    // Resources = mentors
    const resources = mentors.map(m => `${m.first_name} ${m.last_name}`);
    const mentorIndex = mentors.findIndex(m => m.id === mentorId);

    if (mentorIndex === -1) {
      return { success: false, reason: 'Mentor not found' };
    }

    // available = remaining_capacity per mentor (simulate granting this request)
    const available = mentors.map((m, j) => {
      const rem = Number(m.remaining_capacity);
      return j === mentorIndex ? rem - 1 : rem;
    });

    // max[i][j] = 1 for every process/resource pair (each team needs at most 1 mentor)
    const max = processes.map(() => mentors.map(() => 1));

    // allocation[i][j] = 1 if team i has active allocation with mentor j
    const allocation = processes.map((pTeamId, i) =>
      mentors.map((m, j) => {
        const hasAlloc = (allocRows as any[]).some(
          (a: any) => a.team_id === pTeamId && a.mentor_id === m.id
        );
        // Also count the simulated grant for the requesting team
        if (i === teamIndex && j === mentorIndex) return hasAlloc ? 1 : 1;
        return hasAlloc ? 1 : 0;
      })
    );

    const state: BankersState = { processes, resources, available, max, allocation };
    const safetyResult = safetyAlgorithm(state);

    if (!safetyResult.isSafe) {
      // Leave as waiting with a coded reason
      await pool.execute(
        `UPDATE mentor_requests SET status='waiting', failure_reason=?, updated_at=NOW() WHERE id=?`,
        [`BANKER_UNSAFE: Granting this slot would leave the system in an unsafe state. Safe sequence not found.`, requestId]
      );
      return {
        success: false,
        reason: 'BANKER_UNSAFE: Granting this slot would leave the system in an unsafe state',
      };
    }
    // State is safe — proceed with allocation
  }

  let conn: PoolConnection | undefined;
  try {
    conn = await pool.getConnection();
    // Note: NO beginTransaction() here — the stored procedure owns its own transaction

    // Insert lock record (TypeScript-managed, not part of the procedure)
    await conn.execute(
      `INSERT INTO resource_locks (id, resource_id, held_by, acquired_at, lock_status)
       VALUES (?, ?, ?, NOW(), 'acquired')`,
      [lockId, mentorId, requestId]
    );

    // Call the stored procedure — it handles: capacity check, duplicate check,
    // INSERT allocations, UPDATE mentor_requests, UPDATE teams, INSERT audit_logs
    await conn.query(
      `CALL allocate_mentor(?, ?, ?, ?, ?, @alloc_id, @ok)`,
      [requestId, teamId, mentorId, cycleId, _userId]
    );

    // Read OUT parameters
    const [outRows] = await conn.query<any[]>(
      `SELECT @alloc_id AS alloc_id, @ok AS ok`
    );
    const outRow = Array.isArray(outRows) ? outRows[0] : outRows;
    const ok = Number(outRow?.ok) === 1;
    const allocationId = outRow?.alloc_id as string | null;

    // Release lock record
    await conn.execute(
      `UPDATE resource_locks SET lock_status='released', released_at=NOW() WHERE id=?`,
      [lockId]
    );

    if (!ok) {
      // Procedure set request to 'waiting' or did a rollback
      return { success: false, reason: 'No capacity available or duplicate allocation' };
    }

    // Log scheduler event (procedure writes audit_log but not scheduler_events)
    await conn.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status,metadata)
       VALUES (?,?,'ALLOCATED','queued','allocated',?)`,
      [uuidv4(), requestId, JSON.stringify({ allocationId, mentorId, teamId })]
    );

    return { success: true, allocationId: allocationId! };

  } catch (err: any) {
    if (conn) {
      try {
        await conn.execute(
          `UPDATE resource_locks SET lock_status='failed', released_at=NOW() WHERE id=?`,
          [lockId]
        );
      } catch { /* best-effort */ }
    }
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// ── Public allocation function ────────────────────────────────────────────────
export async function allocateMentor(
  requestId: string,
  teamId: string,
  mentorId: string,
  cycleId: string,
  userId: string
): Promise<{ success: boolean; allocationId?: string; reason?: string }> {
  const { release, wait } = acquireMutex(mentorId);
  await wait;

  let allocated = false;
  let permitAcquired = false;
  const lockId = uuidv4();

  try {
    await acquirePermit(mentorId);
    permitAcquired = true;

    let attempt = 0;
    while (true) {
      try {
        const result = await attemptAllocate(requestId, teamId, mentorId, cycleId, userId, lockId);
        if (result.success) allocated = true;
        return result;
      } catch (err: any) {
        if ((err.errno === 1213 || err.code === 'ER_LOCK_DEADLOCK') && attempt < MAX_RETRIES) {
          attempt++;
          await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt - 1));
          continue;
        }
        return { success: false, reason: err.message || 'Allocation failed' };
      }
    }

  } finally {
    release();
    if (!allocated && permitAcquired) releasePermit(mentorId);
  }
}

// ── Release / cancel an allocation ────────────────────────────────────────────
export async function releaseAllocation(allocationId: string): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<any[]>(
      'SELECT * FROM allocations WHERE id=? FOR UPDATE',
      [allocationId]
    );
    if (!rows[0] || rows[0].status !== 'active') throw new Error('Allocation not found or not active');

    await conn.execute(`UPDATE allocations SET status='cancelled', released_at=NOW() WHERE id=?`, [allocationId]);
    await conn.execute(`UPDATE mentor_requests SET status='cancelled', updated_at=NOW() WHERE id=?`, [rows[0].request_id]);
    await conn.execute(`UPDATE teams SET status='active', updated_at=NOW() WHERE id=?`, [rows[0].team_id]);
    await conn.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status) VALUES (?,?,'RELEASED','active','cancelled')`,
      [uuidv4(), rows[0].request_id]
    );
    await conn.commit();
    // Release semaphore permit so the next blocked request can wake
    releasePermit(rows[0].mentor_id);
  } catch (e) {
    await conn.rollback(); throw e;
  } finally {
    conn.release();
  }
}

// ── Admin mentor reassignment ─────────────────────────────────────────────────
export async function reassignAllocation(
  allocationId: string,
  newMentorId: string,
  _userId: string
): Promise<{ success: boolean; newAllocationId?: string; reason?: string }> {
  const { release, wait } = acquireMutex(newMentorId);
  await wait;

  let conn: PoolConnection | undefined;
  const lockId = uuidv4();
  let allocated = false;
  let permitAcquired = false;
  let oldMentorId: string | undefined;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute<any[]>(
      'SELECT * FROM allocations WHERE id=? FOR UPDATE',
      [allocationId]
    );
    if (!rows[0] || rows[0].status !== 'active') {
      throw Object.assign(new Error('Active allocation not found'), { status: 404 });
    }
    const old = rows[0];
    oldMentorId = old.mentor_id;
    if (old.mentor_id === newMentorId) {
      throw Object.assign(new Error('New mentor is the same as the current mentor'), { status: 400 });
    }

    await acquirePermit(newMentorId);
    permitAcquired = true;

    await conn.execute(
      `INSERT INTO resource_locks (id, resource_id, held_by, acquired_at, lock_status) VALUES (?, ?, ?, NOW(), 'acquired')`,
      [lockId, newMentorId, old.request_id]
    );
    const mentor = await getMentorWithCapacityLocked(newMentorId, conn);
    if (!mentor) throw Object.assign(new Error('Mentor not found'), { status: 404 });
    if (!mentor.is_available || mentor.remaining_capacity <= 0) {
      throw Object.assign(new Error('New mentor has no available capacity'), { status: 409 });
    }

    await conn.execute(`UPDATE allocations SET status='reassigned', released_at=NOW() WHERE id=?`, [allocationId]);
    const newAllocId = uuidv4();
    await conn.execute(
      `INSERT INTO allocations (id,team_id,mentor_id,cycle_id,request_id,status,allocated_at) VALUES (?,?,?,?,?,'active',NOW())`,
      [newAllocId, old.team_id, newMentorId, old.cycle_id, old.request_id]
    );
    await conn.execute(`UPDATE mentor_requests SET mentor_id=?, status='allocated', updated_at=NOW() WHERE id=?`, [newMentorId, old.request_id]);
    await conn.execute(`UPDATE resource_locks SET lock_status='released', released_at=NOW() WHERE id=?`, [lockId]);
    await conn.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status,metadata) VALUES (?,?,'REASSIGNED','allocated','allocated',?)`,
      [uuidv4(), old.request_id, JSON.stringify({ from: old.mentor_id, to: newMentorId })]
    );

    await conn.commit();
    allocated = true;
    return { success: true, newAllocationId: newAllocId };

  } catch (err: any) {
    if (conn) {
      try {
        await conn.execute(`UPDATE resource_locks SET lock_status='failed', released_at=NOW() WHERE id=?`, [lockId]);
        await conn.rollback();
      } catch { /* best-effort */ }
    }
    return { success: false, reason: err.message || 'Reassignment failed' };
  } finally {
    if (conn) conn.release();
    release();
    if (!allocated && permitAcquired) releasePermit(newMentorId);
    if (allocated && oldMentorId) releasePermit(oldMentorId);
  }
}