// V160: ComparisonMatrix — CSV export helper + 📥 导出 CSV button
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  buildComparisonCsv,
  buildComparisonCsvFilename,
  ComparisonMatrix,
  type CandidateComparisonRow,
} from '../src/components/interview/index.js';

const EMPTY = {
  overall: null, technical: null, communication: null, problemSolving: null, culture: null,
} as const;

function row(overrides: Partial<{
  candidateId: string; candidateName: string; candidatePosition: string;
  bestOverall: number | null; evaluatedRounds: number;
  bestByMetric?: Partial<Record<'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture', number | null>>;
  avgByMetric?: Partial<Record<'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture', number | null>>;
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
    avgByMetric: { ...EMPTY, ...(overrides.avgByMetric ?? {}) } as CandidateComparisonRow['avgByMetric'],
  };
}

const FIXED = new Date('2026-07-04T10:00:00.000Z');

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- helpers ----------------

describe('buildComparisonCsv', () => {
  it('builds a header + one row per candidate + an export comment', () => {
    const csv = buildComparisonCsv(
      [
        row({
          candidateId: 'ct_a', candidateName: '李婷', candidatePosition: '前端',
          evaluatedRounds: 3, bestByMetric: { technical: 95 }, avgByMetric: { technical: 82.5 },
        }),
        row({
          candidateId: 'ct_b', candidateName: '王浩', candidatePosition: '后端',
          evaluatedRounds: 2, bestByMetric: { technical: 90 }, avgByMetric: { technical: 88 },
        }),
      ],
      { metric: 'technical', now: FIXED },
    );
    const lines = csv.split('\n');
    expect(lines[0]).toContain('岗位');
    expect(lines[0]).toContain('候选人');
    expect(lines[0]).toContain('最高分(technical)');
    expect(lines[1]).toContain('前端');
    expect(lines[1]).toContain('李婷');
    expect(lines[1]).toContain('3');
    expect(lines[1]).toContain('95');
    expect(lines[2]).toContain('后端');
    expect(lines[2]).toContain('王浩');
    expect(lines[3]).toMatch(/^# exportedAt=2026-07-04T10:00:00\.000Z,metric=technical$/);
  });

  it('leaves score columns empty when the row has no evaluation for the selected metric', () => {
    const csv = buildComparisonCsv(
      [row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: 'X', evaluatedRounds: 0 })],
      { metric: 'culture', now: FIXED },
    );
    const lines = csv.split('\n');
    // header + data + comment
    expect(lines[1].split(',').length).toBe(6);
    // last two cells are empty (best/avg for culture are null)
    const cells = lines[1].split(',');
    expect(cells[4]).toBe('');
    expect(cells[5]).toBe('');
  });

  it('quotes / escapes cell values that contain commas, quotes, or newlines', () => {
    const csv = buildComparisonCsv(
      [row({
        candidateId: 'ct_x', candidateName: '李, 雷', candidatePosition: 'PM "lead"', evaluatedRounds: 1,
      })],
      { metric: 'overall', now: FIXED },
    );
    expect(csv).toContain('"李, 雷"');
    expect(csv).toContain('"PM ""lead"""');
  });
});

describe('buildComparisonCsvFilename', () => {
  it('returns comparison-<metric>-<YYYY-MM-DD>.csv', () => {
    expect(buildComparisonCsvFilename('technical', FIXED)).toBe('comparison-technical-2026-07-04.csv');
  });
});

// ---------------- UI ----------------

describe('ComparisonMatrix UI — CSV export button (V160)', () => {
  it('renders the 📥 导出 CSV button when rows are present', () => {
    render(
      <ComparisonMatrix
        rows={[row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: 'X', bestOverall: 80, evaluatedRounds: 1 })]}
      />,
    );
    expect(screen.getByTestId('comparison-export-csv')).toBeTruthy();
  });

  it('triggers a CSV download when the button is clicked', () => {
    const createUrlSpy = vi.fn(() => 'blob:mock-url');
    const revokeUrlSpy = vi.fn();
    window.URL.createObjectURL = createUrlSpy;
    window.URL.revokeObjectURL = revokeUrlSpy;
    const realCreate = document.createElement.bind(document);
    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    render(
      <ComparisonMatrix
        rows={[row({ candidateId: 'ct_a', candidateName: '李婷', bestOverall: 90, evaluatedRounds: 1 })]}
      />,
    );
    fireEvent.click(screen.getByTestId('comparison-export-csv'));

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createElementSpy).toHaveBeenCalledWith('a');

    // Verify the blob was built with text/csv mime
    const blobArg = createUrlSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/csv;charset=utf-8');

    createElementSpy.mockRestore();
  });
});