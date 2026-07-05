// V158: ComparisonMatrix — metric switcher tooltips + METRIC_DESCRIPTIONS
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  ComparisonMatrix,
  METRIC_DESCRIPTIONS,
  type CandidateComparisonRow,
} from '../src/components/interview/index.js';

const EMPTY = {
  overall: null, technical: null, communication: null, problemSolving: null, culture: null,
} as const;

function row(overrides: Partial<{
  candidateId: string; candidateName: string; candidatePosition: string;
  bestOverall: number | null; evaluatedRounds: number;
  bestByMetric?: Partial<Record<'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture', number | null>>;
}>): CandidateComparisonRow {
  return {
    candidateId: overrides.candidateId ?? 'ct_a',
    candidateName: overrides.candidateName ?? 'A',
    candidatePosition: overrides.candidatePosition ?? 'X',
    rounds: [],
    bestOverall: overrides.bestOverall ?? null,
    avgOverall: null,
    evaluatedRounds: overrides.evaluatedRounds ?? 0,
    bestByMetric: { ...EMPTY, ...(overrides.bestByMetric ?? {}) } as CandidateComparisonRow['bestByMetric'],
    avgByMetric: EMPTY as CandidateComparisonRow['avgByMetric'],
  };
}

const rows: CandidateComparisonRow[] = [
  row({ candidateId: 'ct_a', candidateName: 'A', bestOverall: 80, evaluatedRounds: 1 }),
];

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

describe('METRIC_DESCRIPTIONS', () => {
  it('exposes a description for every metric key', () => {
    expect(METRIC_DESCRIPTIONS.overall).toBeTruthy();
    expect(METRIC_DESCRIPTIONS.technical).toBeTruthy();
    expect(METRIC_DESCRIPTIONS.communication).toBeTruthy();
    expect(METRIC_DESCRIPTIONS.problemSolving).toBeTruthy();
    expect(METRIC_DESCRIPTIONS.culture).toBeTruthy();
  });
});

describe('ComparisonMatrix — metric tooltips (V158)', () => {
  it('exposes a title attribute on every metric button with a non-empty description', () => {
    render(<ComparisonMatrix rows={rows} />);
    for (const key of ['overall', 'technical', 'communication', 'problemSolving', 'culture'] as const) {
      const btn = screen.getByTestId(`comparison-metric-${key}`);
      const title = btn.getAttribute('title');
      expect(title).toBeTruthy();
      expect(title).toBe(METRIC_DESCRIPTIONS[key]);
    }
  });

  it('shows the description for the currently active metric in the inline label', () => {
    render(<ComparisonMatrix rows={rows} />);
    // default = overall
    expect(screen.getByTestId('comparison-metric-description').textContent).toBe(METRIC_DESCRIPTIONS.overall);
  });

  it('updates the inline description when the user switches metric', () => {
    const onMetricChange = vi.fn();
    render(<ComparisonMatrix rows={rows} metric="overall" onMetricChange={onMetricChange} />);
    expect(screen.getByTestId('comparison-metric-description').textContent).toBe(METRIC_DESCRIPTIONS.overall);
    fireEvent.click(screen.getByTestId('comparison-metric-culture'));
    expect(onMetricChange).toHaveBeenCalledWith('culture');
  });
});