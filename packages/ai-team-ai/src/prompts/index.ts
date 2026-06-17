// Prompt templates for interview/training/evaluation

import type { ChatMessage } from '../types.js';

const INTERVIEWER_SYSTEM = `你是一位专业的 AI 面试官，正在为一家科技公司进行【{position}】岗位的面试。
你的风格：
- 一次只问一个问题
- 根据候选人回答动态调整深度
- 用中文交流
- 不要重复问题
- 不要给答案或提示
- 控制 5-8 轮对话，每轮 1 个核心问题`;

const INTERVIEWER_EVAL_INSTRUCTION = `现在你已经和候选人进行了几轮对话。请基于对话内容给出结构化评估。

**重要**: 只输出严格的 JSON 格式，不要其他文字。格式如下：
{
  "overall": 0-100的整数,
  "breakdown": {
    "technical": 0-100,
    "communication": 0-100,
    "problemSolving": 0-100,
    "culture": 0-100
  },
  "strengths": ["优势1", "优势2", "优势3"],
  "concerns": ["顾虑1", "顾虑2"],
  "recommendation": "strong_hire | hire | no_hire | strong_no_hire",
  "summary": "一段话总结候选人的表现和是否建议进入下一轮"
}`;

const TRAINING_PLAN_INSTRUCTION = `你是 HR 培训规划师。基于成员的当前技能和岗位目标，生成 3-6 个月的培训计划。

**重要**: 只输出严格的 JSON 格式，不要其他文字。格式如下：
{
  "goals": ["目标1", "目标2", "目标3"],
  "trainings": [
    {
      "title": "培训名称",
      "type": "course | mentoring | project | reading | certification",
      "durationWeeks": 数字,
      "resources": ["资源1", "资源2"]
    }
  ],
  "expectedGrowth": "预期成长描述"
}`;

export function buildInterviewerSystemPrompt(position: string): string {
  return INTERVIEWER_SYSTEM.replace('{position}', position);
}

export function buildInterviewMessages(
  position: string,
  candidateName: string,
  resume?: string,
  history: Array<{ role: 'interviewer' | 'candidate'; content: string }> = []
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildInterviewerSystemPrompt(position) },
  ];

  if (resume) {
    messages.push({
      role: 'user',
      content: `候选人简历：\n${resume}\n\n请开始面试，先问第一个问题。`,
    });
    messages.push({
      role: 'assistant',
      content: `好的，下面我们开始面试。请问你简单介绍一下自己的背景和最近做过的项目。`,
    });
  } else {
    messages.push({
      role: 'user',
      content: `候选人：${candidateName}\n岗位：${position}\n\n请开始面试，问第一个问题。`,
    });
  }

  for (const turn of history) {
    messages.push({
      role: turn.role === 'interviewer' ? 'assistant' : 'user',
      content: turn.content,
    });
  }
  return messages;
}

export function buildEvaluationMessages(
  position: string,
  history: Array<{ role: 'interviewer' | 'candidate'; content: string }>
): ChatMessage[] {
  const transcript = history
    .map((t, i) => `${t.role === 'interviewer' ? '面试官' : '候选人'} [轮 ${Math.floor(i / 2) + 1}]: ${t.content}`)
    .join('\n\n');

  return [
    {
      role: 'system',
      content: buildInterviewerSystemPrompt(position) + '\n\n' + INTERVIEWER_EVAL_INSTRUCTION,
    },
    {
      role: 'user',
      content: `以下是完整的面试对话：\n\n${transcript}\n\n请给出 JSON 评估。`,
    },
  ];
}

export function buildTrainingPlanMessages(
  memberName: string,
  currentRole: string,
  targetRole: string,
  currentSkills: Array<{ name: string; score: number }>,
  weaknessAreas: string[]
): ChatMessage[] {
  const skillsStr = currentSkills.map((s) => `${s.name}: ${s.score}/100`).join(', ');
  const weaknessStr = weaknessAreas.length > 0 ? weaknessAreas.join(', ') : '（暂无）';

  return [
    {
      role: 'system',
      content: TRAINING_PLAN_INSTRUCTION,
    },
    {
      role: 'user',
      content: `成员姓名: ${memberName}
当前岗位: ${currentRole}
目标岗位: ${targetRole}
当前技能评分: ${skillsStr || '（暂无数据）'}
待提升领域: ${weaknessStr}

请生成培训计划 JSON。`,
    },
  ];
}
