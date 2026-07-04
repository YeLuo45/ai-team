// V147: Interview comparison matrix — multi-candidate evaluation comparison
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Candidate, Interview } from '@ai-team/core';
import {
  buildCandidateComparisonRow,
  ComparisonMatrix,
  groupComparisonByPosition,
  type CandidateComparisonRow,
} from '../src/components/interview/index.js';
import { Interviews } from '../src/pages/Interviews.js';

vi.mock('../src/lib/hooks.js', () => ({
  useTeamData: vi.fn(),
}));

const { useTeamData } = await import('../src/lib/hooks.js');

function makeRound(overrides: Partial<Interview> = {}): Interview {
  return {
    id: overrides.id ?? 'iv_1',
    candidateId: overrides.candidateId ?? 'ct_1',
    position: overrides.position ?? 'Engineer',
    type: overrides.type ?? 'technical',
    status: overrides.status ?? 'completed',
    turns: overrides.turns ?? [],
    aiConducted: overrides.aiConducted ?? true,
    interviewerName: overrides.interviewerName ?? 'AI',
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    evaluation: overrides.evaluation,
  };
}

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
  bestByMetric?: Partial<Record<'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture', number | null>>;
  avgByMetric?: Partial<Record<'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture', number | null>>;
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

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- helpers ----------------

describe('buildCandidateComparisonRow', () => {
  it('computes bestOverall, avgOverall, and evaluatedRounds', () => {
    const rounds = [
      makeRound({ id: 'iv_1', evaluation: makeEval(70) }),
      makeRound({ id: 'iv_2', evaluation: makeEval(85) }),
      makeRound({ id: 'iv_3', evaluation: makeEval(90) }),
    ].map((iv) => Object.assign(iv, { round: 0 }));
    const row = buildCandidateComparisonRow('ct_a', '李婷', '前端', rounds);
    expect(row.bestOverall).toBe(90);
    expect(row.avgOverall).toBe(81.7); // (70+85+90)/3 = 81.666...
    expect(row.evaluatedRounds).toBe(3);
  });

  it('returns nulls when no evaluation present', () => {
    const rounds = [makeRound({ id: 'iv_1' })].map((iv) => Object.assign(iv, { round: 0 }));
    const row = buildCandidateComparisonRow('ct_a', '李婷', '前端', rounds);
    expect(row.bestOverall).toBeNull();
    expect(row.avgOverall).toBeNull();
    expect(row.evaluatedRounds).toBe(0);
  });

  it('skips rounds without evaluation when computing stats', () => {
    const rounds = [
      makeRound({ id: 'iv_1', evaluation: makeEval(80) }),
      makeRound({ id: 'iv_2' }),
      makeRound({ id: 'iv_3', evaluation: makeEval(60) }),
    ].map((iv) => Object.assign(iv, { round: 0 }));
    const row = buildCandidateComparisonRow('ct_a', 'A', 'X', rounds);
    expect(row.evaluatedRounds).toBe(2);
    expect(row.bestOverall).toBe(80);
    expect(row.avgOverall).toBe(70);
  });
});

