// Training agent — generates AI-driven training plans for members

import { LLMClient, buildTrainingPlanMessages } from '@ai-team/ai';
import type { Member, Training } from '@ai-team/core';
import { generateId, nowIso } from '@ai-team/core';

export interface TrainingPlanSuggestion {
  goals: string[];
  trainings: Array<{
    title: string;
    type: Training['type'];
    durationWeeks: number;
    resources: string[];
  }>;
  expectedGrowth: string;
}

export class TrainingAgent {
  private orgMemory: string | undefined;
  constructor(private llm: LLMClient, private opts: { model?: string; orgMemory?: string } = {}) {
    this.orgMemory = opts.orgMemory;
  }

  setOrgMemory(orgMemory: string | undefined): void {
    this.orgMemory = orgMemory;
  }

  /**
   * Generate a training plan for a member. Returns parsed plan (not yet persisted).
   */
  async generatePlan(input: {
    member: Member;
    targetRole: string;
    skills: Array<{ name: string; score: number }>;
    weaknessAreas: string[];
  }): Promise<TrainingPlanSuggestion> {
    const messages = buildTrainingPlanMessages(
      input.member.name,
      input.member.role,
      input.targetRole,
      input.skills,
      input.weaknessAreas,
      this.orgMemory
    );

    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.5,
    });

    return this.parsePlan(resp.content);
  }

  /**
   * Generate a plan and return a list of Training records (not yet saved to store).
   */
  async generateTrainingRecords(input: {
    member: Member;
    targetRole: string;
    skills: Array<{ name: string; score: number }>;
    weaknessAreas: string[];
  }): Promise<Training[]> {
    const plan = await this.generatePlan(input);
    const startDate = nowIso();
    return plan.trainings.map((t) => {
      const id = generateId('tr');
      const training: Training = {
        id,
        memberId: input.member.id,
        skillId: inferSkillId(t.title, input.weaknessAreas),
        type: t.type,
        title: t.title,
        description: `由 AI 推荐的培训计划 (${t.durationWeeks} 周)：${t.resources.join('、')}`,
        startDate,
        progress: 0,
        status: 'planned',
        milestones: [
          { title: `${t.title} - 启动` },
          { title: `${t.title} - 中期回顾` },
          { title: `${t.title} - 完成验收` },
        ],
        aiRecommended: true,
      };
      return training;
    });
  }

  private parsePlan(content: string): TrainingPlanSuggestion {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        goals: [],
        trainings: [],
        expectedGrowth: '（生成失败）',
      };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      trainings: Array.isArray(parsed.trainings)
        ? parsed.trainings.map((t: Record<string, unknown>) => ({
            title: String(t.title ?? ''),
            type: normalizeType(t.type),
            durationWeeks: typeof t.durationWeeks === 'number' ? t.durationWeeks : 4,
            resources: Array.isArray(t.resources) ? t.resources.map(String) : [],
          }))
        : [],
      expectedGrowth: String(parsed.expectedGrowth ?? ''),
    };
  }
}

function normalizeType(t: unknown): Training['type'] {
  const valid: Training['type'][] = ['course', 'mentoring', 'project', 'reading', 'certification'];
  if (typeof t === 'string' && (valid as string[]).includes(t)) {
    return t as Training['type'];
  }
  return 'course';
}

function inferSkillId(title: string, weaknessAreas: string[]): string {
  const match = weaknessAreas.find((w) => title.toLowerCase().includes(w.toLowerCase()));
  if (match) {
    return 'sk_' + match.toLowerCase().replace(/\s+/g, '-').slice(0, 20);
  }
  return 'sk_' + title.toLowerCase().replace(/\s+/g, '-').slice(0, 20);
}
