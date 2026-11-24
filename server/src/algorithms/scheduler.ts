/**
 * Request Scheduler
 *
 * OS CPU Scheduling Concepts demonstrated:
 * - FCFS (First-Come First-Served): requests processed in enqueue_time order
 * - Priority Scheduling: requests processed by descending priority_score
 * - Priority Aging: waiting requests gain score over time to prevent starvation
 * - Round Robin: a ready queue is processed cyclically; a request that cannot
 *   be allocated returns to the back of the queue and receives another turn on
 *   the next scheduler tick (fair sharing among waiting requests).
 * - Request timeouts: requests waiting longer than request_timeout_seconds are
 *   failed automatically.
 *
 * Request states: pending -> queued -> processing -> allocated/rejected/failed/waiting
 */

import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2/promise';
import { allocateMentor } from './allocationEngine';

export type SchedulerAlgorithm = 'FCFS' | 'PRIORITY' | 'ROUND_ROBIN';

interface RequestRow extends RowDataPacket {
  id: string; team_id: string; mentor_id: string; cycle_id: string;
  status: string; priority: number; priority_score: number; enqueue_time: Date;
}

// Priority aging: each minute a request waits increases its score by agingRate
function applyAging(score: number, enqueueTime: Date, agingRate: number): number {
  const waitMinutes = (Date.now() - new Date(enqueueTime).getTime()) / 60000;
  return score + waitMinutes * agingRate;
}

async function getRequestTimeoutSeconds(): Promise<number> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='request_timeout_seconds'"
    );
    if (rows[0]) {
      const v = parseInt(rows[0].value, 10);
      if (!Number.isNaN(v)) return v;
    }
  } catch { /* settings key may not exist yet */ }
  return 600; // default 10 minutes
}

