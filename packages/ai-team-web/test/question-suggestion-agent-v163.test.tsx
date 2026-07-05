// V163: QuestionSuggestionAgent interface + Mock + LLM implementations
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  EvaluationSummary,
  PreviousQuestion,
  QuestionSuggestionInput,
  TranscriptChunkInput,
} from '../src/lib/question-suggestion/types';
import {
  listQuestionSuggestionAgentOptions,
  getDefaultQuestionSuggestionAgentId,
  getQuestionSuggestionAgent,
  listMockTemplates,
  LlmQuestionSuggestionAgent,
  MockQuestionSuggestionAgent,
  type LlmClient,
} from '../src/lib/question-suggestion/index';

const FIXED_NOW = new Date('2026-07-04T10:00:00.000Z').getTime();
let serial = 0;

function makeInput(overrides: Partial<QuestionSuggestionInput> = {}): QuestionSuggestionInput {
  const transcript: TranscriptChunkInput[] = (overrides.recentTranscript ?? [
    { text: '请简单介绍一下自己。', speaker: 'interviewer', timestamp: FIXED_NOW - 100 },
    { text: '我是李婷，5 年前端开发。', speaker: 'candidate', timestamp: FIXED_NOW - 50 },
  ]) as TranscriptChunkInput[];
  const history: PreviousQuestion[] = (overrides.previousQuestions ?? [
    { question: '最熟悉的技术栈？', askedAt: FIXED_NOW - 500, focusTag: 'technical' },
  ]) as PreviousQuestion[];
  const history2: EvaluationSummary[] = (overrides.evaluationHistory ?? [
    { round: 1, overall: 75 },
  ]) as EvaluationSummary[];
  return {
    sessionId: overrides.sessionId ?? 'sess_1',
    position: overrides.position ?? '资深前端工程师',
    candidateName: overrides.candidateName ?? '李婷',
    previousQuestions: history,
    recentTranscript: transcript,
    evaluationHistory: history2,
    trigger: overrides.trigger ?? { kind: 'manual' },
  };
}

beforeEach(() => {
  serial = 0;
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});

// ---------------- helpers ----------------

describe('listQuestionSuggestionAgentOptions / getDefaultId', () => {
  it('lists mock as the available built-in agent', () => {
    const opts = listQuestionSuggestionAgentOptions();
    expect(opts).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'mock', remote: false })]));
  });

  it('defaults to the mock agent id', () => {
    expect(getDefaultQuestionSuggestionAgentId()).toBe('mock');
  });

  it('getQuestionSuggestionAgent returns the singleton mock by id', () => {
    expect(getQuestionSuggestionAgent('mock')?.id).toBe('mock');
    expect(getQuestionSuggestionAgent('not-real')).toBeUndefined();
  });
});

describe('MockQuestionSuggestionAgent', () => {
  it('returns a QuestionSuggestion with focusTag / rationale / difficulty / hints', async () => {
    const a = new MockQuestionSuggestionAgent();
    const out = await a.suggest(makeInput());
    expect(out.id).toMatch(/^mock-/);
    expect(out.question).toBeTruthy();
    expect(out.rationale).toBeTruthy();
    expect(out.focusTag).toBeTruthy();
    expect(['easy', 'medium', 'hard']).toContain(out.difficulty);
    expect(Array.isArray(out.followUpHints)).toBe(true);
  });

  it('avoids the most recent focusTag across varied transcripts', async () => {
    const a = new MockQuestionSuggestionAgent();
    // Force the most-recent tag to "technical" but vary transcript length each time
    // so the deterministic hash index lands on different templates.
    const tags = new Set<string | undefined>();
    for (let i = 0; i < 25; i++) {
      const transcript: TranscriptChunkInput[] = Array.from({ length: i + 1 }, (_, j) => ({
        text: `line ${j}`, speaker: 'candidate', timestamp: FIXED_NOW - j,
      }));
      const out = await a.suggest(
        makeInput({
          previousQuestions: [{ question: 'x', askedAt: FIXED_NOW, focusTag: 'technical' }],
          recentTranscript: transcript,
        }),
      );
      // None should be 'technical' since we set the last focus tag to technical
      expect(out.focusTag).not.toBe('technical');
      tags.add(out.focusTag);
    }
    // We should see at least 2 distinct non-technical tags across 25 runs.
    expect(tags.size).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic for the same sessionId + transcript length', async () => {
    const a = new MockQuestionSuggestionAgent();
    const out1 = await a.suggest(makeInput());
    const out2 = await a.suggest(makeInput());
    expect(out1.question).toBe(out2.question);
    expect(out1.focusTag).toBe(out2.focusTag);
  });

  it('changes suggestion when transcript length changes', async () => {
    const a = new MockQuestionSuggestionAgent();
    const out1 = await a.suggest(makeInput());
    const longTranscript: TranscriptChunkInput[] = Array.from({ length: 50 }, (_, i) => ({
      text: `line ${i}`, speaker: 'candidate', timestamp: FIXED_NOW - i,
    }));
    const out2 = await a.suggest(makeInput({ recentTranscript: longTranscript }));
    expect(out1.question).not.toBe(out2.question);
  });

  it('exposes the templates list for documentation / settings UI', () => {
    const t = listMockTemplates();
    expect(t.length).toBeGreaterThan(0);
    const tags = new Set(t.map((x) => x.focusTag));
    expect(tags.size).toBeGreaterThanOrEqual(4);
  });
});

