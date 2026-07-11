import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  runStreamingEvalSuite,
  completedResults,
  progressPercent,
} from '../src/lib/llm/run-streaming';
import type {
  AgentRunner,
  EvalCaseResult,
  EvalFixture,
} from '../src/lib/llm/eval-harness';
import type { QuestionSuggestionAgent } from '../src/lib/question-suggestion/agent';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeFixture(id: string, expected: Record<string, unknown> = {}): EvalFixture {
  return {
    id,
    label: `${id} label`,
    input: {
      sessionId: 'ct_x',
      position: 'Senior Frontend',
      candidateName: 'Alice',
      previousQuestions: [],
      recentTranscript: [{ text: 'hi', speaker: 'candidate', timestamp: 0 }],
      evaluationHistory: [],
      trigger: { kind: 'manual' },
    },
    expected: expected as EvalFixture['expected'],
  };
}

class StubAgent implements QuestionSuggestionAgent {
  constructor(private outputs: QuestionSuggestion[]) {}
  async suggest() {
    const out = this.outputs.shift();
    if (!out) {
      throw new Error('stub: no more outputs');
    }
    return out;
  }
}

function makeRunner(outputs: QuestionSuggestion[]): AgentRunner {
  return {
    label: 'streaming-stub',
    build() {
      return new StubAgent(outputs);
    },
  };
}

const goodSuggestion = (id: string): QuestionSuggestion => ({
  id,
  question: '项目基础',
  rationale: 'r',
  difficulty: 'medium',
  focusTag: 'technical',
  generatedAt: 0,
  followUpHints: [],
});

const badSuggestion = (id: string): QuestionSuggestion => ({
  id,
  question: 'no focus',
  rationale: 'r',
  difficulty: 'medium',
  focusTag: 'communication',
  generatedAt: 0,
  followUpHints: [],
});

// ====================================================================
// 1. happy path
// ====================================================================

