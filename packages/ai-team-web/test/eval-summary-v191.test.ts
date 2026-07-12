// V191 EvalSummary dashboard helpers.

import { describe, it, expect } from 'vitest';
import {
  buildEvalSummary,
  topFailures,
  adoptionByQuestion,
  adoptionsLastSevenDays,
  latestFailureFor,
  type AdoptionEvent,
} from '../src/lib/llm/eval-summary';
import type { EvalCaseResult } from '../src/lib/llm/eval-harness';
import { buildEntry } from '../src/lib/llm/eval-timeline';

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
const DAY = 86_400_000;

function caseResult(
  fixtureId: string,
  passed: boolean,
  runnerLabel = 'r',
  elapsedMs = 42,
): EvalCaseResult {
  return {
    fixtureId,
    runnerLabel,
    actual: null,
    expectation: { focusTag: 'technical' },
    checks: [],
    elapsedMs,
    passed,
  };
}

describe('topFailures', () => {
  it('buckets by fixtureId, sorted desc by count', () => {
    const failures = topFailures(
      [
        caseResult('a', false),
        caseResult('a', false),
        caseResult('a', false),
        caseResult('b', false),
        caseResult('b', false),
        caseResult('c', false),
        caseResult('a', true),
      ],
      NOW,
    );
    expect(failures.length).toBe(3);
    expect(failures[0]!.fixtureId).toBe('a');
    expect(failures[0]!.count).toBe(3);
    expect(failures[1]!.count).toBe(2);
    expect(failures[2]!.count).toBe(1);
  });

  it('tracks the latestAtMs + latestRunner', () => {
    const failures = topFailures(
      [caseResult('a', false), caseResult('a', false, 'r2')],
      NOW,
    );
    expect(failures[0]!.latestAtMs).toBe(NOW);
    expect(failures[0]!.latestRunner).toBe('r2');
  });
});

describe('adoptionByQuestion', () => {
  it('groups by questionId, sorted desc by count', () => {
    const events: AdoptionEvent[] = [
      { questionId: 'a', question: 'Q-A', adoptedAtMs: 1 },
      { questionId: 'a', question: 'Q-A', adoptedAtMs: 2 },
      { questionId: 'b', question: 'Q-B', adoptedAtMs: 3 },
    ];
    const out = adoptionByQuestion(events);
    expect(out[0]).toEqual({ questionId: 'a', count: 2 });
    expect(out[1]).toEqual({ questionId: 'b', count: 1 });
  });
});

describe('adoptionsLastSevenDays', () => {
  it('counts only events inside the 7-day window', () => {
    const out = adoptionsLastSevenDays(
      [
        { questionId: 'a', question: 'Q', adoptedAtMs: NOW - 2 * DAY },
        { questionId: 'b', question: 'Q', adoptedAtMs: NOW - 6 * DAY },
        { questionId: 'c', question: 'Q', adoptedAtMs: NOW - 30 * DAY },
      ],
      NOW,
    );
    expect(out).toBe(2);
  });
});

describe('buildEvalSummary', () => {
  it('returns zeros for empty input', () => {
    const snap = buildEvalSummary({ nowMs: NOW });
    expect(snap.recent.totalCases).toBe(0);
    expect(snap.recent.passed).toBe(0);
    expect(snap.recent.failed).toBe(0);
    expect(snap.recent.passRate).toBe(0);
    expect(snap.recent.topFailures).toEqual([]);
    expect(snap.timeline.totalRuns).toBe(0);
    expect(snap.adoptions.total).toBe(0);
    expect(snap.adoptions.uniqueQuestions).toBe(0);
    expect(snap.adoptions.mostAdopted).toEqual([]);
    expect(snap.adoptions.lastSevenDays).toBe(0);
  });

  it('aggregates recent + timeline + adoptions together', () => {
    const recent = [
      caseResult('a', true),
      caseResult('b', false),
      caseResult('c', false),
      caseResult('c', false),
    ];
    const timeline = [
      buildEntry('t1', {
        startedAtMs: NOW - 1 * DAY,
        durationMs: 100,
        runnerLabel: 'r',
        results: [
          { fixtureId: 'a', passed: true },
          { fixtureId: 'b', passed: false },
        ],
      }),
    ];
    const adoptions: AdoptionEvent[] = [
      { questionId: 'q-a', question: 'Q-A', adoptedAtMs: NOW - 1 * DAY },
      { questionId: 'q-a', question: 'Q-A', adoptedAtMs: NOW - 2 * DAY },
      { questionId: 'q-b', question: 'Q-B', adoptedAtMs: NOW - 30 * DAY },
    ];
    const snap = buildEvalSummary({
      recentResults: recent,
      timeline,
      adoptions,
      nowMs: NOW,
    });
    expect(snap.recent.totalCases).toBe(4);
    expect(snap.recent.passed).toBe(1);
    expect(snap.recent.failed).toBe(3);
    expect(snap.recent.passRate).toBeCloseTo(0.25, 5);
    expect(snap.recent.topFailures[0]!.fixtureId).toBe('c');
    expect(snap.timeline.totalRuns).toBe(1);
    expect(snap.adoptions.total).toBe(3);
    expect(snap.adoptions.uniqueQuestions).toBe(2);
    expect(snap.adoptions.lastSevenDays).toBe(2);
    expect(snap.adoptions.mostAdopted[0]!.count).toBe(2);
  });

  it('latestFailureFor returns null when no timeline entry exists', () => {
    const out = latestFailureFor({ nowMs: NOW, adoptions: [], timeline: [] }, 'a');
    expect(out.entry).toBeNull();
  });

  it('latestFailureFor surfaces the most recent failing timeline entry', () => {
    const older = buildEntry('older', {
      startedAtMs: NOW - 3 * DAY,
      durationMs: 10,
      runnerLabel: 'r',
      results: [{ fixtureId: 'a', passed: false }],
    });
    const newer = buildEntry('newer', {
      startedAtMs: NOW - 1 * DAY,
      durationMs: 10,
      runnerLabel: 'r',
      results: [{ fixtureId: 'a', passed: true }],
    });
    const out = latestFailureFor(
      { nowMs: NOW, adoptions: [], timeline: [older, newer] },
      'a',
    );
    expect(out.entry?.id).toBe('older');
  });
});
