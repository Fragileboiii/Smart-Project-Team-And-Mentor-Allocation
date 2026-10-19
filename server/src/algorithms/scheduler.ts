/**
 * Request Scheduler
 *
 * OS Concepts demonstrated:
 * - FCFS (First-Come First-Served): requests processed in enqueue_time order
 * - Priority Scheduling: requests processed by descending priority_score
 * - Priority Aging: waiting requests gain score over time to prevent starvation
 * - Request states: pending → queued → processing → allocated/rejected/failed/waiting
 */

import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2/promise';
import { allocateMentor } from './allocationEngine';

export type SchedulerAlgorithm = 'FCFS' | 'PRIORITY';

interface RequestRow extends RowDataPacket {
  id: string; team_id: string; mentor_id: string; cycle_id: string;
  status: string; priority: number; priority_score: number; enqueue_time: Date;
}

// Priority aging: each minute a request waits increases its score by aging_rate
function applyAging(score: number, enqueueTime: Date, agingRate: number): number {
  const waitMinutes = (Date.now() - new Date(enqueueTime).getTime()) / 60000;
  return score + waitMinutes * agingRate;
}

export async function runScheduler(
  algorithm: SchedulerAlgorithm = 'FCFS',
  userId: string,
  agingRate = 0.1
): Promise<{ processed: number; allocated: number; waiting: number; failed: number }> {
  // Fetch all queued requests
  const [requests] = await pool.execute<RequestRow[]>(
    `SELECT * FROM mentor_requests WHERE status IN ('pending','queued') ORDER BY enqueue_time ASC`
  );

  if (requests.length === 0) return { processed: 0, allocated: 0, waiting: 0, failed: 0 };

  // Mark all as queued
  for (const r of requests) {
    await pool.execute(
      `UPDATE mentor_requests SET status='queued', updated_at=NOW() WHERE id=?`,
      [r.id]
    );
  }

  // Sort according to algorithm
  let sorted: RequestRow[];
  if (algorithm === 'FCFS') {
    sorted = requests.sort((a, b) =>
      new Date(a.enqueue_time).getTime() - new Date(b.enqueue_time).getTime()
    );
  } else {
    // PRIORITY with aging
    sorted = requests
      .map(r => ({ ...r, _aged: applyAging(r.priority_score, r.enqueue_time, agingRate) }))
      .sort((a: any, b: any) => b._aged - a._aged) as RequestRow[];
  }

  let allocated = 0, waiting = 0, failed = 0;

  for (const req of sorted) {
    // Mark processing start
    await pool.execute(
      `UPDATE mentor_requests SET status='processing', processing_start=NOW(), updated_at=NOW() WHERE id=?`,
      [req.id]
    );
    await pool.execute(
      `INSERT INTO scheduler_events (id,request_id,event_type,old_status,new_status)
       VALUES (?,?,'PROCESSING_START','queued','processing')`,
      [uuidv4(), req.id]
    );

    const result = await allocateMentor(req.id, req.team_id, req.mentor_id, req.cycle_id, userId);

    if (result.success) {
      allocated++;
    } else if (result.reason?.includes('capacity')) {
      waiting++;
    } else {
      failed++;
      await pool.execute(
        `UPDATE mentor_requests SET status='failed', failure_reason=?, completion_time=NOW(), updated_at=NOW() WHERE id=?`,
        [result.reason, req.id]
      );
    }
  }

  return { processed: sorted.length, allocated, waiting, failed };
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
