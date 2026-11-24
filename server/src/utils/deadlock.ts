/**
 * Deadlock Detection (OS Concept)
 *
 * Implements a wait-for graph over mentor_requests and allocations.
 * Nodes are teams (processes). An edge T_a -> T_b means team A is waiting
 * for a mentor slot that is currently held by team B.
 *
 * A cycle in this graph with single-instance resources indicates deadlock.
 * With multi-instance resources (max_capacity > 1) this is a heuristic;
 * the full multi-instance detection requires Banker-style analysis.
 *
 * Recovery: cancel the most-recently-enqueued request in the cycle (youngest
 * process victim selection) to break the cycle.
 */
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface WFGEdge {
  from: string; // team waiting
  to: string;   // team holding the resource (mentor)
  mentorId: string;
}

export interface DeadlockResult {
  hasDeadlock: boolean;
  cycles: string[][];
  recovered: string[];
  message: string;
}

/** Build the wait-for graph from the current DB state. */
async function buildWFG(): Promise<{ edges: WFGEdge[]; enqueueMap: Map<string, Date> }> {
  // Waiting teams (want a mentor slot)
  const [waiting] = await pool.execute<RowDataPacket[]>(
    `SELECT mr.team_id, mr.mentor_id, mr.enqueue_time
       FROM mentor_requests mr
      WHERE mr.status IN ('pending','queued','waiting')`
  );

  // Teams currently holding each mentor (allocated)
  const [holding] = await pool.execute<RowDataPacket[]>(
    `SELECT a.team_id, a.mentor_id
       FROM allocations a
      WHERE a.status = 'active'`
  );

  // Build a map: mentorId -> set of teams currently holding a slot
  const holdMap = new Map<string, Set<string>>();
  for (const row of holding as any[]) {
    if (!holdMap.has(row.mentor_id)) holdMap.set(row.mentor_id, new Set());
    holdMap.get(row.mentor_id)!.add(row.team_id);
  }

  const edges: WFGEdge[] = [];
  const enqueueMap = new Map<string, Date>();

  for (const row of waiting as any[]) {
    enqueueMap.set(row.team_id, new Date(row.enqueue_time));
    const holders = holdMap.get(row.mentor_id);
    if (!holders) continue;
    for (const holder of holders) {
      if (holder !== row.team_id) {
        edges.push({ from: row.team_id, to: holder, mentorId: row.mentor_id });
      }
    }
  }

  return { edges, enqueueMap };
}

/** DFS-based cycle detection on the adjacency list. Returns all cycles found. */
function detectCycles(edges: WFGEdge[]): string[][] {
  // Build adjacency list (team -> set of teams it waits for)
  const adj = new Map<string, Set<string>>();
  const nodes = new Set<string>();
  for (const e of edges) {
    nodes.add(e.from); nodes.add(e.to);
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from)!.add(e.to);
  }

  const visited  = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];
  const cycles: string[][] = [];

  function dfs(node: string): void {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || new Set();
    for (const nbr of neighbors) {
      if (!visited.has(nbr)) {
        dfs(nbr);
      } else if (recStack.has(nbr)) {
        // Found a cycle: extract the cycle portion from path
        const idx = path.indexOf(nbr);
        if (idx !== -1) {
          cycles.push([...path.slice(idx), nbr]);
        }
      }
    }

    path.pop();
    recStack.delete(node);
  }

  for (const node of nodes) {
    if (!visited.has(node)) dfs(node);
  }

  return cycles;
}

/** Run deadlock detection and optionally recover by cancelling victim requests. */
export async function runDeadlockDetection(recover = false): Promise<DeadlockResult> {
  const { edges, enqueueMap } = await buildWFG();
  const cycles = detectCycles(edges);

  if (cycles.length === 0) {
    return { hasDeadlock: false, cycles: [], recovered: [], message: 'No deadlock detected' };
  }

  const recovered: string[] = [];

  if (recover) {
    for (const cycle of cycles) {
      // Victim selection: cancel the most-recently-enqueued team in the cycle
      let victim = cycle[0];
      let latestTime = enqueueMap.get(cycle[0]) || new Date(0);
      for (const teamId of cycle) {
        const t = enqueueMap.get(teamId);
        if (t && t > latestTime) { latestTime = t; victim = teamId; }
      }

      // Cancel all waiting requests for the victim team
      await pool.execute(
        `UPDATE mentor_requests
            SET status = 'failed',
                failure_reason = 'Cancelled by deadlock recovery (cycle detected)',
                completion_time = NOW(), updated_at = NOW()
          WHERE team_id = ? AND status IN ('pending','queued','waiting')`,
        [victim]
      );

      await pool.execute(
        `INSERT INTO scheduler_events (id, request_id, event_type, old_status, new_status, metadata)
              SELECT UUID(), id, 'DEADLOCK_RECOVERY', status, 'failed',
                     JSON_OBJECT('cycle', ?, 'victim', ?)
                FROM mentor_requests
               WHERE team_id = ? LIMIT 1`,
        [JSON.stringify(cycle), victim, victim]
      );

      recovered.push(victim);
    }
  }

  return {
    hasDeadlock: true,
    cycles,
    recovered,
    message: 'Deadlock detected in ' + cycles.length + ' cycle(s)' + (recover ? '; victim(s) cancelled: ' + recovered.join(', ') : ''),
  };
}