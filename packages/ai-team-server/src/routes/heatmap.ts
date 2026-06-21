// V23: Capability heatmap route
// V32: Cell drill-down — returns members for a (team, role, skill) cell

import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import type { MemberStore, JsonStore, Member, SkillScore } from '@ai-team/core';
import { buildHeatmap, type Skill, type HeatmapReport } from '@ai-team/core';

export interface HeatmapDeps {
  memberStore: MemberStore;
  skillStore: JsonStore<Skill>;
}

export interface HeatmapCellDetail {
  team: string;
  role: string;
  skillId: string;
  skillName: string;
  averageScore: number;
  coverageCount: number;
  expectedCount: number;
  members: Array<{
    memberId: string;
    name: string;
    level?: string;
    score: number | null;
  }>;
}

export function createHeatmapRouter(deps: HeatmapDeps): Router {
  const router = createRouter();

  // GET /api/insights/capability-heatmap — 组织能力热力图
  router.get('/', async (req: Request, res: Response) => {
    try {
      const members = await deps.memberStore.list();
      const skills = await deps.skillStore.list();
      const targetRaw = req.query.target;
      const target = typeof targetRaw === 'string' ? parseInt(targetRaw, 10) : 70;
      const safeTarget = Number.isFinite(target) && target > 0 && target <= 100 ? target : 70;
      const minRaw = req.query.minTeamSize;
      const minTeamSize = typeof minRaw === 'string' ? parseInt(minRaw, 10) : 1;
      const safeMin = Number.isFinite(minTeamSize) && minTeamSize >= 1 && minTeamSize <= 100 ? minTeamSize : 1;
      const report: HeatmapReport = buildHeatmap(members, skills, { targetScore: safeTarget, minTeamSize: safeMin });
      res.json(report);
    } catch (e: unknown) {
      res.status(500).json(errPayload('capability_heatmap_failed', e));
    }
  });

  // V32: GET /api/insights/capability-heatmap/cell?team=&role=&skill=
  router.get('/cell', async (req: Request, res: Response) => {
    try {
      const team = typeof req.query.team === 'string' ? req.query.team : '';
      const role = typeof req.query.role === 'string' ? req.query.role : '';
      const skillId = typeof req.query.skill === 'string' ? req.query.skill : '';
      if (!team || !role || !skillId) {
        return res.status(400).json({ error: 'validation_error', message: 'team, role, skill required' });
      }
      const members = await deps.memberStore.list();
      const skills = await deps.skillStore.list();
      const skill = skills.find((s) => s.id === skillId);
      if (!skill) {
        return res.status(404).json({ error: 'skill_not_found', message: `skill ${skillId} not found` });
      }
      const teamMembers = members.filter((m) => m.team === team && m.role === role && m.status === 'active');
      const scores = teamMembers.map((m: Member) => {
        const sc = m.skills.find((s: SkillScore) => s.skillId === skillId);
        return sc?.score ?? null;
      });
      const numericScores = scores.filter((s): s is number => s !== null);
      const averageScore = numericScores.length > 0
        ? +(numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(2)
        : 0;
      const detail: HeatmapCellDetail = {
        team,
        role,
        skillId,
        skillName: skill.name,
        averageScore,
        coverageCount: numericScores.length,
        expectedCount: teamMembers.length,
        members: teamMembers.map((m, i) => ({
          memberId: m.id,
          name: m.name,
          ...(m.level ? { level: m.level } : {}),
          score: scores[i],
        })),
      };
      res.json(detail);
    } catch (e: unknown) {
      res.status(500).json(errPayload('heatmap_cell_failed', e));
    }
  });

  return router;
}

function errPayload(code: string, e: unknown): { error: string; message: string } {
  const msg = e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string'
    ? (e as { message: string }).message
    : 'unknown';
  return { error: code, message: msg };
}