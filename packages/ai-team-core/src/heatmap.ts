// V23: 组织能力热力图 — 按团队/岗位 × 技能聚合

import type { Member, Skill, SkillScore } from './types/index.js';

export type HeatmapLevel = 'critical' | 'low' | 'medium' | 'high';

export interface HeatmapCell {
  team: string;       // 团队
  role: string;       // 岗位
  skillId: string;
  skillName: string;
  /** 平均分 (0-100)，未覆盖则为 0 */
  averageScore: number;
  /** 覆盖成员数 */
  coverageCount: number;
  /** 应覆盖成员数（该 team+role 成员中分配到此技能的） */
  expectedCount: number;
  coverageRate: number;       // coverageCount / expectedCount
  level: HeatmapLevel;        // 根据 averageScore 划分
  gap: number;                // max(0, 70 - averageScore)
}

export interface HeatmapReport {
  rows: Array<{ team: string; role: string }>;
  cols: Array<{ skillId: string; skillName: string }>;
  cells: HeatmapCell[];
  /** 全局平均分 */
  overallAverage: number;
  /** critical gap 数量 */
  criticalGaps: number;
  generatedAt: string;
}

export const HEATMAP_LEVEL_THRESHOLDS = {
  critical: 30,
  low: 50,
  medium: 70,
  high: 101,  // exclusive upper bound; 71..100 is high
};

export function classifyLevel(score: number): HeatmapLevel {
  if (score < HEATMAP_LEVEL_THRESHOLDS.critical) return 'critical';
  if (score < HEATMAP_LEVEL_THRESHOLDS.low) return 'low';
  if (score <= HEATMAP_LEVEL_THRESHOLDS.medium) return 'medium';
  return 'high';
}

export interface HeatmapOptions {
  /** 目标覆盖率分母阈值（每个 team+role 的最小成员数），默认 1 */
  minTeamSize?: number;
  /** 期望分（用于计算 gap），默认 70 */
  targetScore?: number;
}

/**
 * 生成能力热力图：横轴技能，纵轴团队×岗位组合。
 * 对于每个组合，按其成员在每个技能上的平均分填格子。
 */
export function buildHeatmap(
  members: Member[],
  skills: Skill[],
  opts: HeatmapOptions = {}
): HeatmapReport {
  const minTeamSize = opts.minTeamSize ?? 1;
  const target = opts.targetScore ?? 70;

  // 1. 收集 (team, role) 组合
  const groupKey = (m: Member) => `${m.team}::${m.role}`;
  const groups = new Map<string, { team: string; role: string; members: Member[] }>();
  for (const m of members) {
    if (m.status !== 'active') continue;
    const k = groupKey(m);
    if (!groups.has(k)) groups.set(k, { team: m.team, role: m.role, members: [] });
    groups.get(k)!.members.push(m);
  }

  const filteredGroups = Array.from(groups.values()).filter((g) => g.members.length >= minTeamSize);

  // 2. 技能维度
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  const skillIds = skills.map((s) => s.id);

  // 3. 计算每个 cell
  const cells: HeatmapCell[] = [];
  for (const g of filteredGroups) {
    for (const skillId of skillIds) {
      const skill = skillMap.get(skillId);
      if (!skill) continue;
      const scores: number[] = [];
      for (const m of g.members) {
        const sc = m.skills.find((s: SkillScore) => s.skillId === skillId);
        if (sc) scores.push(sc.score);
      }
      const coverageCount = scores.length;
      const expectedCount = g.members.length;
      const coverageRate = expectedCount > 0 ? coverageCount / expectedCount : 0;
      const averageScore = scores.length > 0
        ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : 0;
      const level = coverageCount > 0 ? classifyLevel(averageScore) : 'critical';
      const gap = Math.max(0, target - averageScore);
      cells.push({
        team: g.team,
        role: g.role,
        skillId,
        skillName: skill.name,
        averageScore,
        coverageCount,
        expectedCount,
        coverageRate: +coverageRate.toFixed(4),
        level,
        gap,
      });
    }
  }

  // 4. 收集 row/col 标签
  const rows = filteredGroups.map((g) => ({ team: g.team, role: g.role }));
  const cols = skills.map((s) => ({ skillId: s.id, skillName: s.name }));

  // 5. 全局平均
  const allScores = cells.map((c) => c.averageScore).filter((s) => s > 0);
  const overallAverage = allScores.length > 0
    ? +(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2)
    : 0;

  // 6. critical gap 数
  const criticalGaps = cells.filter((c) => c.level === 'critical' && c.coverageCount > 0).length;

  return {
    rows,
    cols,
    cells,
    overallAverage,
    criticalGaps,
    generatedAt: new Date().toISOString(),
  };
}