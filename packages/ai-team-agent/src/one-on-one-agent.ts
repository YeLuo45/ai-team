// 1:1 Conversation Simulator Agent
// AI plays the role of a member, manager is the human

import { LLMClient, ChatMessage } from '@ai-team/ai';
import type { Member } from '@ai-team/core';
import { generateId, nowIso } from '@ai-team/core';

export type OneOnOneScenario = 'performance' | 'career' | 'project_retro' | 'difficult' | 'general';

export interface OneOnOneTurn {
  role: 'manager' | 'member';
  content: string;
  timestamp: string;
}

export interface OneOnOneSummary {
  topics: string[];
  commitments: string[];
  actions: string[];
  followUp: string;
  sentiment: 'positive' | 'neutral' | 'concerned';
}

export interface OneOnOneSession {
  id: string;
  memberId: string;
  managerName: string;
  scenario: OneOnOneScenario;
  turns: OneOnOneTurn[];
  summary?: OneOnOneSummary;
}

const SCENARIO_PROMPTS: Record<OneOnOneScenario, string> = {
  performance: '你正在与经理进行 1:1 沟通，主要讨论**绩效反馈**。你的近期工作中有亮点也有不足，希望获得具体指导。',
  career: '你正在与经理进行 1:1 沟通，主要讨论**职业发展规划**。你希望了解成长路径，并表达自己的兴趣和困惑。',
  project_retro: '你正在与经理进行 1:1 沟通，主要讨论**最近项目的复盘**。项目有成功也有失败，你愿意分享真实想法。',
  difficult: '你正在与经理进行 1:1 沟通，遇到了**比较难沟通**的问题。你可能对某些决策有不同意见或遇到了工作障碍。',
  general: '你正在与经理进行 1:1 沟通，进行一次**例行的近况交流**。',
};

function buildMemberPersona(member: Member): string {
  const skills = (member.skills ?? []).map((s) => `${s.skillId}=${s.score}`).join(', ') || '（暂无）';
  const trainings = (member.trainings ?? []).map((t) => t.title).join(', ') || '（暂无）';
  return `你的背景:
- 姓名: ${member.name}
- 角色: ${member.role}${member.level ? ` (${member.level})` : ''}
- 团队: ${member.team}
- 经理: ${member.manager ?? '（无）'}
- 入职: ${member.joinedAt?.slice(0, 10) ?? '未知'}
- 技能: ${skills}
- 培训: ${trainings}
- 性格: 务实、愿意表达、有成长诉求`;
}

function buildSystemPrompt(member: Member, scenario: OneOnOneScenario, managerName: string): string {
  return `你正在扮演团队成员 "${member.name}"，与经理 "${managerName}" 进行 1:1 沟通。

${SCENARIO_PROMPTS[scenario]}

${buildMemberPersona(member)}

**风格要求**:
- 真实自然，像个真实的工程师在和经理说话
- 一次只说一段话，不要一次说太多
- 可以表达困惑、感谢、不同意见
- 中文交流
- 控制 6-8 轮对话
- 不要重复对方的话`;
}

export class OneOnOneAgent {
  constructor(
    private llm: LLMClient,
    private opts: { maxTurns?: number; scenario?: OneOnOneScenario; model?: string } = {}
  ) {}

  start(member: Member, options: { managerName?: string; scenario?: OneOnOneScenario } = {}): OneOnOneSession {
    const scenario = options.scenario ?? this.opts.scenario ?? 'general';
    return {
      id: generateId('oo'),
      memberId: member.id,
      managerName: options.managerName ?? 'Manager',
      scenario,
      turns: [],
    };
  }

  // Get the first member response
  async openingMessage(session: OneOnOneSession, member: Member): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(member, session.scenario, session.managerName) },
      { role: 'user', content: `${session.managerName} 发起了 1:1 沟通，主题是 "${session.scenario}"。请先打个招呼并分享你最近的近况。` },
    ];
    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.7,
    });
    const content = resp.content.trim();
    session.turns.push({ role: 'member', content, timestamp: nowIso() });
    return content;
  }

  // Manager speaks, member responds
  async respond(session: OneOnOneSession, member: Member, managerMessage: string): Promise<string | null> {
    session.turns.push({ role: 'manager', content: managerMessage, timestamp: nowIso() });

    // Check if we've reached max turns
    const maxTurns = (this.opts.maxTurns ?? 7) * 2;
    if (session.turns.length >= maxTurns) {
      return null;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(member, session.scenario, session.managerName) },
      ...session.turns.map((t) => ({
        role: (t.role === 'manager' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.content,
      })),
    ];
    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.7,
    });
    const content = resp.content.trim();
    // Detect JSON summary
    if (content.startsWith('{') && content.includes('"topics"')) {
      return null;
    }
    session.turns.push({ role: 'member', content, timestamp: nowIso() });
    return content;
  }

  // Generate summary
  async generateSummary(session: OneOnOneSession, member: Member): Promise<OneOnOneSummary> {
    const transcript = session.turns
      .map((t) => `${t.role === 'manager' ? '经理' : '员工'}: ${t.content}`)
      .join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个 HR 助理。基于 1:1 对话记录，生成结构化摘要。只输出严格的 JSON 格式。`,
      },
      {
        role: 'user',
        content: `员工: ${member.name} (${member.role})
场景: ${session.scenario}

对话:
${transcript}

请输出 JSON:
{
  "topics": ["讨论的关键议题 1", "议题 2", "议题 3"],
  "commitments": ["经理的承诺 1", "员工的承诺 1"],
  "actions": ["行动项 1 (含负责人)", "行动项 2"],
  "followUp": "下次 1:1 建议跟进的内容",
  "sentiment": "positive | neutral | concerned"
}`,
      },
    ];

    const resp = await this.llm.chat({
      messages,
      ...(this.opts.model && { model: this.opts.model }),
      temperature: 0.3,
    });
    return this.parseSummary(resp.content);
  }

  private parseSummary(content: string): OneOnOneSummary {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        topics: [],
        commitments: [],
        actions: [],
        followUp: '（生成失败）',
        sentiment: 'neutral',
      };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      followUp: String(parsed.followUp ?? '（未生成）'),
      sentiment: ['positive', 'neutral', 'concerned'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
    };
  }
}
