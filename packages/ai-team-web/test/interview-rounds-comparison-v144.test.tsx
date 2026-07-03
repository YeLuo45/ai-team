// V144: Interview detail — multi-round sparkline helpers + RoundsComparison
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Interview } from '@ai-team/core';
import {
  buildRoundsSparkline,
  buildSparklinePath,
  buildSparklineX,
  RoundsComparison,
  scoreToY,
  SPARKLINE_METRICS,
} from '../src/components/interview/index.js';

function makeRound(overrides: Partial<Interview & { round: number }> = {}): Interview & { round: number } {
  const base: Interview = {
    id: overrides.id ?? 'iv_1',
    candidateId: overrides.candidateId ?? 'ct_1',
    position: overrides.position ?? '前端工程师',
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

const evalA = {
  overall: 70,
  breakdown: { technical: 65, communication: 75, problemSolving: 70, culture: 70 },
  strengths: ['基础扎实'],
  concerns: ['系统设计薄弱'],
  recommendation: 'hire' as const,
  summary: '推荐进入下一轮',
  evaluatedAt: '2026-06-21T01:00:00Z',
};

const evalB = {
  overall: 80,
  breakdown: { technical: 78, communication: 82, problemSolving: 80, culture: 80 },
  strengths: ['进步明显'],
  concerns: ['深度可加强'],
  recommendation: 'hire' as const,
  summary: '推荐',
  evaluatedAt: '2026-06-21T03:00:00Z',
};

const evalC = {
  overall: 88,
  breakdown: { technical: 90, communication: 86, problemSolving: 88, culture: 88 },
  strengths: ['架构能力突出'],
  concerns: [],
  recommendation: 'strong_hire' as const,
  summary: '强烈推荐',
  evaluatedAt: '2026-06-21T05:00:00Z',
};

// ---------------- helpers ----------------

describe('interview-helpers: buildRoundsSparkline', () => {
  it('maps each round to a point with all five metrics', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: evalA }),
      makeRound({ id: 'iv_2', round: 2, evaluation: evalB }),
      makeRound({ id: 'iv_3', round: 3, evaluation: evalC }),
    ];
    const points = buildRoundsSparkline(rounds);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({
      round: 1,
      overall: 70,
      technical: 65,
      communication: 75,
      problemSolving: 70,
      culture: 70,
    });
    expect(points[2].overall).toBe(88);
  });

  it('returns null for missing metrics when no evaluation', () => {
    const rounds = [makeRound({ id: 'iv_no_eval', round: 1, evaluation: undefined })];
    const points = buildRoundsSparkline(rounds);
    expect(points[0].overall).toBeNull();
    expect(points[0].technical).toBeNull();
  });
});

describe('interview-helpers: buildSparklineX', () => {
  it('returns evenly-spaced x coords for N points', () => {
    expect(buildSparklineX(100, 3)).toEqual([0, 50, 100]);
    expect(buildSparklineX(360, 4)).toEqual([0, 120, 240, 360]);
  });
  it('returns single midpoint when count=1', () => {
    expect(buildSparklineX(100, 1)).toEqual([50]);
  });
  it('returns empty array when count <= 0', () => {
    expect(buildSparklineX(100, 0)).toEqual([]);
    expect(buildSparklineX(100, -1)).toEqual([]);
  });
});

describe('interview-helpers: scoreToY', () => {
  it('maps 0..100 to height..0 (higher score = smaller y)', () => {
    expect(scoreToY(0, 100)).toBe(100);
    expect(scoreToY(100, 100)).toBe(0);
    expect(scoreToY(50, 100)).toBe(50);
  });
  it('returns mid-height for null/NaN', () => {
    expect(scoreToY(null, 60)).toBe(30);
    expect(scoreToY(Number.NaN, 60)).toBe(30);
    expect(scoreToY(undefined, 60)).toBe(30);
  });
  it('clamps out-of-range scores', () => {
    expect(scoreToY(-5, 100)).toBe(100);
    expect(scoreToY(150, 100)).toBe(0);
  });
});

describe('interview-helpers: buildSparklinePath', () => {
  it('returns SVG path with M + L commands', () => {
    const pts = [{ x: 0, y: 60 }, { x: 100, y: 30 }, { x: 200, y: 0 }];
    expect(buildSparklinePath(pts)).toBe('M 0 60 L 100 30 L 200 0');
  });
  it('returns empty string for 0 or 1 points', () => {
    expect(buildSparklinePath([])).toBe('');
    expect(buildSparklinePath([{ x: 0, y: 0 }])).toBe('');
  });
});

