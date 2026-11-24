import { describe, it, expect } from 'vitest';

// Unit test the scheduler ordering logic independently
interface MockRequest {
  id: string;
  enqueue_time: Date;
  priority_score: number;
}

function fcfsSort(requests: MockRequest[]): MockRequest[] {
  return [...requests].sort((a, b) =>
    new Date(a.enqueue_time).getTime() - new Date(b.enqueue_time).getTime()
  );
}

function prioritySort(requests: MockRequest[], agingRate = 0.1): MockRequest[] {
  const now = Date.now();
  return [...requests].sort((a, b) => {
    const ageA = (now - new Date(a.enqueue_time).getTime()) / 60000 * agingRate;
    const ageB = (now - new Date(b.enqueue_time).getTime()) / 60000 * agingRate;
    return (b.priority_score + ageB) - (a.priority_score + ageA);
  });
}

// Round Robin: one quantum (one attempt) per request per cycle. A request that
// cannot be allocated returns to the back of the ready queue and gets another
// turn on the next cycle (cyclic / fair sharing).
function roundRobinCycle(
  requests: MockRequest[],
  tryAllocate: (r: MockRequest) => boolean
): { allocated: MockRequest[]; waiting: MockRequest[]; order: string[] } {
  const queue: MockRequest[] = [...requests];
  const allocated: MockRequest[] = [];
  const order: string[] = [];
  const n = queue.length;
  for (let i = 0; i < n; i++) {
    const req = queue.shift() as MockRequest;
    order.push(req.id);
    if (tryAllocate(req)) {
      allocated.push(req);
    } else {
      queue.push(req); // back of queue (round robin)
    }
  }
  return { allocated, waiting: queue, order };
}

function computeTimeout(requests: MockRequest[], now: number, timeoutSec: number): MockRequest[] {
  return requests.filter(r => timeoutSec > 0 && (now - new Date(r.enqueue_time).getTime()) / 1000 > timeoutSec);
}

describe('Scheduler sorting', () => {
  const base = Date.now();
  const requests: MockRequest[] = [
    { id: 'r3', enqueue_time: new Date(base + 3000), priority_score: 5 },
    { id: 'r1', enqueue_time: new Date(base + 1000), priority_score: 3 },
    { id: 'r2', enqueue_time: new Date(base + 2000), priority_score: 8 },
  ];

  it('FCFS sorts by enqueue_time ascending', () => {
    const sorted = fcfsSort(requests);
    expect(sorted.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('PRIORITY sorts by priority_score descending', () => {
    const sorted = prioritySort(requests);
    expect(sorted[0].id).toBe('r2');
  });

  it('PRIORITY aging increases score of older requests', () => {
    const old: MockRequest[] = [
      { id: 'high-prio',    enqueue_time: new Date(Date.now() - 1000),    priority_score: 10 },
      { id: 'starving',     enqueue_time: new Date(Date.now() - 3600000), priority_score: 1 },
    ];
    const sorted = prioritySort(old, 5);
    expect(sorted[0].id).toBe('starving');
  });
});

describe('Round Robin scheduling', () => {
  it('cycles the ready queue and rotates failed requests to the back', () => {
    const base = Date.now();
    const reqs: MockRequest[] = [
      { id: 'r1', enqueue_time: new Date(base), priority_score: 1 },
      { id: 'r2', enqueue_time: new Date(base + 1000), priority_score: 1 },
      { id: 'r3', enqueue_time: new Date(base + 2000), priority_score: 1 },
    ];
    // r2 cannot be allocated on its turn -> goes to the back (waiting)
    const tryAllocate = (r: MockRequest) => r.id !== 'r2';
    const res = roundRobinCycle(reqs, tryAllocate);
    expect(res.order).toEqual(['r1', 'r2', 'r3']);
    expect(res.allocated.map(r => r.id)).toEqual(['r1', 'r3']);
    expect(res.waiting.map(r => r.id)).toEqual(['r2']);
  });

  it('gives the rotated request another turn on the next cycle', () => {
    const base = Date.now();
    const reqs: MockRequest[] = [
      { id: 'r1', enqueue_time: new Date(base), priority_score: 1 },
      { id: 'r2', enqueue_time: new Date(base + 1000), priority_score: 1 },
    ];
    const res1 = roundRobinCycle(reqs, r => false); // nobody can allocate yet
    expect(res1.waiting.map(r => r.id)).toEqual(['r1', 'r2']);
    // next tick: r1 can now allocate, r2 still cannot
    const res2 = roundRobinCycle(res1.waiting, r => r.id === 'r1');
    expect(res2.allocated.map(r => r.id)).toEqual(['r1']);
    expect(res2.waiting.map(r => r.id)).toEqual(['r2']);
  });
});

describe('Request timeouts', () => {
  it('flags only requests that exceed the timeout limit', () => {
    const now = Date.now();
    const reqs: MockRequest[] = [
      { id: 'fresh', enqueue_time: new Date(now - 10 * 1000), priority_score: 1 },
      { id: 'stale', enqueue_time: new Date(now - 600 * 1000), priority_score: 1 },
    ];
    const timedOut = computeTimeout(reqs, now, 300);
    expect(timedOut.map(r => r.id)).toEqual(['stale']);
  });

  it('does not flag anything when timeout is disabled (0)', () => {
    const now = Date.now();
    const reqs: MockRequest[] = [
      { id: 'old', enqueue_time: new Date(now - 999999 * 1000), priority_score: 1 },
    ];
    expect(computeTimeout(reqs, now, 0)).toEqual([]);
  });
});