// V155: ComparisonMatrix — controlled metric (URL ?metric=) + isValidMetricKey
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Interview } from '@ai-team/core';
import {
  ComparisonMatrix,
  isValidMetricKey,
  type CandidateComparisonRow,
} from '../src/components/interview/index.js';
import { Interviews } from '../src/pages/Interviews.js';
import { useTeamData } from '../src/lib/hooks.js';

vi.mock('../src/lib/hooks.js', () => ({
  useTeamData: vi.fn(),
}));

function makeEval(overall: number) {
  return {
    overall,
    breakdown: { technical: overall, communication: overall, problemSolving: overall, culture: overall },
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
    position: overrides.position ?? 'X',
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

const EMPTY = { overall: null, technical: null, communication: null, problemSolving: null, culture: null } as const;

function row(overrides: Partial<{
  candidateId: string; candidateName: string; candidatePosition: string;
  bestOverall: number | null; avgOverall: number | null; evaluatedRounds: number;
  bestByMetric?: Partial<Record<'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture', number | null>>;
  avgByMetric?: Partial<Record<'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture', number | null>>;
}>): CandidateComparisonRow {
  return {
    candidateId: overrides.candidateId ?? 'ct_a',
    candidateName: overrides.candidateName ?? 'A',
    candidatePosition: overrides.candidatePosition ?? 'X',
    rounds: [],
    bestOverall: overrides.bestOverall ?? null,
    avgOverall: overrides.avgOverall ?? null,
    evaluatedRounds: overrides.evaluatedRounds ?? 0,
    bestByMetric: { ...EMPTY, ...(overrides.bestByMetric ?? {}) } as CandidateComparisonRow['bestByMetric'],
    avgByMetric: { ...EMPTY, ...(overrides.avgByMetric ?? {}) } as CandidateComparisonRow['avgByMetric'],
  };
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- isValidMetricKey ----------------

describe('isValidMetricKey', () => {
  it('accepts all 5 metric keys', () => {
    expect(isValidMetricKey('overall')).toBe(true);
    expect(isValidMetricKey('technical')).toBe(true);
    expect(isValidMetricKey('communication')).toBe(true);
    expect(isValidMetricKey('problemSolving')).toBe(true);
    expect(isValidMetricKey('culture')).toBe(true);
  });

  it('rejects null / undefined / unknown / empty', () => {
    expect(isValidMetricKey(null)).toBe(false);
    expect(isValidMetricKey(undefined)).toBe(false);
    expect(isValidMetricKey('')).toBe(false);
    expect(isValidMetricKey('garbage')).toBe(false);
  });
});

// ---------------- Controlled metric ----------------

describe('ComparisonMatrix — controlled metric (V155)', () => {
  const rows: CandidateComparisonRow[] = [
    row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: '前端', bestOverall: 80, evaluatedRounds: 1 }),
  ];

  it('honors the parent-controlled `metric` prop on first render', () => {
    render(
      <ComparisonMatrix
        rows={rows}
        metric="technical"
        onMetricChange={() => {}}
      />,
    );
    expect(screen.getByTestId('comparison-metric-technical').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('comparison-metric-overall').getAttribute('aria-checked')).toBe('false');
  });

  it('clicking a metric button calls onMetricChange (parent decides whether to update)', () => {
    const onMetricChange = vi.fn();
    render(
      <ComparisonMatrix
        rows={rows}
        metric="overall"
        onMetricChange={onMetricChange}
      />,
    );
    fireEvent.click(screen.getByTestId('comparison-metric-culture'));
    expect(onMetricChange).toHaveBeenCalledTimes(1);
    expect(onMetricChange).toHaveBeenCalledWith('culture');
  });

  it('reflects parent-driven metric changes (e.g. URL hash update)', () => {
    const onMetricChange = vi.fn();
    const { rerender } = render(
      <ComparisonMatrix rows={rows} metric="overall" onMetricChange={onMetricChange} />,
    );
    expect(screen.getByTestId('comparison-metric-overall').getAttribute('aria-checked')).toBe('true');
    rerender(
      <ComparisonMatrix rows={rows} metric="problemSolving" onMetricChange={onMetricChange} />,
    );
    expect(screen.getByTestId('comparison-metric-problemSolving').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('comparison-metric-overall').getAttribute('aria-checked')).toBe('false');
  });

  it('falls back to internal state when `metric` prop is undefined', () => {
    render(<ComparisonMatrix rows={rows} />);
    expect(screen.getByTestId('comparison-metric-overall').getAttribute('aria-checked')).toBe('true');
  });

  it('notifies onMetricChange when uncontrolled (so parent can sync the URL)', () => {
    const onMetricChange = vi.fn();
    render(<ComparisonMatrix rows={rows} onMetricChange={onMetricChange} />);
    fireEvent.click(screen.getByTestId('comparison-metric-technical'));
    expect(onMetricChange).toHaveBeenCalledWith('technical');
  });
});

// ---------------- Interviews page: URL ?metric= ----------------

describe('Interviews page — ?metric= URL sync (V155)', () => {
  function mockData() {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [
          { id: 'ct_a', name: 'A1', position: '前端', source: 'website', status: 'interviewing', createdAt: '2026-06-21T00:00:00Z', updatedAt: '2026-06-21T00:00:00Z' },
          { id: 'ct_b', name: 'A2', position: '前端', source: 'website', status: 'interviewing', createdAt: '2026-06-22T00:00:00Z', updatedAt: '2026-06-22T00:00:00Z' },
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [
          makeRound({ id: 'iv_a', candidateId: 'ct_a', completedAt: '2026-06-21T01:00:00Z', evaluation: makeEval(70) }),
          makeRound({ id: 'iv_b', candidateId: 'ct_b', completedAt: '2026-06-22T01:00:00Z', evaluation: makeEval(82) }),
        ],
      },
    });
  }

  it('auto-selects the metric from ?metric=technical on deep-link', async () => {
    mockData();
    render(<MemoryRouter initialEntries={['/interviews?compare=1&metric=technical']}><Interviews /></MemoryRouter>);
    await screen.findByTestId('compare-mode-panel');
    expect(screen.getByTestId('comparison-metric-technical').getAttribute('aria-checked')).toBe('true');
  });

  it('falls back to "overall" when ?metric= has an unknown value', async () => {
    mockData();
    render(<MemoryRouter initialEntries={['/interviews?compare=1&metric=garbage']}><Interviews /></MemoryRouter>);
    await screen.findByTestId('compare-mode-panel');
    expect(screen.getByTestId('comparison-metric-overall').getAttribute('aria-checked')).toBe('true');
  });
});