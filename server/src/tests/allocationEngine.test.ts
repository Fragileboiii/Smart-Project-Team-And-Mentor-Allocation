import { describe, it, expect, vi } from 'vitest';
import { allocateMentor } from '../algorithms/allocationEngine';

/**
 * Concurrency test: simulate N concurrent allocation requests against
 * a mentor with capacity C. Exactly C should succeed; the rest should fail.
 *
 * The DB pool is mocked to exercise the in-process mutex + capacity-check logic.
 * The in-process semaphore is also mocked so the test isolates the mutex
 * serialization and the database capacity gate.
 */

vi.mock('../config/database', () => {
  let activeCount = 0;
  const CAPACITY = 5;

  const mockMentorRow = {
    id: 'mentor-1', first_name: 'Dr', last_name: 'Test',
    max_capacity: CAPACITY, active_allocations: 0,
    remaining_capacity: CAPACITY, is_available: true,
  };

  const mockConnection = {
    execute: vi.fn(async (_sql: string, _params?: any[]) => {
      // resource_locks inserts/updates and scheduler_events inserts
      return [{ affectedRows: 1 }];
    }),
    query: vi.fn(async (sql: string, _params?: any[]) => {
      if (sql.includes('CALL allocate_mentor')) {
        // Simulate procedure: grant if capacity remains
        if (activeCount < CAPACITY) {
          activeCount++;
          (mockConnection as any)._lastCallGranted = true;
        } else {
          (mockConnection as any)._lastCallGranted = false;
        }
        return [[]]; // CALL returns empty result sets
      }
      if (sql.includes('SELECT @alloc_id')) {
        // Reflect whether the most recent CALL granted this allocation
        const granted = (mockConnection as any)._lastCallGranted;
        (mockConnection as any)._lastCallGranted = false; // consume flag
        if (granted) {
          return [[{ alloc_id: 'alloc-' + activeCount, ok: 1 }]];
        }
        return [[{ alloc_id: null, ok: 0 }]];
      }
      return [[]];
    }),
    release: vi.fn(),
    _lastCallGranted: false,
  };

  return {
    default: {
      getConnection: vi.fn(async () => mockConnection),
      // pool.execute used by Banker's gate and listMentorsWithCapacity
      execute: vi.fn(async (sql: string) => {
        // listMentorsWithCapacity query
        if (typeof sql === 'string' && sql.includes('mentors m') && sql.includes('first_name')) {
          return [[{ ...mockMentorRow, active_allocations: 0, remaining_capacity: CAPACITY }]];
        }
        // Banker gate: active allocations query
        if (typeof sql === 'string' && sql.includes("status='active'") && sql.includes('team_id') && sql.includes('mentor_id')) {
          return [[]];
        }
        // Banker gate: team requests query
        if (typeof sql === 'string' && sql.includes('mentor_requests') && sql.includes('team_id')) {
          return [[]];
        }
        return [[{ affectedRows: 1 }]];
      }),
    },
  };
});

vi.mock('../utils/semaphore', () => ({
  acquirePermit: vi.fn(async () => {}),
  releasePermit: vi.fn(() => {}),
  initSemaphores: vi.fn(async () => {}),
  getSemaphoreState: vi.fn(() => undefined),
}));

describe('Allocation Engine concurrency', () => {
  it('allows exactly CAPACITY=5 allocations from 20 concurrent requests', async () => {
    const CAPACITY = 5;
    const REQUESTS = 20;

    const requests = Array.from({ length: REQUESTS }, (_, i) =>
      allocateMentor('req-' + i, 'team-' + i, 'mentor-1', 'cycle-1', 'user-1')
    );

    const results = await Promise.all(requests);

    const successes = results.filter(r => r.success);
    const failures  = results.filter(r => !r.success);

    expect(successes.length).toBe(CAPACITY);
    expect(failures.length).toBe(REQUESTS - CAPACITY);
  }, 15000);
});