// V23: buildHeatmap tests
import { describe, it, expect } from 'vitest';
import { buildHeatmap, classifyLevel, HEATMAP_LEVEL_THRESHOLDS } from '../src/heatmap.js';
import type { Member, Skill } from '../src/types/index.js';

const skills: Skill[] = [
  { id: 'sk_ts', name: 'TypeScript', category: 'technical' },
  { id: 'sk_react', name: 'React', category: 'technical' },
  { id: 'sk_a11y', name: 'A11y', category: 'domain' },
];

function mb(id: string, team: string, role: string, scored: Array<[string, number]>, status: Member['status'] = 'active'): Member {
  return {
    id, name: id, team, role, joinedAt: '2026-01-01T00:00:00Z',
    skills: scored.map(([skillId, score]) => ({ skillId, score, assessedAt: '2026-01-01T00:00:00Z' })),
    trainings: [], reviews: [], status,
  };
}

describe('classifyLevel', () => {
  it('classifies by threshold', () => {
    expect(classifyLevel(0)).toBe('critical');
    expect(classifyLevel(HEATMAP_LEVEL_THRESHOLDS.critical - 1)).toBe('critical');
    expect(classifyLevel(HEATMAP_LEVEL_THRESHOLDS.critical)).toBe('low');
    expect(classifyLevel(HEATMAP_LEVEL_THRESHOLDS.low - 1)).toBe('low');
    expect(classifyLevel(HEATMAP_LEVEL_THRESHOLDS.low)).toBe('medium');
    expect(classifyLevel(HEATMAP_LEVEL_THRESHOLDS.medium - 1)).toBe('medium');
    expect(classifyLevel(HEATMAP_LEVEL_THRESHOLDS.medium)).toBe('medium');
    expect(classifyLevel(HEATMAP_LEVEL_THRESHOLDS.medium + 1)).toBe('high');
    expect(classifyLevel(100)).toBe('high');
  });
});

describe('buildHeatmap', () => {
  it('returns empty report for no members', () => {
    const r = buildHeatmap([], skills);
    expect(r.rows).toEqual([]);
    expect(r.cols).toHaveLength(3);
    expect(r.cells).toEqual([]);
    expect(r.overallAverage).toBe(0);
    expect(r.criticalGaps).toBe(0);
  });

  it('groups members by team+role, ignores non-active', () => {
    const members = [
      mb('m1', 'Platform', 'Engineer', [['sk_ts', 80]]),
      mb('m2', 'Platform', 'Engineer', [['sk_ts', 60]]),
      mb('m3', 'Platform', 'Engineer', [['sk_ts', 40]], 'on_leave'),
    ];
    const r = buildHeatmap(members, skills);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toEqual({ team: 'Platform', role: 'Engineer' });
    // active members: m1, m2 (m3 excluded)
    const cell = r.cells.find((c) => c.skillId === 'sk_ts')!;
    expect(cell.expectedCount).toBe(2);
    expect(cell.coverageCount).toBe(2);
    expect(cell.averageScore).toBe(70);
    expect(cell.level).toBe('medium');
  });

  it('marks cells critical when skill not covered', () => {
    const members = [mb('m1', 'Web', 'FE', [['sk_ts', 90]])];
    const r = buildHeatmap(members, skills);
    const a11y = r.cells.find((c) => c.skillId === 'sk_a11y')!;
    expect(a11y.coverageCount).toBe(0);
    expect(a11y.averageScore).toBe(0);
    expect(a11y.level).toBe('critical');
    expect(a11y.gap).toBe(70);
  });

  it('classifies critical by averageScore when covered', () => {
    const members = [mb('m1', 'A', 'B', [['sk_ts', 20]])];
    const r = buildHeatmap(members, skills);
    const cell = r.cells.find((c) => c.skillId === 'sk_ts')!;
    expect(cell.averageScore).toBe(20);
    expect(cell.level).toBe('critical');
    // coverageCount > 0 + critical → counted
    expect(r.criticalGaps).toBe(1);
  });

  it('counts criticalGaps only when coverageCount > 0', () => {
    // uncovered skills should NOT count as critical gap (no signal)
    const members = [mb('m1', 'A', 'B', [['sk_ts', 20]])];
    const r = buildHeatmap(members, skills);
    // Only sk_ts has coverage at critical; sk_react and sk_a11y are uncovered
    expect(r.criticalGaps).toBe(1);
  });

  it('honors targetScore option', () => {
    const members = [mb('m1', 'A', 'B', [['sk_ts', 50]])];
    const r = buildHeatmap(members, skills, { targetScore: 60 });
    const cell = r.cells.find((c) => c.skillId === 'sk_ts')!;
    expect(cell.gap).toBe(10);
  });

  it('honors minTeamSize option (filter small groups)', () => {
    const members = [
      mb('m1', 'Big', 'Dev', [['sk_ts', 80]]),
      mb('m2', 'Big', 'Dev', [['sk_ts', 70]]),
      mb('m3', 'Solo', 'Dev', [['sk_ts', 90]]),
    ];
    const r = buildHeatmap(members, skills, { minTeamSize: 2 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toEqual({ team: 'Big', role: 'Dev' });
  });

  it('handles multiple groups independently', () => {
    const members = [
      mb('m1', 'Web', 'FE', [['sk_ts', 90], ['sk_react', 80]]),
      mb('m2', 'Ops', 'SRE', [['sk_ts', 60], ['sk_react', 50]]),
    ];
    const r = buildHeatmap(members, skills);
    expect(r.rows).toHaveLength(2);
    const ts = r.cells.filter((c) => c.skillId === 'sk_ts');
    expect(ts).toHaveLength(2);
    const opsCell = ts.find((c) => c.team === 'Ops')!;
    expect(opsCell.averageScore).toBe(60);
  });

  it('overallAverage excludes cells with no coverage', () => {
    const members = [mb('m1', 'A', 'B', [['sk_ts', 80]])];
    const r = buildHeatmap(members, skills);
    // only sk_ts contributes; sk_react and sk_a11y are 0/uncovered
    expect(r.overallAverage).toBe(80);
  });

  it('generatedAt is valid ISO', () => {
    const r = buildHeatmap([], skills);
    expect(new Date(r.generatedAt).toString()).not.toBe('Invalid Date');
  });
});