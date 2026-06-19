// Review Agent - AI-assisted draft generation for performance reviews

import { LLMClient } from '@ai-team/ai';
import type { Member, Training, Interview, Review } from '@ai-team/core';

export interface ReviewDraft {
  rating: 1 | 2 | 3 | 4 | 5;
  summary: string;
  achievements: string[];
  growthAreas: string[];
  nextGoals: string[];
}

export interface ReviewContext {
  member: Member;
  period: string;
  trainings: Training[];
  interviews: Interview[];
  recentReviews: Review[];
  /** Optional reviewer name (e.g. "Manager Wang") */
  reviewer?: string;
}

export class ReviewAgent {
  constructor(private llm: LLMClient, private opts: { model?: string } = {}) {}

  async generateDraft(ctx: ReviewContext): Promise<ReviewDraft> {
    const skillsAvg = ctx.member.skills.length > 0
      ? Math.round(ctx.member.skills.reduce((s, sk) => s + sk.score, 0) / ctx.member.skills.length)
      : 0;
    const completedTrainings = ctx.trainings.filter((t) => t.memberId === ctx.member.id && t.status === 'completed');
    void ctx.interviews;

    const messages = [
      {
        role: 'system' as const,
        content: '你是一位经验丰富的技术经理，擅长撰写绩效评估。基于成员信息生成结构化的 Review 草稿。只输出严格的 JSON 格式。',
      },
      {
        role: 'user' as const,
        content: `员工信息:
- 姓名: ${ctx.member.name}
- 角色: ${ctx.member.role}${ctx.member.level ? ` (${ctx.member.level})` : ''}
- 团队: ${ctx.member.team}
- 入职: ${ctx.member.joinedAt?.slice(0, 10) ?? '未知'}
- 技能 (平均分): ${skillsAvg}/100
- 技能明细: ${ctx.member.skills.map((s) => `${s.skillId}=${s.score}`).join(', ') || '（暂无）'}

期间: ${ctx.period}
最近 3 次 Review: ${ctx.recentReviews.slice(-3).map((r) => `${r.period}: ${r.rating}星 - ${r.summary?.slice(0, 50) ?? ''}`).join(' | ') || '（暂无）'}

完成的培训: ${completedTrainings.length} 个 (${completedTrainings.map((t) => t.title).join(', ') || '（无）'})

请生成 Review 草稿 JSON:
{
  "rating": 1-5 的整数 (基于综合表现),
  "summary": "一段话总结本期表现 (60-100 字)",
  "achievements": ["成就 1", "成就 2", "成就 3"],
  "growthAreas": ["成长方向 1", "成长方向 2"],
  "nextGoals": ["下阶段目标 1", "目标 2", "目标 3"]
}

要求:
- 评价要客观、具体、有数据支撑
- 优点和成长方向要平衡
- 目标要可衡量`,
      },
    ];

    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.4,
    });
    return this.parseDraft(resp.content);
  }

  private parseDraft(content: string): ReviewDraft {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        rating: 3,
        summary: '（AI 生成失败，请手动填写）',
        achievements: [],
        growthAreas: [],
        nextGoals: [],
      };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const rating = Math.max(1, Math.min(5, Math.round(Number(parsed.rating) || 3))) as 1 | 2 | 3 | 4 | 5;
    return {
      rating,
      summary: String(parsed.summary ?? '（无总结）'),
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements.slice(0, 5) : [],
      growthAreas: Array.isArray(parsed.growthAreas) ? parsed.growthAreas.slice(0, 5) : [],
      nextGoals: Array.isArray(parsed.nextGoals) ? parsed.nextGoals.slice(0, 5) : [],
    };
  }
}