// ---------------- LLM agent ----------------

class FakeLlmClient implements LlmClient {
  readonly provider = 'fake';
  readonly model = 'fake-1';
  private readonly fn: (sys: string, user: string) => Promise<string>;
  public lastCall?: { system: string; user: string };
  constructor(fn: (sys: string, user: string) => Promise<string>) {
    this.fn = fn;
  }
  async complete(args: { system: string; user: string }) {
    this.lastCall = args;
    const text = await this.fn(args.system, args.user);
    return { text, usage: { inputTokens: 200, outputTokens: 80 } };
  }
}

function jsonEncode(obj: unknown) {
  return JSON.stringify(obj);
}

describe('LlmQuestionSuggestionAgent', () => {
  it('id and label incorporate the provider+model', () => {
    const client = new FakeLlmClient(async () => '{}');
    const a = new LlmQuestionSuggestionAgent({ client });
    expect(a.id).toMatch(/^llm:fake\/fake-1$/);
    expect(a.label).toContain('fake');
    expect(a.remote).toBe(true);
  });

  it('passes the system prompt + a structured user prompt to the LLM', async () => {
    const client = new FakeLlmClient(async () =>
      jsonEncode({ question: 'q', rationale: 'r', focusTag: 'technical', difficulty: 'medium' }),
    );
    const a = new LlmQuestionSuggestionAgent({ client });
    await a.suggest(makeInput({ position: 'DevOps 工程师' }));
    expect(client.lastCall?.system).toContain('资深技术面试官');
    expect(client.lastCall?.user).toContain('DevOps 工程师');
    expect(client.lastCall?.user).not.toContain('资深前端工程师');
    // System prompt mentions the JSON schema constraints
    expect(client.lastCall?.system).toContain('JSON');
    expect(client.lastCall?.system).toContain('focusTag');
  });

  it('parses JSON in code-fence and falls back gracefully on bad JSON', async () => {
    const bad = new FakeLlmClient(async () => 'not json at all');
    const a = new LlmQuestionSuggestionAgent({ client: bad });
    const out = await a.suggest(makeInput());
    expect(out.question).toBe('not json at all');
    expect(out.rationale).toMatch(/降级/);
    expect(out.difficulty).toBe('medium');
  });

  it('parses JSON wrapped in ```json fences', async () => {
    const fenced = new FakeLlmClient(async () =>
      '```json\n' + jsonEncode({ question: 'Q', rationale: 'R', focusTag: 'communication', difficulty: 'easy', followUpHints: ['hint 1'] }) + '\n```',
    );
    const a = new LlmQuestionSuggestionAgent({ client: fenced });
    const out = await a.suggest(makeInput());
    expect(out.question).toBe('Q');
    expect(out.focusTag).toBe('communication');
    expect(out.difficulty).toBe('easy');
    expect(out.followUpHints).toEqual(['hint 1']);
  });

  it('lists only mock by default (LLM is created on-demand)', () => {
    const opts = listQuestionSuggestionAgentOptions();
    expect(opts.every((o) => o.id === 'mock')).toBe(true);
  });
});
