/**
 * Banker's Algorithm (Deadlock Avoidance)
 *
 * Educational simulator — separate from production allocation.
 * Implements Dijkstra's Banker's Algorithm to determine if a
 * system state is safe and whether a resource request can be granted.
 *
 * Terminology:
 *   n = number of processes (teams/students)
 *   m = number of resource types (mentor categories)
 *   Available[j]       = number of available instances of resource j
 *   Max[i][j]          = max demand of process i for resource j
 *   Allocation[i][j]   = resources currently allocated to process i
 *   Need[i][j]         = Max[i][j] - Allocation[i][j]
 */

export interface BankersState {
  processes: string[];        // e.g. ["Team A", "Team B", ...]
  resources: string[];        // e.g. ["Mentor-OS", "Mentor-ML", ...]
  available: number[];        // Available[j]
  max: number[][];            // Max[i][j]
  allocation: number[][];     // Allocation[i][j]
}

export interface SafetyResult {
  isSafe: boolean;
  safeSequence: string[];
  steps: SafetyStep[];
  need: number[][];
}

export interface SafetyStep {
  process: string;
  work: number[];
  need: number[];
  allocation: number[];
  canProceed: boolean;
  workAfter: number[];
}

export interface RequestResult {
  granted: boolean;
  reason: string;
  newState?: BankersState;
  safetyResult?: SafetyResult;
}

/** Compute Need matrix from Max and Allocation */
export function computeNeed(max: number[][], allocation: number[][]): number[][] {
  return max.map((row, i) => row.map((val, j) => val - allocation[i][j]));
}

/** Safety Algorithm — returns safe sequence or empty if unsafe */
export function safetyAlgorithm(state: BankersState): SafetyResult {
  const { processes, available, max, allocation } = state;
  const n = processes.length;
  const m = available.length;
  const need = computeNeed(max, allocation);

  const work = [...available];
  const finish = new Array(n).fill(false);
  const safeSequence: string[] = [];
  const steps: SafetyStep[] = [];

  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < n; i++) {
      if (finish[i]) continue;
      // Can process i proceed? Need[i] <= Work?
      const canProceed = need[i].every((v, j) => v <= work[j]);
      steps.push({
        process: processes[i],
        work: [...work],
        need: [...need[i]],
        allocation: [...allocation[i]],
        canProceed,
        workAfter: canProceed ? work.map((w, j) => w + allocation[i][j]) : [...work],
      });
      if (canProceed) {
        // Process completes — releases its allocation
        for (let j = 0; j < m; j++) work[j] += allocation[i][j];
        finish[i] = true;
        safeSequence.push(processes[i]);
        progress = true;
      }
    }
  }

  const isSafe = finish.every(Boolean);
  return { isSafe, safeSequence, steps, need };
}

/**
 * Simulate a resource request from a process.
 * Returns whether the request can be granted while keeping the system safe.
 */
export function simulateRequest(
  state: BankersState,
  processIndex: number,
  request: number[]
): RequestResult {
  const { processes, available, max, allocation } = state;
  const n = processes.length;
  const m = available.length;
  const need = computeNeed(max, allocation);

  // Step 1: Validate request <= Need
  for (let j = 0; j < m; j++) {
    if (request[j] > need[processIndex][j]) {
      return {
        granted: false,
        reason: `Request[${j}]=${request[j]} exceeds Need[${processIndex}][${j}]=${need[processIndex][j]}. Process exceeded its maximum claim.`,
      };
    }
  }

  // Step 2: Validate request <= Available
  for (let j = 0; j < m; j++) {
    if (request[j] > available[j]) {
      return {
        granted: false,
        reason: `Request[${j}]=${request[j]} exceeds Available[${j}]=${available[j]}. Must wait.`,
      };
    }
  }

  // Step 3: Pretend to allocate — check if resulting state is safe
  const newAvailable = available.map((v, j) => v - request[j]);
  const newAllocation = allocation.map((row, i) =>
    i === processIndex ? row.map((v, j) => v + request[j]) : [...row]
  );
  const newMax = max.map(row => [...row]);

  const newState: BankersState = {
    processes, resources: state.resources,
    available: newAvailable,
    max: newMax,
    allocation: newAllocation,
  };

  const safetyResult = safetyAlgorithm(newState);

  if (safetyResult.isSafe) {
    return {
      granted: true,
      reason: `Request granted. Safe sequence: ${safetyResult.safeSequence.join(' → ')}`,
      newState,
      safetyResult,
    };
  } else {
    return {
      granted: false,
      reason: 'Granting this request would leave the system in an unsafe state (potential deadlock). Request denied.',
      safetyResult,
    };
  }
}

/** Build a Banker's state from current DB mentor capacity for demo */
export function buildStateFromCapacity(
  mentors: { id: string; name: string; max_capacity: number; active_allocations: number }[],
  teams: { id: string; name: string }[],
  allocations: { team_id: string; mentor_id: string }[]
): BankersState {
  const resources = mentors.map(m => m.name);
  const available = mentors.map(m => m.max_capacity - m.active_allocations);
  const processes = teams.map(t => t.name);

  const max = teams.map(() => mentors.map(m => Math.min(1, m.max_capacity)));
  const allocation = teams.map(t =>
    mentors.map(m => allocations.filter(a => a.team_id === t.id && a.mentor_id === m.id).length)
  );

  return { processes, resources, available, max, allocation };
}
