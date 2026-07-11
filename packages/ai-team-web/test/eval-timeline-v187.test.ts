// V187 tests — EvalTimeline summary / pruning / failure lookup.

import { describe, it, expect } from 'vitest';
import {
  buildEntry,
  pruneTimeline,
  summariseTimeline,
  latestFailure,
  renderTimelineMarkdown,
  type EvalTimelineEntry,
} from '../src/lib/llm/eval-timeline';

function entry(id: string, startedAtMs: number, results: Array<{ fixtureId: string; passed: boolean }>, durationMs = 1_000): EvalTimelineEntry {
  return buildEntry(id, { startedAtMs, durationMs, runnerLabel: 'runner', results });
}

describe('buildEntry', () => {
  it('rolls up counts and preserves per-fixture data', () => {
    const e = entry('r1', 1_000, [
      { fixtureId: 'a', passed: true },
      { fixtureId: 'b', passed: false },
    ]);
    expect(e.totalCases).toBe(2);
    expect(e.passed).toBe(1);
    expect(e.failed).toBe(1);
    expect(e.perFixture?.length).toBe(2);
  });

  it('produces zero counts when results is empty', () => {
    const e = entry('empty', 0, []);
    expect(e.totalCases).toBe(0);
    expect(e.passed).toBe(0);
    expect(e.failed).toBe(0);
    expect(e.perFixture).toEqual([]);
  });
});

describe('pruneTimeline', () => {
  it('drops entries older than the cutoff when retention allows', () => {
    const now = 100_000;
    const entries: EvalTimelineEntry[] = [
      entry('old', 1_000, [{ fixtureId: 'a', passed: true }]),
      entry('mid', 92_000, [{ fixtureId: 'a', passed: false }]),
      entry('new', 99_000, [{ fixtureId: 'a', passed: true }]),
    ];
    const out = pruneTimeline(entries, now, { newestOlderThanMs: 10_000 });
    expect(out.find((e) => e.id === 'old')).toBeUndefined();
    expect(out.find((e) => e.id === 'mid')).toBeDefined();
    expect(out.find((e) => e.id === 'new')).toBeDefined();
  });

  it('retains at least minRetained entries even if older than the cutoff', () => {
    const entries: EvalTimelineEntry[] = [
      entry('old', 1_000, [{ fixtureId: 'a', passed: true }]),
      entry('mid', 50_000, [{ fixtureId: 'a', passed: false }]),
    ];
    const out = pruneTimeline(entries, 100_000, { newestOlderThanMs: 100, minRetained: 5 });
    expect(out.length).toBe(2);
  });
});

describe('summariseTimeline', () => {
  it('handles an empty timeline', () => {
    const snap = summariseTimeline([]);
    expect(snap.latest).toBeNull();
    expect(snap.totalRuns).toBe(0);
    expect(snap.overallPassRate).toBe(0);
    expect(snap.trends).toEqual([]);
  });

  it('computes overall + per-fixture pass-rate correctly', () => {
    const snap = summariseTimeline([
      entry('a', 1_000, [
        { fixtureId: 'A', passed: true },
        { fixtureId: 'B', passed: false },
      ]),
      entry('b', 2_000, [
        { fixtureId: 'A', passed: true },
        { fixtureId: 'B', passed: true },
      ]),
    ]);
    expect(snap.totalRuns).toBe(2);
    expect(snap.latest?.id).toBe('b');
    expect(snap.overallPassRate).toBeCloseTo(0.75, 5);
    const a = snap.trends.find((t) => t.fixtureId === 'A');
    expect(a?.passRate).toBe(1);
    const b = snap.trends.find((t) => t.fixtureId === 'B');
    expect(b?.passRate).toBe(0.5);
  });

  it('lists per-run pass-rates chronologically', () => {
    const snap = summariseTimeline([
      entry('a', 2_000, [
        { fixtureId: 'A', passed: true },
        { fixtureId: 'B', passed: false },
      ]),
      entry('b', 1_000, [
        { fixtureId: 'A', passed: true },
        { fixtureId: 'B', passed: true },
      ]),
    ]);
    expect(snap.perRunPassRate.map((r) => r.runId)).toEqual(['b', 'a']);
  });
});

describe('latestFailure', () => {
  it('returns the most recent entry that failed the fixture', () => {
    const entries = [
      entry('a', 1_000, [{ fixtureId: 'X', passed: false }]),
      entry('b', 2_000, [{ fixtureId: 'X', passed: true }]),
      entry('c', 3_000, [{ fixtureId: 'X', passed: false }]),
    ];
    const last = latestFailure(entries, 'X');
    expect(last?.id).toBe('c');
  });

  it('returns null when the fixture never failed', () => {
    const entries = [entry('a', 1_000, [{ fixtureId: 'X', passed: true }])];
    expect(latestFailure(entries, 'X')).toBeNull();
  });

  it('returns null when the fixture was never seen', () => {
    const entries = [entry('a', 1_000, [{ fixtureId: 'Y', passed: true }])];
    expect(latestFailure(entries, 'X')).toBeNull();
  });
});

describe('renderTimelineMarkdown', () => {
  it('returns a markdown roll-up of recent runs', () => {
    const snap = summariseTimeline([
      entry('a', 1700000000000, [{ fixtureId: 'A', passed: true }]),
    ]);
    const md = renderTimelineMarkdown(snap);
    expect(md).toContain('# Eval Timeline');
    expect(md).toContain('Total runs');
    expect(md).toContain('`a`');
    expect(md).toContain('## Per-fixture');
    expect(md).toContain('## Runs');
  });

  it('omits the Per-fixture section when no trends are present', () => {
    const md = renderTimelineMarkdown(summariseTimeline([]));
    expect(md).toContain('No runs recorded');
    expect(md).not.toContain('## Per-fixture');
  });
});
