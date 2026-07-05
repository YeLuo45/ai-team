// V163: LlmQuestionSuggestionAgent. Wraps an LLM client behind the same
// interface as the Mock agent. A minimal `LlmClient` shape is defined here so
// the web package stays decoupled from `@ai-team/ai`. The team wires a real
// client in `llm-provider-registry.ts` later.

import type {
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from './types';

export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  /** Issue a chat completion. Implementations may stream or return text. */
  complete(args: {
    system: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }>;
}

export interface LlmQuestionSuggestionAgentOptions {
  client: LlmClient;
  /** Override the system prompt. Defaults to a sensible Chinese template. */
  systemPrompt?: string;
  /** Override temperature (default 0.4). */
  temperature?: number;
}

const DEFAULT_SYSTEM = [
  '你是一位资深技术面试官，正在实时面试候选人。',
  '你的任务：根据最近的对话内容、候选人简历与之前问过的题目，提出一道接下来最值得问的题目。',
  '输出必须是 JSON，字段: { question: string, rationale: string, focusTag: "technical"|"communication"|"problemSolving"|"culture", difficulty: "easy"|"medium"|"hard" }',
  '限制：题目不能与 previousQuestions 重复。',
].join('\n');

export class LlmQuestionSuggestionAgent implements QuestionSuggestionAgent {
  readonly id: string;
  readonly label: string;
  readonly remote: true = true;
  private readonly client: LlmClient;
  private readonly systemPrompt: string;
  private readonly temperature: number;

  constructor(options: LlmQuestionSuggestionAgentOptions) {
    this.client = options.client;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM;
    this.temperature = options.temperature ?? 0.4;
    this.id = `llm:${options.client.provider}/${options.client.model}`;
    this.label = `LLM (${options.client.provider}/${options.client.model})`;
  }

  async suggest(input: QuestionSuggestionInput): Promise<QuestionSuggestion> {
    const user = renderUserPrompt(input);
    const response = await this.client.complete({
      system: this.systemPrompt,
      user,
      temperature: this.temperature,
      maxTokens: 400,
    });
    const parsed = parseJsonResponse(response.text);
    return {
      id: `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question: parsed.question,
      rationale: parsed.rationale,
      focusTag: parsed.focusTag,
      difficulty: parsed.difficulty,
      followUpHints: parsed.followUpHints,
      generatedAt: Date.now(),
    };
  }
}

function renderUserPrompt(input: QuestionSuggestionInput): string {
  const transcript = input.recentTranscript
    .slice(-12)
    .map((t) => `[${t.speaker}] ${t.text}`)
    .join('\n');
  const prev = input.previousQuestions.map((q) => `· ${q.question}`).join('\n');
  return [
    `岗位: ${input.position}`,
    `候选人: ${input.candidateName}`,
    `触发原因: ${describeTrigger(input.trigger)}`,
    '',
    '=== 最近对话 ===',
    transcript || '(无)',
    '',
    '=== 之前问过的题目 ===',
    prev || '(无)',
    '',
    '请以 JSON 形式输出你的下一道题目建议。',
  ].join('\n');
}

function describeTrigger(t: QuestionSuggestionInput['trigger']): string {
  switch (t.kind) {
    case 'manual': return '用户手动触发';
    case 'content-shift': return '对话主题切换';
    case 'time-based': return '每 30 秒自动触发';
  }
}

/** Strict parser — falls back to a safe default when the model misbehaves. */
function parseJsonResponse(text: string): {
  question: string; rationale: string;
  focusTag?: 'technical' | 'communication' | 'problemSolving' | 'culture';
  difficulty: 'easy' | 'medium' | 'hard';
  followUpHints?: string[];
} {
  const fence = /```(?:json)?\s*([\s\S]+?)\s*```/i;
  const m = text.match(fence);
  const json = m ? m[1] : text;
  try {
    const obj = JSON.parse(json);
    return {
      question: String(obj.question ?? ''),
      rationale: String(obj.rationale ?? ''),
      focusTag: obj.focusTag as any,
      difficulty: (obj.difficulty ?? 'medium') as any,
      followUpHints: Array.isArray(obj.followUpHints) ? obj.followUpHints.map(String) : [],
    };
  } catch {
    return {
      question: text.trim() || '（模型输出无法解析）',
      rationale: 'agent 输出非 JSON，已降级到 raw text',
      difficulty: 'medium',
      followUpHints: [],
    };
  }
}
