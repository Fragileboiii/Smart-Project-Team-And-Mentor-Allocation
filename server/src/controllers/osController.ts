import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { safetyAlgorithm, simulateRequest, BankersState } from '../algorithms/bankersAlgorithm';
import { listMentorsWithCapacity } from '../repositories/mentorRepository';

export async function getResources(req: Request, res: Response, next: NextFunction) {
  try {
    const mentors = await listMentorsWithCapacity();
    const resources = mentors.map(m => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
      maxCapacity: m.max_capacity,
      activeAllocations: Number(m.active_allocations),
      remainingCapacity: Number(m.remaining_capacity),
      isAvailable: m.is_available,
    }));
    return res.json(resources);
  } catch (e) { next(e); }
}

export async function getProcesses(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT mr.id, mr.status, mr.priority_score, mr.enqueue_time,
              mr.processing_start, mr.completion_time, mr.failure_reason,
              t.name AS team_name, u.first_name AS mentor_first, u.last_name AS mentor_last,
              TIMESTAMPDIFF(SECOND, mr.enqueue_time, COALESCE(mr.completion_time, NOW())) AS turnaround_sec,
              TIMESTAMPDIFF(SECOND, mr.enqueue_time, COALESCE(mr.processing_start, NOW())) AS wait_sec
       FROM mentor_requests mr
       JOIN teams t ON t.id = mr.team_id
       JOIN mentors m ON m.id = mr.mentor_id
       JOIN users u ON u.id = m.user_id
       ORDER BY mr.enqueue_time DESC LIMIT 100`
    );
    return res.json(rows);
  } catch (e) { next(e); }
}

export async function getLocks(req: Request, res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rl.*, u.first_name, u.last_name
       FROM resource_locks rl
       LEFT JOIN mentors m ON m.id = rl.resource_id
       LEFT JOIN users u ON u.id = m.user_id
       ORDER BY rl.created_at DESC LIMIT 50`
    );
    return res.json(rows);
  } catch (e) { next(e); }
}

const bankersStateSchema = z.object({
  processes: z.array(z.string()),
  resources: z.array(z.string()),
  available: z.array(z.number()),
  max: z.array(z.array(z.number())),
  allocation: z.array(z.array(z.number())),
});

export async function checkSafety(req: Request, res: Response, next: NextFunction) {
  try {
    const state = bankersStateSchema.parse(req.body) as BankersState;
    const result = safetyAlgorithm(state);
    return res.json(result);
  } catch (e) { next(e); }
}

const simulateRequestSchema = z.object({
  state: bankersStateSchema,
  processIndex: z.number().int().min(0),
  request: z.array(z.number()),
});

export async function simulateBankersRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { state, processIndex, request } = simulateRequestSchema.parse(req.body);
    const result = simulateRequest(state as BankersState, processIndex, request);
    return res.json(result);
  } catch (e) { next(e); }
}

/** Build a resource-allocation graph from current DB state */
export async function getDeadlockGraph(req: Request, res: Response, next: NextFunction) {
  try {
    const [requests] = await pool.execute<RowDataPacket[]>(
      `SELECT mr.id AS req_id, mr.team_id, mr.mentor_id, mr.status,
              t.name AS team_name, u.first_name, u.last_name
       FROM mentor_requests mr
       JOIN teams t ON t.id = mr.team_id
       JOIN mentors m ON m.id = mr.mentor_id
       JOIN users u ON u.id = m.user_id
       WHERE mr.status IN ('pending','queued','waiting','processing')`
    );
    const [allocations] = await pool.execute<RowDataPacket[]>(
      `SELECT a.team_id, a.mentor_id, t.name AS team_name, u.first_name, u.last_name
       FROM allocations a
       JOIN teams t ON t.id = a.team_id
       JOIN mentors m ON m.id = a.mentor_id
       JOIN users u ON u.id = m.user_id
       WHERE a.status='active'`
    );

    // Nodes and edges for wait-for graph
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const a of allocations) {
      nodes.push({ id: a.team_id, label: a.team_name, type: 'team' });
      nodes.push({ id: a.mentor_id, label: `${a.first_name} ${a.last_name}`, type: 'mentor' });
      edges.push({ from: a.mentor_id, to: a.team_id, type: 'assigned' });
    }
    for (const r of requests) {
      nodes.push({ id: r.team_id, label: r.team_name, type: 'team' });
      edges.push({ from: r.team_id, to: r.mentor_id, type: 'requesting' });
    }

    // Deduplicate nodes
    const seen = new Set<string>();
    const uniqueNodes = nodes.filter(n => seen.has(n.id) ? false : (seen.add(n.id), true));

    return res.json({
      nodes: uniqueNodes,
      edges,
      note: 'Resource-allocation graph. A cycle in this graph (with single-instance resources) indicates deadlock. With multiple instances, use Banker\'s algorithm for definitive detection.',
    });
  } catch (e) { next(e); }
}

export async function runSimulation(req: Request, res: Response, next: NextFunction) {
  try {
    const mentors = await listMentorsWithCapacity();
    const [teams] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name FROM teams WHERE status IN (\'forming\',\'active\') LIMIT 10'
    );
    const [allocs] = await pool.execute<RowDataPacket[]>(
      "SELECT team_id, mentor_id FROM allocations WHERE status='active'"
    );

    const state: BankersState = {
      processes: (teams as any[]).map(t => t.name),
      resources: mentors.map(m => `${m.first_name} ${m.last_name}`),
      available: mentors.map(m => Number(m.remaining_capacity)),
      max: (teams as any[]).map(() => mentors.map(m => Math.min(1, m.max_capacity))),
      allocation: (teams as any[]).map(t =>
        mentors.map(m => (allocs as any[]).filter(a => a.team_id === t.id && a.mentor_id === m.id).length)
      ),
    };

    const safety = safetyAlgorithm(state);
    return res.json({ state, safety });
  } catch (e) { next(e); }
}

export async function resetSimulation(req: Request, res: Response, next: NextFunction) {
  return res.json({ message: 'Simulation state is derived from live DB — reset by modifying allocations.' });
}