describe('groupComparisonByPosition', () => {
  it('groups rows by position and picks the top scorer per position', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A1', candidatePosition: '前端', bestOverall: 80, avgOverall: 80, evaluatedRounds: 1 }),
      row({ candidateId: 'ct_b', candidateName: 'A2', candidatePosition: '前端', bestOverall: 90, avgOverall: 90, evaluatedRounds: 1 }),
      row({ candidateId: 'ct_c', candidateName: 'B1', candidatePosition: '后端', bestOverall: 85, avgOverall: 85, evaluatedRounds: 1 }),
      row({ candidateId: 'ct_d', candidateName: 'A3', candidatePosition: '前端', bestOverall: 70, avgOverall: 70, evaluatedRounds: 1 }),
    ];
    const groups = groupComparisonByPosition(rows);
    expect(groups).toHaveLength(2);

    const frontend = groups.find((g) => g.position === '前端')!;
    expect(frontend.rows.map((r) => r.candidateId)).toEqual(['ct_b', 'ct_a', 'ct_d']);
    expect(frontend.topScorerId).toBe('ct_b');

    const backend = groups.find((g) => g.position === '后端')!;
    expect(backend.rows).toHaveLength(1);
    expect(backend.topScorerId).toBe('ct_c');
  });

  it('returns topScorerId=null when no candidate has been evaluated', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: 'X', bestOverall: null, avgOverall: null, evaluatedRounds: 0 }),
    ];
    const groups = groupComparisonByPosition(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].topScorerId).toBeNull();
  });

  it('sorts groups by evaluated round count desc, then position asc', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: '前端', bestOverall: 80, avgOverall: 80, evaluatedRounds: 1 }),
      row({ candidateId: 'ct_b', candidateName: 'B', candidatePosition: '后端', bestOverall: 80, avgOverall: 80, evaluatedRounds: 3 }),
    ];
    const groups = groupComparisonByPosition(rows);
    expect(groups[0].position).toBe('后端'); // 3 rounds first
    expect(groups[1].position).toBe('前端');
  });

  it('falls back to candidateName asc when bestOverall is equal between two rows', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_z', candidateName: 'Zara', candidatePosition: 'X', bestOverall: 80, avgOverall: 80, evaluatedRounds: 1 }),
      row({ candidateId: 'ct_a', candidateName: 'Anna', candidatePosition: 'X', bestOverall: 80, avgOverall: 80, evaluatedRounds: 1 }),
    ];
    const groups = groupComparisonByPosition(rows);
    expect(groups[0].rows.map((r) => r.candidateName)).toEqual(['Anna', 'Zara']);
  });

  it('handles a mix of evaluated + unevaluated candidates (unevaluated rows fall below)', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: 'X', bestOverall: null, avgOverall: null, evaluatedRounds: 0 }),
      row({ candidateId: 'ct_b', candidateName: 'B', candidatePosition: 'X', bestOverall: 90, avgOverall: 90, evaluatedRounds: 1 }),
    ];
    const groups = groupComparisonByPosition(rows);
    expect(groups[0].rows[0].candidateId).toBe('ct_b');
    expect(groups[0].topScorerId).toBe('ct_b');
  });

  it('returns an empty array when no rows are given', () => {
    expect(groupComparisonByPosition([])).toEqual([]);
  });

  it('places rows with null bestOverall below evaluated rows via the -Infinity fallback', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_un', candidateName: 'Unevaluated', candidatePosition: 'X', bestOverall: null, avgOverall: null, evaluatedRounds: 0 }),
      row({ candidateId: 'ct_b', candidateName: 'B', candidatePosition: 'X', bestOverall: 90, avgOverall: 90, evaluatedRounds: 1 }),
    ];
    const groups = groupComparisonByPosition(rows);
    // bestOverall=90 (B) sorts before null (Unevaluated via -Infinity fallback)
    expect(groups[0].rows[0].candidateId).toBe('ct_b');
    expect(groups[0].rows[1].candidateId).toBe('ct_un');
    // topScorer is the evaluated one
    expect(groups[0].topScorerId).toBe('ct_b');
  });
});

// ---------------- UI: ComparisonMatrix ----------------

describe('ComparisonMatrix UI', () => {
  it('renders an empty state when no rows are provided', () => {
    render(<ComparisonMatrix rows={[]} />);
    expect(screen.getByTestId('comparison-matrix-empty')).toBeTruthy();
    expect(screen.getByTestId('comparison-matrix-empty-text').textContent).toContain('暂无候选人评估数据');
  });

  it('groups rows by position with per-group SVG + top scorer badge', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: '李婷', candidatePosition: '前端', bestOverall: 90, avgOverall: 88, evaluatedRounds: 3 }),
      row({ candidateId: 'ct_b', candidateName: '王浩', candidatePosition: '后端', bestOverall: 86, avgOverall: 84, evaluatedRounds: 2 }),
      row({ candidateId: 'ct_c', candidateName: '陈思', candidatePosition: '前端', bestOverall: 82, avgOverall: 80, evaluatedRounds: 2 }),
    ];
    render(<ComparisonMatrix rows={rows} />);
    expect(screen.getByTestId('comparison-matrix')).toBeTruthy();
    expect(screen.getByTestId('comparison-group-前端')).toBeTruthy();
    expect(screen.getByTestId('comparison-group-后端')).toBeTruthy();
    expect(screen.getByTestId('comparison-group-summary-前端').textContent).toContain('2 位候选人');
    expect(screen.getByTestId('comparison-group-summary-后端').textContent).toContain('1 位候选人');
    // Top scorer per position
    expect(screen.getByTestId('comparison-top-scorer-前端').textContent).toContain('李婷');
    expect(screen.getByTestId('comparison-top-scorer-后端').textContent).toContain('王浩');
    // Per-row best/avg chips
    expect(screen.getByTestId('comparison-best-ct_a').textContent).toContain('90');
    expect(screen.getByTestId('comparison-avg-ct_a').textContent).toContain('88');
  });

  it('invokes onSelectCandidate when a row is clicked', () => {
    const onSelect = vi.fn();
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: 'X', bestOverall: 80, avgOverall: 80, evaluatedRounds: 1 }),
    ];
    render(<ComparisonMatrix rows={rows} onSelectCandidate={onSelect} />);
    fireEvent.click(screen.getByTestId('comparison-row-ct_a'));
    expect(onSelect).toHaveBeenCalledWith('ct_a');
  });

  it('does not throw when a row has no evaluation (no best/avg chips)', () => {
    const rows: CandidateComparisonRow[] = [
      row({ candidateId: 'ct_a', candidateName: 'A', candidatePosition: 'X', bestOverall: null, avgOverall: null, evaluatedRounds: 0 }),
    ];
    render(<ComparisonMatrix rows={rows} />);
    expect(screen.getByTestId('comparison-row-ct_a')).toBeTruthy();
    expect(screen.queryByTestId('comparison-best-ct_a')).toBeNull();
  });
});