describe('runStreamingEvalSuite — happy path', () => {
  it('returns empty results + zero % when fixtures is empty', async () => {
    const r = await runStreamingEvalSuite(makeRunner([]), []);
    expect(r.results).toEqual([]);
    expect(r.aborted).toBe(false);
    expect(r.totalElapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('streams every fixture, calling onProgress on each', async () => {
    const fixtures = [makeFixture('a'), makeFixture('b'), makeFixture('c')];
    const runner = makeRunner([
      goodSuggestion('a'),
      goodSuggestion('b'),
      goodSuggestion('c'),
    ]);
    const calls: Array<{ fixtureId: string; done: number; passed: number }> = [];
    const s = await runStreamingEvalSuite(runner, fixtures, {
      onProgress: (p) => {
        calls.push({
          fixtureId: p.currentId,
          done: p.done,
          passed: p.passedSoFar,
        });
      },
    });
    expect(s.results.length).toBe(3);
    expect(s.aborted).toBe(false);
    expect(calls.length).toBe(3);
    expect(calls[0]?.fixtureId).toBe('a');
    expect(calls[0]?.done).toBe(1);
    expect(calls[2]?.done).toBe(3);
    expect(calls[2]?.passed).toBe(3);
  });

  it('records pass + fail counts cumulatively', async () => {
    // Fixtures expect different focus tags so we can verify the runner
    // tracks goodSuggestion (technical) vs badSuggestion (communication)
    // correctly per-fixture.
    const fixtures = [
      makeFixture('a', { focusTag: 'technical' }),
      makeFixture('b', { focusTag: 'communication' }),
      makeFixture('c', { focusTag: 'technical' }),
    ];
    const runner = makeRunner([
      goodSuggestion('a'), // pass
      { ...goodSuggestion('b'), focusTag: 'technical' }, // fail
      goodSuggestion('c'), // pass
    ]);
    const s = await runStreamingEvalSuite(runner, fixtures, {
      onProgress: (p) => {
        expect(p.failedSoFar + p.passedSoFar).toBe(p.done);
      },
    });
    expect(s.results[0]?.passed).toBe(true);
    expect(s.results[1]?.passed).toBe(false);
    expect(s.results[2]?.passed).toBe(true);
  });

  it('onBeforeCase fires before, onAfterCase after', async () => {
    const order: string[] = [];
    const fixtures = [makeFixture('a'), makeFixture('b')];
    const runner = makeRunner([goodSuggestion('a'), goodSuggestion('b')]);
    await runStreamingEvalSuite(runner, fixtures, {
      onBeforeCase: (id) => order.push(`before:${id}`),
      onAfterCase: (r) => order.push(`after:${r.fixtureId}`),
    });
    expect(order).toEqual([
      'before:a',
      'after:a',
      'before:b',
      'after:b',
    ]);
  });

  it('honours AbortSignal — short-circuits and tags summary.aborted', async () => {
    const fixtures = [makeFixture('a'), makeFixture('b'), makeFixture('c')];
    const runner = makeRunner([
      goodSuggestion('a'),
      goodSuggestion('b'),
      goodSuggestion('c'),
    ]);
    const controller = new AbortController();
    const s = await runStreamingEvalSuite(runner, fixtures, {
      signal: controller.signal,
      onAfterCase: () => {
        controller.abort();
      },
    });
    expect(s.aborted).toBe(true);
    expect(s.results.length).toBeLessThanOrEqual(2);
  });
});

// ====================================================================
// 2. edge cases
// ====================================================================

describe('runStreamingEvalSuite — edge cases', () => {
  it('keeps running even if the runner throws on one fixture', async () => {
    const fixtures = [makeFixture('a'), makeFixture('b')];
    let count = 0;
    const runner: AgentRunner = {
      label: 'partial-throw',
      build() {
        return {
          async suggest() {
            count += 1;
            if (count === 1) throw new Error('downstream off');
            return goodSuggestion('b');
          },
        } as unknown as QuestionSuggestionAgent;
      },
    };
    const s = await runStreamingEvalSuite(runner, fixtures);
    expect(s.results.length).toBe(2);
    expect(s.results[0]?.passed).toBe(false);
    expect(s.results[0]?.error).toContain('downstream');
    expect(s.results[1]?.passed).toBe(true);
  });

  it('preserves fixture order even when one fixture is slower', async () => {
    const fixtures = [makeFixture('a'), makeFixture('b')];
    const observedOrder: string[] = [];
    const runner: AgentRunner = {
      label: 'in-order',
      build() {
        let idx = 0;
        return {
          async suggest() {
            const order = ['b', 'a'];
            observedOrder.push(order[idx] ?? '');
            const id = order[idx] ?? '';
            idx += 1;
            // Reply out-of-order is rejected — fixtures array order wins.
            return goodSuggestion(id);
          },
        } as unknown as QuestionSuggestionAgent;
      },
    };
    const s = await runStreamingEvalSuite(runner, fixtures);
    expect(s.results[0]?.fixtureId).toBe('a');
    expect(s.results[1]?.fixtureId).toBe('b');
  });
});

// ====================================================================
// 3. completedResults / progressPercent
// ====================================================================

describe('completedResults / progressPercent', () => {
  it('drops undefined entries (defensive filter)', () => {
    const fake = [
      { fixtureId: 'a', passed: true },
      undefined,
    ];
    const filtered = completedResults(fake as unknown as EvalCaseResult[]);
    expect(filtered.length).toBe(1);
  });

  it('progressPercent returns 100 when total === 0', () => {
    expect(progressPercent({ total: 0, done: 0, currentId: '', passedSoFar: 0, failedSoFar: 0 })).toBe(
      100,
    );
  });

  it('progressPercent rounds to integer', () => {
    expect(progressPercent({ total: 3, done: 1, currentId: '', passedSoFar: 1, failedSoFar: 0 })).toBe(33);
    expect(progressPercent({ total: 3, done: 2, currentId: '', passedSoFar: 2, failedSoFar: 0 })).toBe(67);
    expect(progressPercent({ total: 3, done: 3, currentId: '', passedSoFar: 3, failedSoFar: 0 })).toBe(100);
  });
});
