// V175: Agent Eval Harness tests — pure helper coverage for replay
// pipelines + the assertion matchers.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  runEvalCase,
  runEvalSuite,
  summarise,
  passRate,
  formatPassRate,
  evaluateExpectation,
  type EvalFixture,
  type AgentRunner,
  type EvalCaseResult,
  type EvalSummary,
} from '../src/lib/llm/eval-harness';
import type {
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from '../src/lib/question-suggestion/types';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeSuggestion(over: Partial<QuestionSuggestion> = {}): QuestionSuggestion {
  return {
    id: 'sg_v175',
    question: '你最近一个项目里最大的技术挑战是什么？',
    rationale: '探查系统设计的权衡',
    focusTag: 'technical',
    difficulty: 'medium',
    followUpHints: ['追问你权衡了什么'],
    generatedAt: 1_700_000_000_000,
    ...over,
  };
}

function makeInput(): QuestionSuggestionInput {
  return {
    sessionId: 'ct_alice',
    position: 'Senior Frontend',
    candidateName: 'Alice',
    previousQuestions: [],
    recentTranscript: [
      { text: '你好', speaker: 'candidate', timestamp: 0 },
    ],
    evaluationHistory: [],
    trigger: { kind: 'manual' },
  };
}

function makeRunner(opts: {
  suggestion?: QuestionSuggestion | (() => QuestionSuggestion);
  delayMs?: number;
  throwError?: Error;
  label?: string;
} = {}): AgentRunner {
  const label = opts.label ?? 'runner-A';
  return {
    label,
    build() {
      return {
        async suggest(_input: QuestionSuggestionInput): Promise<QuestionSuggestion> {
          if (opts.throwError) throw opts.throwError;
          if (opts.delayMs && opts.delayMs > 0) {
            return new Promise((res) =>
              setTimeout(() => {
                const s =
                  typeof opts.suggestion === 'function'
                    ? (opts.suggestion as () => QuestionSuggestion)()
                    : (opts.suggestion ?? makeSuggestion());
                res(s);
              }, opts.delayMs),
            );
          }
          const s =
            typeof opts.suggestion === 'function'
              ? (opts.suggestion as () => QuestionSuggestion)()
              : (opts.suggestion ?? makeSuggestion());
          return s;
        },
      } as Pick<QuestionSuggestionAgent, 'suggest'>;
    },
  };
}

describe('runEvalCase', () => {
  it('records every passing check + marks the case as passed', async () => {
    const runner = makeRunner({
      suggestion: makeSuggestion({ focusTag: 'communication', difficulty: 'easy' }),
    });
    const fixture: EvalFixture = {
      id: 'f1',
      label: 'communication/easy',
      input: makeInput(),
      expected: {
        focusTag: 'communication',
        difficulty: 'easy',
        rationaleContains: '探查',
      },
    };
    const out = await runEvalCase(runner, fixture);
    expect(out.passed).toBe(true);
    expect(out.error).toBeUndefined();
    expect(out.actual?.focusTag).toBe('communication');
    expect(out.actual?.difficulty).toBe('easy');
    // 3 checks, all passed.
    expect(out.checks.length).toBe(3);
    expect(out.checks.every((c) => c.passed)).toBe(true);
    expect(out.runnerLabel).toBe('runner-A');
  });

  it('marks the case as failed when any expectation fails', async () => {
    const runner = makeRunner({ suggestion: makeSuggestion({ focusTag: 'communication' }) });
    const fixture: EvalFixture = {
      id: 'f2',
      input: makeInput(),
      expected: { focusTag: 'culture' },
    };
    const out = await runEvalCase(runner, fixture);
    expect(out.passed).toBe(false);
    expect(out.checks.length).toBe(1);
    expect(out.checks[0]?.passed).toBe(false);
    expect(out.checks[0]?.name).toBe('focus tag');
    expect(out.checks[0]?.detail).toContain('actual=communication');
  });

  it('propagates agent errors as a non-passing result', async () => {
    const runner = makeRunner({ throwError: new Error('upstream down') });
    const fixture: EvalFixture = {
      id: 'f3',
      input: makeInput(),
      expected: { questionContains: '什么' },
    };
    const out = await runEvalCase(runner, fixture);
    expect(out.passed).toBe(false);
    expect(out.actual).toBeNull();
    expect(out.error).toBe('upstream down');
    expect(out.checks.length).toBe(0);
  });

  it('records elapsedMs even when the agent throws', async () => {
    const runner = makeRunner({ throwError: new Error('x') });
    const fixture: EvalFixture = {
      id: 'f4',
      input: makeInput(),
      expected: {},
    };
    const out = await runEvalCase(runner, fixture);
    expect(out.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

describe('runEvalSuite', () => {
  it('runs every fixture in order against a single runner', async () => {
    let i = 0;
    const runner = makeRunner({
      label: 'seq',
      suggestion: () =>
        makeSuggestion({ question: `Q-${i++}-你最近一个项目最大的技术挑战` }),
    });
    const fixtures: EvalFixture[] = [
      { id: 'a', input: makeInput(), expected: { questionContains: 'Q-0' } },
      { id: 'b', input: makeInput(), expected: { questionContains: 'Q-1' } },
      { id: 'c', input: makeInput(), expected: { questionContains: 'Q-2' } },
    ];
    const results = await runEvalSuite(runner, fixtures);
    expect(results.length).toBe(3);
    expect(results.map((r) => r.fixtureId)).toEqual(['a', 'b', 'c']);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});

describe('summarise / passRate / formatPassRate', () => {
  it('computes total/passed/failed and a per-runner breakdown', () => {
    const fixture = (id: string): EvalCaseResult => ({
      fixtureId: id,
      runnerLabel: 'A',
      actual: makeSuggestion(),
      expectation: {},
      checks: [],
      elapsedMs: 0,
      passed: true,
    });
    const failing: EvalCaseResult = {
      fixtureId: 'x',
      runnerLabel: 'B',
      actual: null,
      expectation: {},
      checks: [],
      error: 'boom',
      elapsedMs: 0,
      passed: false,
    };
    const summary: EvalSummary = summarise([fixture('a'), fixture('b'), failing]);
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.passRate).toBeCloseTo(2 / 3, 5);
    expect(summary.byRunner.get('A')).toEqual({ passed: 2, failed: 0 });
    expect(summary.byRunner.get('B')).toEqual({ passed: 0, failed: 1 });
  });

  it('returns passRate = 1 on an empty suite', () => {
    expect(passRate(summarise([]))).toBe(1);
  });

  it('formats PassRate as "passed/total (pct%)"', () => {
    const out = formatPassRate(summarise([
      { fixtureId: 'a', runnerLabel: 'A', actual: null, expectation: {}, checks: [], elapsedMs: 0, passed: true },
      { fixtureId: 'b', runnerLabel: 'A', actual: null, expectation: {}, checks: [], elapsedMs: 0, passed: false },
    ]));
    expect(out).toBe('1/2 (50.0%)');
  });
});

describe('evaluateExpectation', () => {
  const actual = makeSuggestion();

  it('passes questionEquals / questionContains / questionMatches', () => {
    const checks = evaluateExpectation(actual, {
      questionEquals: actual.question,
      questionContains: '项目',
      questionMatches: '技术挑战',
    });
    expect(checks.length).toBe(3);
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it('fails questionContains with a detail containing the truncated actual', () => {
    const checks = evaluateExpectation(actual, {
      questionContains: 'NOT-PRESENT',
    });
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.detail).toContain(actual.question.slice(0, 5));
  });

  it('handles a malformed regex gracefully', () => {
    const checks = evaluateExpectation(actual, {
      questionMatches: '([unbalanced',
    });
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.detail).toMatch(/invalid regex/);
  });

  it('asserts focusTag and difficulty equality (failing case)', () => {
    const checks = evaluateExpectation(actual, {
      focusTag: 'culture',
      difficulty: 'hard',
    });
    expect(checks.every((c) => !c.passed)).toBe(true);
    expect(checks.find((c) => c.name === 'focus tag')?.detail).toContain(
      'actual=technical',
    );
  });

  it('asserts rationaleContains passing case', () => {
    const checks = evaluateExpectation(actual, {
      rationaleContains: '探查',
    });
    expect(checks[0]?.passed).toBe(true);
  });

  it('similarityAtLeast + baselineQuestion pass when actual is close', () => {
    const checks = evaluateExpectation(
      { ...actual, question: '你最近项目里最大的技术挑战是什么？' },
      {
        similarityAtLeast: 0.5,
        baselineQuestion: '你最近一个项目里最大的技术挑战是什么？',
      },
    );
    expect(checks[0]?.passed).toBe(true);
  });

  it('similarityAtLeast fails when baselineQuestion is missing', () => {
    const checks = evaluateExpectation(actual, {
      similarityAtLeast: 0.5,
    });
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.detail).toMatch(/baselineQuestion/);
  });

  it('similarityAtLeast fails when the diff is too wide', () => {
    const checks = evaluateExpectation(
      { ...actual, question: '完全不同的项目问题' },
      {
        similarityAtLeast: 0.95,
        baselineQuestion: 'long enough baseline that creates a major diff',
      },
    );
    expect(checks[0]?.passed).toBe(false);
  });

  it('returns an empty list when no expectations are provided', () => {
    expect(evaluateExpectation(actual, {})).toEqual([]);
  });
});
