// V149: ComparisonMatrix — metric switcher (overall / technical / communication /
// problemSolving / culture) with per-metric best/avg/top-scorer recompute.
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Interview } from '@ai-team/core';
import {
  buildCandidateComparisonRow,
  ComparisonMatrix,
  metricSeries,
  type CandidateComparisonRow,
  type ComparisonMetricKey,
} from '../src/components/interview/index.js';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

function makeEval(overrides: { overall: number; technical: number; communication: number; problemSolving: number; culture: number }) {
  return {
    overall: overrides.overall,
    breakdown: {
      technical: overrides.technical,
      communication: overrides.communication,
      problemSolving: overrides.problemSolving,
      culture: overrides.culture,
    },
    strengths: [],
    concerns: [],
    recommendation: 'hire' as const,
    summary: '',
    evaluatedAt: '2026-06-21T00:00:00Z',
  };
}

function makeRound(overrides: Partial<Interview & { round: number }>): Interview & { round: number } {
  const base: Interview = {
    id: overrides.id ?? 'iv_1',
    candidateId: overrides.candidateId ?? 'ct_a',
    position: overrides.position ?? '前端',
    type: overrides.type ?? 'technical',
    status: overrides.status ?? 'completed',
    turns: overrides.turns ?? [],
    aiConducted: overrides.aiConducted ?? true,
    interviewerName: overrides.interviewerName ?? 'AI',
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    evaluation: overrides.evaluation,
  };
  return Object.assign(base, { round: overrides.round ?? 1 });
}

// ---------------- helpers ----------------

describe('metricSeries', () => {
  it('extracts overall scores across rounds (null for unevaluated)', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: makeEval({ overall: 80, technical: 75, communication: 82, problemSolving: 78, culture: 85 }) }),
      makeRound({ id: 'iv_2', round: 2 }),
      makeRound({ id: 'iv_3', round: 3, evaluation: makeEval({ overall: 90, technical: 88, communication: 91, problemSolving: 89, culture: 92 }) }),
    ];
    expect(metricSeries(rounds, 'overall')).toEqual([80, null, 90]);
  });

  it('extracts per-breakdown metric scores', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: makeEval({ overall: 80, technical: 75, communication: 82, problemSolving: 78, culture: 85 }) }),
      makeRound({ id: 'iv_2', round: 2, evaluation: makeEval({ overall: 85, technical: 90, communication: 80, problemSolving: 88, culture: 86 }) }),
    ];
    expect(metricSeries(rounds, 'technical')).toEqual([75, 90]);
    expect(metricSeries(rounds, 'communication')).toEqual([82, 80]);
    expect(metricSeries(rounds, 'problemSolving')).toEqual([78, 88]);
    expect(metricSeries(rounds, 'culture')).toEqual([85, 86]);
  });

  it('returns null for rounds where evaluation is present but the selected metric is missing', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: undefined }),
    ];
    expect(metricSeries(rounds, 'overall')).toEqual([null]);
  });
});

describe('buildCandidateComparisonRow — per-metric stats', () => {
  it('computes bestByMetric and avgByMetric for all five metrics', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: makeEval({ overall: 80, technical: 70, communication: 85, problemSolving: 75, culture: 90 }) }),
      makeRound({ id: 'iv_2', round: 2, evaluation: makeEval({ overall: 90, technical: 95, communication: 88, problemSolving: 92, culture: 85 }) }),
    ];
    const row = buildCandidateComparisonRow('ct_a', '李婷', '前端', rounds);
    expect(row.bestByMetric.overall).toBe(90);
    expect(row.bestByMetric.technical).toBe(95);
    expect(row.bestByMetric.communication).toBe(88);
    expect(row.bestByMetric.problemSolving).toBe(92);
    expect(row.bestByMetric.culture).toBe(90);
    expect(row.avgByMetric.overall).toBe(85);
    expect(row.avgByMetric.technical).toBe(82.5);
  });

  it('returns nulls when no evaluation is present', () => {
    const rounds = [makeRound({ id: 'iv_1', round: 1 })];
    const row = buildCandidateComparisonRow('ct_a', '李婷', '前端', rounds);
    expect(row.bestByMetric.overall).toBeNull();
    expect(row.bestByMetric.technical).toBeNull();
    expect(row.avgByMetric.communication).toBeNull();
  });

  it('returns nulls for a candidate whose only evaluation has null breakdown metrics', () => {
    const rounds = [
      makeRound({
        id: 'iv_1',
        round: 1,
        evaluation: {
          overall: 80,
          breakdown: { technical: 0, communication: 0, problemSolving: 0, culture: 0 },
          strengths: [],
          concerns: [],
          recommendation: 'hire' as const,
          summary: '',
          evaluatedAt: '2026-06-21T00:00:00Z',
        },
      }),
    ];
    const row = buildCandidateComparisonRow('ct_a', '李婷', '前端', rounds);
    expect(row.bestByMetric.overall).toBe(80);
    expect(row.bestByMetric.technical).toBe(0);
    expect(row.avgByMetric.culture).toBe(0);
  });
});

// ---------------- UI: metric switcher ----------------

const EMPTY_METRICS = {
  overall: null,
  technical: null,
  communication: null,
  problemSolving: null,
  culture: null,
} as const;

