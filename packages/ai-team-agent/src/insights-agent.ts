// Insights Agent - LLM-powered recommendations + analytics

import { LLMClient, buildInsightsMessages } from '@ai-team/ai';
import type { Member, Interview, Candidate, Review } from '@ai-team/core';

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'hiring' | 'training' | 'process' | 'culture';
  message: string;
}

export interface InsightsContext {
  members: Member[];
  candidates: Candidate[];
  interviews: Interview[];
  reviews: Review[];
  /** Top required skills (optional) - what the org is looking for */
  requiredSkills?: string[];
}

export interface InsightsResult {
  recommendations: Recommendation[];
  summary: string;
  /** Detected anomalies (e.g. declining scores, training stagnation) */
  anomalies: Array<{
    type: 'declining_score' | 'training_stalled' | 'review_drop' | 'skill_stagnation';
    memberId?: string;
    message: string;
    severity: 'warning' | 'critical';
  }>;
}

export class InsightsAgent {
  constructor(private llm: LLMClient, private opts: { model?: string } = {}) {}

  /**
   * Generate AI-powered insights and recommendations based on team data.
   */
  async analyze(ctx: InsightsContext): Promise<InsightsResult> {
    // Detect anomalies algorithmically (no LLM needed for these)
    const anomalies = detectAnomalies(ctx);

    // Use LLM to generate strategic recommendations
    const messages = buildInsightsMessages({
      members: ctx.members.map((m) => ({
        name: m.name,
        role: m.role,
        team: m.team,
        level: m.level,
        skills: m.skills.map((s) => ({ name: s.skillId, score: s.score })),
      })),
      candidates: ctx.candidates.length,
      interviewsCompleted: ctx.interviews.filter((i) => i.status === 'completed').length,
      interviewsFailed: ctx.interviews.filter((i) => i.status === 'completed' && i.evaluation?.recommendation === 'no_hire').length,
      averageScore: avgInterviewScore(ctx.interviews),
      requiredSkills: ctx.requiredSkills ?? [],
    });

    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.5,
    });

    return this.parseResult(resp.content, anomalies);
  }

  private parseResult(content: string, anomalies: InsightsResult['anomalies']): InsightsResult {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        summary: content.slice(0, 300),
        recommendations: [{
          priority: 'medium',
          category: 'process',
          message: '继续完善团队数据以获取更精准的分析',
        }],
        anomalies,
      };
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: String(parsed.summary ?? ''),
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map((r: { priority?: string; category?: string; message?: string }) => ({
              priority: (['high', 'medium', 'low'] as const).find((p) => p === r.priority) ?? 'medium',
              category: (['hiring', 'training', 'process', 'culture'] as const).find((c) => c === r.category) ?? 'process',
              message: String(r.message ?? ''),
            })).filter((r) => r.message)
          : [],
        anomalies,
      };
    } catch {
      return {
        summary: content.slice(0, 300),
        recommendations: [],
        anomalies,
      };
    }
  }
}

// ============== Pure analytics functions (no LLM) ==============

export interface FunnelStage {
  stage: string;
  count: number;
}
export interface FunnelResult {
  stages: FunnelStage[];
  conversionRates: Array<{ from: string; to: string; rate: number }>;
  bySource: Array<{ source: string; total: number; hired: number; rate: number }>;
  totalCandidates: number;
  totalHired: number;
  overallRate: number;
}

export function computeFunnel(candidates: Candidate[], interviews: Interview[]): FunnelResult {
  const stages: FunnelStage[] = [];
  const byStatus = new Map<string, number>();
  for (const c of candidates) {
    byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
  }
  const stageOrder = ['new', 'screening', 'interviewing', 'offer', 'hired', 'rejected'];
  for (const s of stageOrder) {
    stages.push({ stage: s, count: byStatus.get(s) ?? 0 });
  }
  // Conversion rates
  const conversionRates: FunnelResult['conversionRates'] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    if (from.count > 0 && (to.stage === 'hired' || to.stage === 'rejected')) {
      conversionRates.push({
        from: from.stage,
        to: to.stage,
        rate: to.count / from.count,
      });
    }
  }
  // By source
  const sourceMap = new Map<string, { total: number; hired: number }>();
  for (const c of candidates) {
    const s = sourceMap.get(c.source) ?? { total: 0, hired: 0 };
    s.total++;
    if (c.status === 'hired') s.hired++;
    sourceMap.set(c.source, s);
  }
  const bySource = [...sourceMap.entries()].map(([source, v]) => ({
    source,
    total: v.total,
    hired: v.hired,
    rate: v.total > 0 ? v.hired / v.total : 0,
  }));
  const totalCandidates = candidates.length;
  const totalHired = byStatus.get('hired') ?? 0;
  return {
    stages,
    conversionRates,
    bySource,
    totalCandidates,
    totalHired,
    overallRate: totalCandidates > 0 ? totalHired / totalCandidates : 0,
  };
}

export interface SkillGap {
  skill: string;
  teamAvg: number;
  membersWithSkill: number;
  demandLevel: 'low' | 'medium' | 'high';
  gap: number; // negative = gap, positive = surplus
}

