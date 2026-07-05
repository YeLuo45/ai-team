// V163: MockQuestionSuggestionAgent. Picks a question from a small template
// pool keyed by `focusTag`. Deterministic — same input always returns the
// same suggestion. Tests rely on this.

import type {
  PreviousQuestion,
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from './types';

/**
 * Template pool — keyed by focusTag. A pool entry is selected based on the
 * most recent question's focusTag (avoid asking the same focus twice in a
 * row) or by the most-debated focus in the recent transcript.
 */
const TEMPLATES: ReadonlyArray<{
  focusTag: 'technical' | 'communication' | 'problemSolving' | 'culture';
  question: string;
  rationale: string;
  difficulty: 'easy' | 'medium' | 'hard';
}> = [
  { focusTag: 'technical',     question: '能详细讲讲你最近一个项目的技术栈选型过程吗？', rationale: '探查技术深度 + 工程权衡',   difficulty: 'medium' },
  { focusTag: 'technical',     question: '如果重新做一次，你会怎样重新设计系统架构？',   rationale: '复盘能力 + 系统设计',         difficulty: 'hard' },
  { focusTag: 'communication', question: '你如何向非技术同事解释你的方案？',             rationale: '跨团队沟通',                 difficulty: 'medium' },
  { focusTag: 'communication', question: '举一个你改变他人想法的例子。',                 rationale: '影响力 + 说服力',            difficulty: 'medium' },
  { focusTag: 'problemSolving', question: '面对一个陌生问题，你会怎么入手？',             rationale: '问题拆解 + 思路清晰度',     difficulty: 'easy' },
  { focusTag: 'problemSolving', question: '举一次你推翻常规思路的例子。',                 rationale: '创新 + 反向思考',           difficulty: 'hard' },
  { focusTag: 'culture',       question: '你怎么看团队代码评审中最有争议的评论？',       rationale: '工程文化 + 反馈接受度',     difficulty: 'medium' },
  { focusTag: 'culture',       question: '你期望的团队合作模式是怎样的？',               rationale: '价值观匹配 + 团队适应性',   difficulty: 'easy' },
];

const FALLBACK = {
  question: '能否再展开讲讲你最近最有挑战的一个项目？',
  rationale: '基于上一轮回答，探查候选人最擅长的领域',
  difficulty: 'medium' as const,
};

/** Counter for stable-but-unique ids per agent instance. */
let serial = 0;

export class MockQuestionSuggestionAgent implements QuestionSuggestionAgent {
  readonly id = 'mock';
  readonly label = 'Mock (模板池 · 本地)';
  readonly remote = false;

  async suggest(input: QuestionSuggestionInput): Promise<QuestionSuggestion> {
    const lastTag = lastFocusTag(input.previousQuestions);
    const pool = TEMPLATES.filter((t) => t.focusTag !== lastTag);
    const seed = hashOf(input.sessionId + ':' + input.recentTranscript.length);
    const idx = Math.abs(seed) % pool.length;
    const t = pool[idx] ?? FALLBACK;
    return {
      id: `mock-${++serial}`,
      question: t.question,
      rationale: t.rationale,
      focusTag: t.focusTag,
      difficulty: t.difficulty,
      followUpHints: [],
      generatedAt: Date.now(),
    };
  }
}

/** Hash all recent transcript text into a 32-bit integer. */
function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return h;
}

function lastFocusTag(history: ReadonlyArray<PreviousQuestion>):
  'technical' | 'communication' | 'problemSolving' | 'culture' | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].focusTag) return history[i].focusTag;
  }
  return undefined;
}

/** Public for tests — list all templates. */
export function listMockTemplates(): ReadonlyArray<typeof TEMPLATES[number]> {
  return TEMPLATES;
}