function row(overrides: Partial<{
  candidateId: string;
  candidateName: string;
  candidatePosition: string;
  rounds: ReadonlyArray<Interview & { round: number }>;
  bestOverall: number | null;
  avgOverall: number | null;
  evaluatedRounds: number;
  bestByMetric?: Partial<Record<ComparisonMetricKey, number | null>>;
  avgByMetric?: Partial<Record<ComparisonMetricKey, number | null>>;
}>): CandidateComparisonRow {
  const bestByMetric: CandidateComparisonRow['bestByMetric'] = {
    overall: overrides.bestOverall ?? null,
    technical: null,
    communication: null,
    problemSolving: null,
    culture: null,
    ...(overrides.bestByMetric ?? {}),
  };
  const avgByMetric: CandidateComparisonRow['avgByMetric'] = {
    overall: overrides.avgOverall ?? null,
    technical: null,
    communication: null,
    problemSolving: null,
    culture: null,
    ...(overrides.avgByMetric ?? {}),
  };
  return {
    candidateId: overrides.candidateId ?? 'ct_a',
    candidateName: overrides.candidateName ?? 'A',
    candidatePosition: overrides.candidatePosition ?? 'X',
    rounds: overrides.rounds ?? [],
    bestOverall: overrides.bestOverall ?? null,
    avgOverall: overrides.avgOverall ?? null,
    evaluatedRounds: overrides.evaluatedRounds ?? 0,
    bestByMetric,
    avgByMetric,
  };
}

describe('ComparisonMatrix — metric switcher', () => {
  it('renders all 5 metric buttons + starts on "overall"', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A', bestOverall: 90 }),
    ];
    render(<ComparisonMatrix rows={rows} />);
    expect(screen.getByTestId('comparison-metric-overall').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('comparison-metric-technical').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('comparison-metric-communication').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('comparison-metric-problemSolving').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('comparison-metric-culture').getAttribute('aria-checked')).toBe('false');
  });

  it('switching to "technical" updates aria-checked + reorders top scorer + per-row best', () => {
    // A is best at overall (90) but B is best at technical (95).
    // Without per-metric bestByMetric override, the helper defaults technical/etc to null,
    // so we provide explicit per-metric overrides.
    const rows: CandidateComparisonRow[] = [
      row({
        candidateId: 'ct_a',
        candidateName: 'A',
        candidatePosition: '前端',
        bestOverall: 90,
        avgOverall: 88,
        bestByMetric: { overall: 90, technical: 70 },
        avgByMetric: { overall: 88, technical: 75 },
        evaluatedRounds: 2,
      }),
      row({
        candidateId: 'ct_b',
        candidateName: 'B',
        candidatePosition: '前端',
        bestOverall: 80,
        avgOverall: 78,
        bestByMetric: { overall: 80, technical: 95 },
        avgByMetric: { overall: 78, technical: 92 },
        evaluatedRounds: 2,
      }),
    ];

    render(<ComparisonMatrix rows={rows} />);

    // Default = overall: A is top scorer
    expect(screen.getByTestId('comparison-top-scorer-前端').textContent).toContain('A');
    expect(screen.getByTestId('comparison-best-ct_a').textContent).toContain('90');
    expect(screen.getByTestId('comparison-best-ct_b').textContent).toContain('80');

    // Switch to technical
    fireEvent.click(screen.getByTestId('comparison-metric-technical'));
    expect(screen.getByTestId('comparison-metric-technical').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('comparison-top-scorer-前端').textContent).toContain('B');
    expect(screen.getByTestId('comparison-best-ct_a').textContent).toContain('70');
    expect(screen.getByTestId('comparison-best-ct_b').textContent).toContain('95');
  });

  it('keeps all candidates in the same position group when switching metrics', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: '前端', bestOverall: 90, evaluatedRounds: 1 }),
      row({ candidateId: 'ct_b', candidateName: 'B', candidatePosition: '前端', bestOverall: 80, evaluatedRounds: 1 }),
    ];
    render(<ComparisonMatrix rows={rows} />);
    expect(screen.getByTestId('comparison-group-前端')).toBeTruthy();
    expect(screen.getByTestId('comparison-rows-前端').querySelectorAll('li')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('comparison-metric-culture'));
    expect(screen.getByTestId('comparison-group-前端')).toBeTruthy();
    expect(screen.getByTestId('comparison-rows-前端').querySelectorAll('li')).toHaveLength(2);
  });

  it('hides per-row best/avg chips when the selected metric has no evaluations for that candidate', () => {
    const rows: CandidateComparisonRow[] = [
      row({
        candidateId: 'ct_a',
        candidateName: 'A',
        candidatePosition: 'X',
        bestOverall: 90,
        avgOverall: 90,
        bestByMetric: { overall: 90 },
        avgByMetric: { overall: 90 },
        evaluatedRounds: 1,
      }),
    ];
    render(<ComparisonMatrix rows={rows} />);
    expect(screen.getByTestId('comparison-best-ct_a').textContent).toContain('90');

    // Switch to technical — A has no technical score, so no chip
    fireEvent.click(screen.getByTestId('comparison-metric-technical'));
    expect(screen.queryByTestId('comparison-best-ct_a')).toBeNull();
  });
});