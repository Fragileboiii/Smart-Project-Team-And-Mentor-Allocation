import { describe, it, expect } from 'vitest';
import { safetyAlgorithm, simulateRequest, computeNeed, BankersState } from '../algorithms/bankersAlgorithm';

const safeState: BankersState = {
  processes: ['P0', 'P1', 'P2', 'P3', 'P4'],
  resources: ['A', 'B', 'C'],
  available: [3, 3, 2],
  max: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3],
  ],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2],
  ],
};

describe('Banker\'s Algorithm', () => {
  it('computes Need = Max - Allocation', () => {
    const need = computeNeed(safeState.max, safeState.allocation);
    expect(need[0]).toEqual([7, 4, 3]);
    expect(need[1]).toEqual([1, 2, 2]);
  });

  it('identifies a safe state and returns a valid sequence', () => {
    const result = safetyAlgorithm(safeState);
    expect(result.isSafe).toBe(true);
    expect(result.safeSequence).toHaveLength(5);
    // All processes must appear
    const sorted = [...result.safeSequence].sort();
    expect(sorted).toEqual(['P0','P1','P2','P3','P4']);
  });

  it('identifies an unsafe state', () => {
    const unsafe: BankersState = {
      ...safeState,
      available: [0, 0, 0], // no resources available
    };
    const result = safetyAlgorithm(unsafe);
    expect(result.isSafe).toBe(false);
  });

  it('grants a valid safe request', () => {
    // P1 requests [1,0,2] — classic textbook example
    const result = simulateRequest(safeState, 1, [1, 0, 2]);
    expect(result.granted).toBe(true);
    expect(result.safetyResult?.isSafe).toBe(true);
  });

  it('rejects a request that exceeds need', () => {
    // P0 max need A is 7, allocation is 0, so need is 7. Request 8.
    const result = simulateRequest(safeState, 0, [8, 0, 0]);
    expect(result.granted).toBe(false);
    expect(result.reason).toMatch(/exceeds Need/);
  });

  it('rejects a request that exceeds available', () => {
    const result = simulateRequest(safeState, 0, [4, 0, 0]);
    expect(result.granted).toBe(false);
    expect(result.reason).toMatch(/exceeds Available/);
  });

  it('rejects a request that would cause unsafe state', () => {
    // Create a state where granting leads to deadlock
    const tightState: BankersState = {
      processes: ['T0', 'T1'],
      resources: ['M0'],
      available: [1],
      max: [[3], [2]],
      allocation: [[1], [1]],
    };
    // T0 needs 2, T1 needs 1. Available is 1. Granting 1 to T0 leaves T0 needing 1 with 0 available -> unsafe
    const result = simulateRequest(tightState, 0, [1]);
    expect(result.granted).toBe(false);
  });
});
