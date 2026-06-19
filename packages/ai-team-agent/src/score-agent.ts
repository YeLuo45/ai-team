// Score Agent - context-aware resume scoring

import { LLMClient } from '@ai-team/ai';
import type { ExtractedResume, JobMatch } from './resume-agent.js';
import type { Member, Skill } from '@ai-team/core';

export interface ContextScoreInput {
  resume: ExtractedResume;
  position: string;
  jobDescription?: string;
  teamMembers: Member[];
  requiredSkills: string[];
  skills: Skill[];
}

export interface ContextScore extends JobMatch {
  skillMatch: Array<{ skill: string; has: boolean; score: number; importance: 'critical' | 'high' | 'medium' | 'low' }>;
  teamGaps: Array<{ skill: string; gap: number; importance: 'critical' | 'high' | 'medium' }>;
  recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire' | 'unknown';
  summary: string;
  strengths: string[];
  concerns: string[];
  consideredSkills: string[];
}

const PROMPT_SYSTEM = `你是一位资深招聘 HR。基于候选人简历 + 当前团队技能缺口 + 岗位要求,综合评估候选人是否适合加入团队。

返回严格的 JSON 格式:
{
  "overallScore": 0-100 综合分数,
  "summary": "一句话总结为什么这个分数",
  "recommendation": "strong_hire|hire|maybe|no_hire",
  "strengths": ["候选人优点 1", "优点 2"],
  "concerns": ["担忧 1", "担忧 2"],
  "skillMatch": [
    { "skill": "技能名", "has": true/false, "score": 0-100, "importance": "critical|high|medium|low" }
  ],
  "teamGaps": [
    { "skill": "技能名", "gap": -100~0, "importance": "critical|high|medium" }
  ]
}`;

const PROMPT_USER = (data: string) => `评估候选人:

${data}

请返回 JSON。`;

export class ScoreAgent {
  constructor(private llm: LLMClient, private opts: { model?: string } = {}) {}

  async scoreWithContext(input: ContextScoreInput): Promise<ContextScore> {
    // Compute algorithmic skill gaps
    const gaps = this.computeTeamGaps(input.teamMembers, input.skills, input.requiredSkills);

    // Build prompt
    const data = this.buildContextData(input, gaps);
    const messages = [
      { role: 'system' as const, content: PROMPT_SYSTEM },
      { role: 'user' as const, content: PROMPT_USER(data) },
    ];

    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.4,
    });

    return this.parseResponse(resp.content, gaps, input);
  }

  private buildContextData(input: ContextScoreInput, gaps: Array<{ skill: string; gap: number; importance: string }>): string {
    const resumeStr = `
候选人: ${input.resume.name}
岗位: ${input.position}
${input.jobDescription ? `岗位描述: ${input.jobDescription}` : ''}
${input.resume.yearsOfExperience ? `经验: ${input.resume.yearsOfExperience} 年` : ''}
技能: ${input.resume.skills.join(', ')}
`.trim();

    const teamStr = `
当前团队 (${input.teamMembers.length} 人):
${input.teamMembers.slice(0, 20).map((m) => `- ${m.name} (${m.role}, ${m.team}${m.level ? `, ${m.level}` : ''}): ${m.skills.map((s) => `${s.skillId}=${s.score}`).join(', ')}`).join('\n')}
`.trim();

    const gapsStr = gaps.length > 0
      ? `团队技能缺口 (已计算):
${gaps.map((g) => `- ${g.skill}: 缺口 ${g.gap} (${g.importance})`).join('\n')}`
      : '团队技能缺口: 无';

    return `${resumeStr}\n\n${teamStr}\n\n${gapsStr}`;
  }

  private computeTeamGaps(members: Member[], _skills: Skill[], required: string[]): Array<{ skill: string; gap: number; importance: string }> {
    const skillMap = new Map<string, { total: number; count: number }>();
    for (const m of members) {
      for (const s of m.skills) {
        const cur = skillMap.get(s.skillId) ?? { total: 0, count: 0 };
        cur.total += s.score;
        cur.count += 1;
        skillMap.set(s.skillId, cur);
      }
    }

    const gaps: Array<{ skill: string; gap: number; importance: string }> = [];
    for (const skill of required) {
      const data = skillMap.get(skill);
      const teamAvg = data ? Math.round(data.total / data.count) : 0;
      const gap = 70 - teamAvg;
      let importance = 'low';
      if (teamAvg < 30) importance = 'critical';
      else if (teamAvg < 50) importance = 'high';
      else if (teamAvg < 65) importance = 'medium';
      gaps.push({ skill, gap, importance });
    }
    gaps.sort((a, b) => a.gap - b.gap);
    return gaps;
  }

  private parseResponse(content: string, gaps: Array<{ skill: string; gap: number; importance: string }>, input: ContextScoreInput): ContextScore {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.fallbackScore(content, gaps, input);
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const overallScore = Math.max(0, Math.min(100, Math.round(Number(parsed.overallScore) || 50)));
      const recommendation = (['strong_hire', 'hire', 'maybe', 'no_hire'] as const).find((r) => r === parsed.recommendation) ?? 'maybe';
      const score = overallScore;
      const matchLevel: 'excellent' | 'good' | 'partial' | 'poor' =
        score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'partial' : 'poor';
      return {
        overallScore,
        matchLevel,
        summary: String(parsed.summary ?? ''),
        recommendation,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
        skillMatch: Array.isArray(parsed.skillMatch)
          ? parsed.skillMatch.map((s: { skill?: string; has?: boolean; score?: number; importance?: string }) => ({
              skill: String(s.skill ?? ''),
              has: Boolean(s.has),
              score: Math.max(0, Math.min(100, Math.round(Number(s.score) || 0))),
              importance: (['critical', 'high', 'medium', 'low'] as const).find((i) => i === s.importance) ?? 'medium',
            }))
          : [],
        teamGaps: gaps.map((g) => ({
          skill: g.skill,
          gap: g.gap,
          importance: (['critical', 'high', 'medium'] as const).find((i) => i === g.importance) ?? 'medium',
        })),
        recommendations: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
        consideredSkills: input.requiredSkills,
      };
    } catch {
      return this.fallbackScore(content, gaps, input);
    }
  }

  private fallbackScore(content: string, gaps: Array<{ skill: string; gap: number; importance: string }>, input: ContextScoreInput): ContextScore {
    return {
      overallScore: 50,
      matchLevel: 'partial',
      summary: content.slice(0, 200),
      recommendation: 'maybe',
      strengths: [],
      concerns: [],
      skillMatch: input.requiredSkills.map((s) => ({ skill: s, has: input.resume.skills.includes(s), score: 50, importance: 'medium' as const })),
      teamGaps: gaps.map((g) => ({ skill: g.skill, gap: g.gap, importance: (['critical', 'high', 'medium'] as const).find((i) => i === g.importance) ?? 'medium' })),
      recommendations: [],
      consideredSkills: input.requiredSkills,
    };
  }
}