// ---------------- UI: Interviews page compare mode ----------------

describe('Interviews page — compare mode toggle', () => {
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
          { id: 'ct_c', name: 'B1', position: '后端', source: 'website', status: 'interviewing', createdAt: '2026-06-23T00:00:00Z', updatedAt: '2026-06-23T00:00:00Z' },
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [
          makeRound({ id: 'iv_a', candidateId: 'ct_a', completedAt: '2026-06-21T01:00:00Z', evaluation: makeEval(70) }),
          makeRound({ id: 'iv_a2', candidateId: 'ct_a', completedAt: '2026-06-22T01:00:00Z', evaluation: makeEval(90) }),
          makeRound({ id: 'iv_b', candidateId: 'ct_b', completedAt: '2026-06-22T01:00:00Z', evaluation: makeEval(82) }),
          makeRound({ id: 'iv_c', candidateId: 'ct_c', completedAt: '2026-06-23T01:00:00Z', evaluation: makeEval(86) }),
        ],
      },
    });
  }

  it('auto-enters compare mode when ?compare=1 is in the URL', async () => {
    mockData();
    render(<MemoryRouter initialEntries={['/interviews?compare=1']}><Interviews /></MemoryRouter>);
    await waitFor(() => screen.getByTestId('compare-mode-panel'));
    expect(screen.getByTestId('toggle-compare-mode').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('comparison-matrix')).toBeTruthy();
    // The single-candidate grid should be hidden
    expect(screen.queryByTestId('candidate-list')).toBeNull();
  });

  it('toggling compare mode switches the URL between compare=1 and candidate=<id>', async () => {
    mockData();
    render(<MemoryRouter><Interviews /></MemoryRouter>);
    await waitFor(() => screen.getByTestId('toggle-compare-mode'));
    fireEvent.click(screen.getByTestId('toggle-compare-mode'));
    await waitFor(() => screen.getByTestId('compare-mode-panel'));
    expect(screen.getByTestId('comparison-group-前端')).toBeTruthy();

    fireEvent.click(screen.getByTestId('toggle-compare-mode'));
    await waitFor(() => screen.getByTestId('candidate-list'));
    expect(screen.queryByTestId('compare-mode-panel')).toBeNull();
  });

  it('clicking a candidate row in compare mode switches to single-candidate view + auto-selects', async () => {
    mockData();
    render(<MemoryRouter initialEntries={['/interviews?compare=1']}><Interviews /></MemoryRouter>);
    await waitFor(() => screen.getByTestId('comparison-row-ct_b'));
    fireEvent.click(screen.getByTestId('comparison-row-ct_b'));
    await waitFor(() => screen.getByTestId('candidate-list'));
    expect(screen.queryByTestId('compare-mode-panel')).toBeNull();
    // Active card should be ct_b
    const activeCard = screen.getByTestId('candidate-card-ct_b');
    expect(activeCard.getAttribute('class') ?? '').toMatch(/border-brand-500/);
  });
});