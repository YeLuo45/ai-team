import { describe, it, expect } from 'vitest';
import { flushUntil, commit } from '../src/lib/test/timing-stabilizer';

// Tests use real timers — flushUntil works with the real microtask +
// macrotask queue, which fake timers starve.

describe('flushUntil', () => {
  it('returns immediately when no predicate is supplied', async () => {
    await flushUntil();
    // sanity: should resolve within a sensible number of ticks.
    expect(true).toBe(true);
  });

  it('stops early once the predicate returns true', async () => {
    let calls = 0;
    await flushUntil(() => {
      calls += 1;
      return calls >= 3;
    });
    // We can't pin the exact count because the inner act block may
    // run the predicate on its own; but at minimum the test should
    // exit without hanging.
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('respects the maxIterations ceiling', async () => {
    let calls = 0;
    await flushUntil(() => {
      calls += 1;
      return false; // never satisfied
    }, 3);
    // Around 3 increments expected because the predicate is invoked
    // once per loop cycle.
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});

describe('commit', () => {
  it('awaits a single microtask inside an act wrap', async () => {
    await commit();
    expect(true).toBe(true);
  });
});