export function computeSkillGaps(members: Member[], requiredSkills: string[] = []): SkillGap[] {
  const skillMap = new Map<string, { total: number; count: number }>();
  for (const m of members) {
    for (const s of m.skills) {
      const cur = skillMap.get(s.skillId) ?? { total: 0, count: 0 };
      cur.total += s.score;
      cur.count += 1;
      skillMap.set(s.skillId, cur);
    }
  }
  // Compute averages
  const gaps: SkillGap[] = [];
  const skillsToCheck = new Set([...requiredSkills, ...skillMap.keys()]);
  for (const skill of skillsToCheck) {
    const data = skillMap.get(skill);
    const teamAvg = data ? Math.round(data.total / data.count) : 0;
    const membersWithSkill = data?.count ?? 0;
    // demandLevel based on whether it's a required skill and team avg
    let demandLevel: 'low' | 'medium' | 'high' = 'low';
    if (requiredSkills.includes(skill) && teamAvg < 60) demandLevel = 'high';
    else if (requiredSkills.includes(skill) || teamAvg < 50) demandLevel = 'medium';
    // gap: how far below 70 (target)
    const gap = 70 - teamAvg;
    gaps.push({ skill, teamAvg, membersWithSkill, demandLevel, gap });
  }
  // Sort by demand level (high first) then by gap (most negative first)
  gaps.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as Record<string, number>;
    const da = order[a.demandLevel];
    const db = order[b.demandLevel];
    if (da !== db) return da - db;
    return a.gap - b.gap;
  });
  return gaps;
}

export interface GrowthTimeline {
  memberId: string;
  name: string;
  timeline: Array<{ date: string; skills: Array<{ skillId: string; score: number }> }>;
  growth: Record<string, number>; // skillId -> total growth
}

export function computeMemberGrowth(member: Member, reviews: Review[]): GrowthTimeline {
  // Build timeline from reviews
  const reviewsByMember = reviews
    .filter((r) => r.memberId === member.id)
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));

  const timeline: GrowthTimeline['timeline'] = [];
  // Initial: skills as of member.joinedAt
  timeline.push({
    date: member.joinedAt.slice(0, 7),
    skills: member.skills.map((s) => ({ skillId: s.skillId, score: s.score })),
  });
  // Add each review as a snapshot
  for (const r of reviewsByMember) {
    const reviewSkills: Array<{ skillId: string; score: number }> = [];
    // Estimate skills from rating (no detailed skill data in reviews, so use rating)
    // For now, interpolate based on review period
    const monthsBetween = monthsDiff(timeline[0].date, r.reviewedAt);
    for (const s of member.skills) {
      // Approximate growth: +5% per quarter if rating >= 4
      const quarters = Math.max(1, monthsBetween / 3);
      const growth = r.rating >= 4 ? Math.round(quarters * 5) : 0;
      reviewSkills.push({ skillId: s.skillId, score: Math.min(100, s.score + growth) });
    }
    timeline.push({ date: r.reviewedAt.slice(0, 7), skills: reviewSkills });
  }

  // Compute total growth
  const growth: Record<string, number> = {};
  if (timeline.length >= 2) {
    const first = timeline[0].skills;
    const last = timeline[timeline.length - 1].skills;
    for (const f of first) {
      const l = last.find((x) => x.skillId === f.skillId);
      if (l) growth[f.skillId] = l.score - f.score;
    }
  }
  return {
    memberId: member.id,
    name: member.name,
    timeline,
    growth,
  };
}

function monthsDiff(fromYM: string, toIso: string): number {
  const fromDate = new Date(fromYM + '-01');
  const toDate = new Date(toIso);
  return Math.max(0, (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

function avgInterviewScore(interviews: Interview[]): number {
  const completed = interviews.filter((i) => i.evaluation);
  if (completed.length === 0) return 0;
  const sum = completed.reduce((s, i) => s + (i.evaluation?.overall ?? 0), 0);
  return Math.round(sum / completed.length);
}

export function detectAnomalies(ctx: InsightsContext): InsightsResult['anomalies'] {
  const anomalies: InsightsResult['anomalies'] = [];

  // 1. Declining interview scores
  const recentByMember = new Map<string, number[]>();
  for (const iv of ctx.interviews) {
    if (iv.status !== 'completed' || !iv.evaluation) continue;
    const arr = recentByMember.get(iv.candidateId) ?? [];
    arr.push(iv.evaluation.overall);
    recentByMember.set(iv.candidateId, arr);
  }

  // 2. Training stalled
  for (const m of ctx.members) {
    const stalled = m.trainings.filter((t) => t.status === 'in_progress' && t.progress < 10);
    if (stalled.length > 0) {
      anomalies.push({
        type: 'training_stalled',
        memberId: m.id,
        message: `${m.name} 有 ${stalled.length} 项培训长期无进展`,
        severity: 'warning',
      });
    }
  }

  // 3. Review rating drops
  const reviewsByMember = new Map<string, number[]>();
  for (const r of ctx.reviews) {
    const arr = reviewsByMember.get(r.memberId) ?? [];
    arr.push(r.rating);
    reviewsByMember.set(r.memberId, arr);
  }
  for (const [memberId, ratings] of reviewsByMember.entries()) {
    if (ratings.length >= 2) {
      const last = ratings[ratings.length - 1];
      const prev = ratings[ratings.length - 2];
      if (last < prev - 1) {
        const member = ctx.members.find((m) => m.id === memberId);
        anomalies.push({
          type: 'review_drop',
          memberId,
          message: `${member?.name ?? memberId} 评分从 ${prev}★ 跌到 ${last}★`,
          severity: last <= 2 ? 'critical' : 'warning',
        });
      }
    }
  }

  // 4. Skill stagnation
  for (const m of ctx.members) {
    if (m.skills.length === 0) {
      anomalies.push({
        type: 'skill_stagnation',
        memberId: m.id,
        message: `${m.name} 尚无技能记录`,
        severity: 'warning',
      });
    }
  }

  return anomalies;
}