export async function runScheduler(
  algorithm: SchedulerAlgorithm = 'FCFS',
  userId: string,
  agingRate = 0.1
): Promise<{ processed: number; allocated: number; waiting: number; failed: number; timedOut: number }> {
  const [requests] = await pool.execute<RequestRow[]>(
    `SELECT * FROM mentor_requests WHERE status IN ('pending','queued','waiting') ORDER BY enqueue_time ASC`
  );

  if (requests.length === 0) return { processed: 0, allocated: 0, waiting: 0, failed: 0, timedOut: 0 };

  // Mark all as queued
  for (const r of requests) {
    await pool.execute(
      `UPDATE mentor_requests SET status='queued', updated_at=NOW() WHERE id=?`,
      [r.id]
    );
  }

  // 1. Timeout sweep: fail requests that have waited longer than the configured limit
  const timeoutSec = await getRequestTimeoutSeconds();
  const nowMs = Date.now();
  let timedOut = 0;
  const live: RequestRow[] = [];
  for (const r of requests) {
    const waitedSec = (nowMs - new Date(r.enqueue_time).getTime()) / 1000;
    if (timeoutSec > 0 && waitedSec > timeoutSec) {
      await pool.execute(
        `UPDATE mentor_requests SET status='failed', failure_reason=?, completion_time=NOW(), updated_at=NOW() WHERE id=?`,
        ['Request timed out (waited ' + Math.round(waitedSec) + 's, limit ' + timeoutSec + 's)', r.id]
      );
      await pool.execute(
        `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status,metadata) VALUES (?,?,'TIMEOUT','queued','failed',?)`,
        [uuidv4(), r.id, JSON.stringify({ waitedSec: Math.round(waitedSec), limit: timeoutSec })]
      );
      timedOut++;
    } else {
      live.push(r);
    }
  }

  // 2. Order according to algorithm
  const processedCount = live.length;
  let ordered: RequestRow[] = [];
  if (algorithm === 'PRIORITY') {
    ordered = live
      .map(r => ({ r: r, _aged: applyAging(r.priority_score, r.enqueue_time, agingRate) }))
      .sort((a, b) => b._aged - a._aged)
      .map(x => x.r);
  } else if (algorithm !== 'ROUND_ROBIN') {
    // FCFS starts from a FIFO ready queue
    ordered = live.sort((a, b) => new Date(a.enqueue_time).getTime() - new Date(b.enqueue_time).getTime());
  }

  let allocated = 0, waiting = 0, failed = 0;

  const tryAllocate = async (req: RequestRow): Promise<'allocated' | 'waiting' | 'failed'> => {
    await pool.execute(
      `UPDATE mentor_requests SET status='processing', processing_start=NOW(), updated_at=NOW() WHERE id=?`,
      [req.id]
    );
    await pool.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status) VALUES (?,?,'PROCESSING_START','queued','processing')`,
      [uuidv4(), req.id]
    );
    const result = await allocateMentor(req.id, req.team_id, req.mentor_id, req.cycle_id, userId);
    if (result.success) return 'allocated';
    if (result.reason && result.reason.toLowerCase().includes('capacity')) return 'waiting';
    return 'failed';
  };

  const markWaiting = async (req: RequestRow) => {
    await pool.execute(
      `UPDATE mentor_requests SET status='waiting', updated_at=NOW() WHERE id=?`,
      [req.id]
    );
  };

  const markFailed = async (req: RequestRow, reason: string) => {
    failed++;
    await pool.execute(
      `UPDATE mentor_requests SET status='failed', failure_reason=?, completion_time=NOW(), updated_at=NOW() WHERE id=?`,
      [reason, req.id]
    );
  };

  if (algorithm === 'ROUND_ROBIN') {
    // ── Persistent cursor: resume from where last tick left off ───────────────
    const [cursorRows] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM system_settings WHERE key_name='rr_last_request_id'"
    );
    const lastId: string = (cursorRows[0] as any)?.value || '';

    // Sort by enqueue_time (FIFO base order)
    let rrOrdered: RequestRow[] = live.sort(
      (a, b) => new Date(a.enqueue_time).getTime() - new Date(b.enqueue_time).getTime()
    );

    // Rotate: start processing after the last-served request
    if (lastId) {
      const idx = rrOrdered.findIndex(r => r.id === lastId);
      if (idx !== -1 && idx < rrOrdered.length - 1) {
        // Start from the request AFTER the last served one
        rrOrdered = [...rrOrdered.slice(idx + 1), ...rrOrdered.slice(0, idx + 1)];
      }
      // If idx === last element or not found, wrap around to the beginning
    }

    // One quantum (one allocation attempt) per request per tick
    const queue: RequestRow[] = [...rrOrdered];
    const turns = queue.length;
    let lastAttempted = lastId;

    for (let turn = 0; turn < turns && queue.length > 0; turn++) {
      const req = queue.shift() as RequestRow;
      lastAttempted = req.id;
      const outcome = await tryAllocate(req);
      if (outcome === 'allocated') {
        allocated++;
      } else if (outcome === 'waiting') {
        waiting++;
        queue.push(req); // back of queue — gets another turn next tick
      } else {
        await markFailed(req, 'Allocation failed during round-robin turn');
      }
    }

    // Mark any requests still in queue (couldn't be allocated this tick) as waiting
    for (const req of queue) {
      await markWaiting(req);
    }

    // Persist cursor for next tick
    if (lastAttempted) {
      await pool.execute(
        "UPDATE system_settings SET value=? WHERE key_name='rr_last_request_id'",
        [lastAttempted]
      );
    }
  } else {
    for (const req of ordered) {
      const outcome = await tryAllocate(req);
      if (outcome === 'allocated') {
        allocated++;
      } else if (outcome === 'waiting') {
        waiting++;
        await markWaiting(req);
      } else {
        await markFailed(req, 'Allocation failed');
      }
    }
  }

  return { processed: processedCount, allocated, waiting, failed, timedOut };
}

export async function getSchedulerMetrics() {
  const [counts] = await pool.execute<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS cnt FROM mentor_requests GROUP BY status`
  );

  const [timing] = await pool.execute<RowDataPacket[]>(
    `SELECT
       AVG(TIMESTAMPDIFF(SECOND, enqueue_time, completion_time)) AS avg_turnaround_sec,
       AVG(TIMESTAMPDIFF(SECOND, enqueue_time, processing_start)) AS avg_wait_sec,
       COUNT(CASE WHEN status='allocated' THEN 1 END) AS throughput
     FROM mentor_requests WHERE completion_time IS NOT NULL`
  );

  return { counts, timing: timing[0] };
}