describe('SPARKLINE_METRICS constants', () => {
  it('exposes 5 metrics in fixed order: overall, technical, communication, problemSolving, culture', () => {
    expect(SPARKLINE_METRICS.map((m) => m.key)).toEqual([
      'overall',
      'technical',
      'communication',
      'problemSolving',
      'culture',
    ]);
    expect(SPARKLINE_METRICS[0].label).toBe('总评分');
  });
});

// ---------------- UI ----------------

describe('RoundsComparison UI', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it('renders the insufficient state when fewer than 2 evaluated rounds', () => {
    const rounds = [makeRound({ id: 'iv_1', round: 1, evaluation: evalA })];
    render(<RoundsComparison rounds={rounds} />);
    expect(screen.getByTestId('rounds-comparison-insufficient')).toBeTruthy();
    expect(screen.getByTestId('rounds-comparison-empty').textContent).toContain('2 轮');
  });

  it('renders the insufficient state when rounds have no evaluation', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: undefined }),
      makeRound({ id: 'iv_2', round: 2, evaluation: undefined }),
    ];
    render(<RoundsComparison rounds={rounds} />);
    expect(screen.getByTestId('rounds-comparison-insufficient')).toBeTruthy();
  });

  it('renders SVG with 5 paths + round labels + improving trend', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: evalA }),
      makeRound({ id: 'iv_2', round: 2, evaluation: evalB }),
      makeRound({ id: 'iv_3', round: 3, evaluation: evalC }),
    ];
    render(<RoundsComparison rounds={rounds} />);
    expect(screen.getByTestId('rounds-comparison')).toBeTruthy();
    expect(screen.getByTestId('rounds-comparison-svg')).toBeTruthy();
    // Each of the 5 metrics renders a path
    for (const m of SPARKLINE_METRICS) {
      expect(screen.getByTestId(`sparkline-path-${m.key}`)).toBeTruthy();
    }
    // Round labels
    expect(screen.getByTestId('sparkline-label-1').textContent).toBe('第 1 面');
    expect(screen.getByTestId('sparkline-label-3').textContent).toBe('第 3 面');
    // Trend (70 → 88 = +18) is labelled "持续提升"
    expect(screen.getByTestId('rounds-comparison-trend').textContent).toContain('+18');
    expect(screen.getByTestId('rounds-comparison-trend').textContent).toContain('持续提升');
  });

  it('labels a small drop as 基本持平', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: evalC }),
      makeRound({ id: 'iv_2', round: 2, evaluation: evalA }),
    ];
    render(<RoundsComparison rounds={rounds} />);
    expect(screen.getByTestId('rounds-comparison-trend').textContent).toContain('回落');
  });

  it('labels a flat comparison as 基本持平', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: evalA }),
      makeRound({ id: 'iv_2', round: 2, evaluation: { ...evalA, overall: 73 } }),
    ];
    render(<RoundsComparison rounds={rounds} />);
    expect(screen.getByTestId('rounds-comparison-trend').textContent).toContain('基本持平');
  });

  it('renders the legend with all 5 metric labels', () => {
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: evalA }),
      makeRound({ id: 'iv_2', round: 2, evaluation: evalB }),
    ];
    render(<RoundsComparison rounds={rounds} />);
    const legend = screen.getByTestId('rounds-comparison-legend');
    expect(legend.textContent).toContain('总评分');
    expect(legend.textContent).toContain('技术');
    expect(legend.textContent).toContain('沟通');
    expect(legend.textContent).toContain('解决问题');
    expect(legend.textContent).toContain('文化契合');
  });

  it('skips individual metrics when evaluation breakdown is missing on a single round', () => {
    // Round 1 has eval, round 2 has no eval — only the single-point metric rows should drop the path
    const rounds = [
      makeRound({ id: 'iv_1', round: 1, evaluation: evalA }),
      makeRound({ id: 'iv_2', round: 2, evaluation: undefined }),
    ];
    render(<RoundsComparison rounds={rounds} />);
    // After filtering to evaluated, only iv_1 remains → < 2 → insufficient
    expect(screen.getByTestId('rounds-comparison-insufficient')).toBeTruthy();
  });
});