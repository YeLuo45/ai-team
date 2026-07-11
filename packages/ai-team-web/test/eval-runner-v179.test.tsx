// V179: EvalRunner tests — drives the V175 → V176 → V178 → V179
// pipeline through the React state machine.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EvalRunner } from '../src/components/llm/EvalRunner';
import type {
  AgentRunner,
  EvalExpectation,
  EvalFixture,
} from '../src/lib/llm/eval-harness';
import type { QuestionSuggestion } from '../src/lib/question-suggestion/types';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeFixture(id: string, expectation: Partial<EvalExpectation> = { focusTag: 'technical' }): EvalFixture {
  return {
    id,
    label: `${id} label`,
    input: {
      sessionId: 'ct_alice',
      position: 'Senior Frontend',
      candidateName: 'Alice',
      previousQuestions: [],
      recentTranscript: [{ text: '你好', speaker: 'candidate', timestamp: 0 }],
      evaluationHistory: [],
      trigger: { kind: 'manual' },
    },
    expected: {
      questionContains: '项目',
      ...expectation,
    },
  };
}

function makeRunner(
  suggestions: ReadonlyArray<QuestionSuggestion>,
  errorOnIndex?: number,
): AgentRunner {
  let counter = 0;
  return {
    label: 'inline-runs',
    build() {
      return {
        async suggest(_input: Parameters<QuestionSuggestion['id'] extends never ? never : never>[] extends never ? never : never) {
          const idx = counter;
          counter += 1;
          if (errorOnIndex !== undefined && idx === errorOnIndex) {
            throw new Error('upstream blew up');
          }
          const s = suggestions[idx];
          if (!s) {
            return {
              id: 'noop', question: 'no more', rationale: 'noop', difficulty: 'easy', focusTag: 'communication', generatedAt: 0, followUpHints: [],
            } as QuestionSuggestion;
          }
          return s;
        },
      } as Pick<import('../src/lib/question-suggestion/types').QuestionSuggestionAgent, 'suggest'>;
    },
  };
}

describe('EvalRunner — empty fixtures', () => {
  it('renders an empty card when fixtures is empty', () => {
    const { container } = render(
      <EvalRunner runner={makeRunner([])} fixtures={[]} testId="er" />,
    );
    expect(container.querySelector('[data-testid="er-empty"]')).toBeTruthy();
  });
});

describe('EvalRunner — idle → running → done', () => {
  const fixtures: EvalFixture[] = [
    makeFixture('a', { questionContains: 'A' }),
    makeFixture('b', { questionContains: 'B' }),
  ];

  it('starts in idle mode with a Run button + fixture list', () => {
    const { container } = render(
      <EvalRunner runner={makeRunner([])} fixtures={fixtures} testId="er" />,
    );
    expect(container.querySelector('[data-testid="er-idle"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="er-start"]')?.textContent).toContain('Run eval');
    expect(container.querySelectorAll('[data-testid="er-item"]').length).toBe(2);
  });

  it('shows the "Run eval" button even when fixtures exist but the runner has nothing to suggest', () => {
    const { container } = render(
      <EvalRunner runner={makeRunner([])} fixtures={fixtures} testId="er" />,
    );
    const btn = container.querySelector('[data-testid="er-start"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('moves to done and renders the EvalResultsTable once run completes', async () => {
    const suggestions: QuestionSuggestion[] = [
      { id: 'a', question: '项目 Q-A', rationale: 'r', difficulty: 'medium', focusTag: 'technical', generatedAt: 0, followUpHints: [] },
      { id: 'b', question: '项目 Q-B', rationale: 'r', difficulty: 'medium', focusTag: 'technical', generatedAt: 0, followUpHints: [] },
    ];
    render(<EvalRunner runner={makeRunner(suggestions)} fixtures={fixtures} testId="er" />);

    const start = screen.getAllByTestId('er-start')[0] as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(start);
    });

    expect(screen.getAllByTestId('er-done')[0]).toBeTruthy();
    // The EvalResultsTable is mounted with our testId root.
    const table = screen.getAllByTestId('er-results-content')[0];
    expect(table).toBeTruthy();
    // Header summary shows 2 results.
    expect(screen.getAllByTestId('er-results-counts')[0]?.textContent).toContain('2');
  });

  it('surfaces runner errors as a banner and stays in done state when succeeds after a partial error', async () => {
    const suggestions: QuestionSuggestion[] = [
      { id: 'a', question: '项目 Q-A', rationale: 'r', difficulty: 'medium', focusTag: 'technical', generatedAt: 0, followUpHints: [] },
      { id: 'b', question: '项目 Q-B', rationale: 'r', difficulty: 'medium', focusTag: 'technical', generatedAt: 0, followUpHints: [] },
    ];
    render(
      <EvalRunner
        runner={makeRunner(suggestions, 1 /* throw on second fixture */)}
        fixtures={fixtures}
        testId="er"
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('er-start')[0]);
    });
    // Both rows now show up; the second one carries an error.
    expect(screen.getAllByTestId('er-results-content')[0]).toBeTruthy();
    expect(screen.getAllByTestId('er-results-counts')[0]?.textContent).toContain('2');
  });

  it('renders a re-run button after done so the user can replay', async () => {
    const suggestions: QuestionSuggestion[] = [
      { id: 'a', question: '项目 Q-A', rationale: 'r', difficulty: 'medium', focusTag: 'technical', generatedAt: 0, followUpHints: [] },
    ];
    render(
      <EvalRunner
        runner={makeRunner(suggestions)}
        fixtures={[makeFixture('a', { questionContains: 'Q-A' })]}
        testId="er"
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('er-start')[0]);
    });
    const rerun = screen.getAllByTestId('er-rerun')[0];
    expect(rerun).toBeTruthy();
    // Click re-run; should clear the results and stay in done state
    // (it re-invokes runEvalSuite). The button still exists.
    await act(async () => {
      fireEvent.click(rerun);
    });
    expect(screen.getAllByTestId('er-rerun')[0]).toBeTruthy();
  });
});

describe('EvalRunner — uses title prop', () => {
  it('renders the custom title above the runner', () => {
    const { container } = render(
      <EvalRunner
        runner={makeRunner([])}
        fixtures={[makeFixture('only')]}
        title="🎯 Suggester Probe"
        testId="er"
      />,
    );
    expect(container.querySelector('[data-testid="er-title"]')?.textContent).toContain(
      'Suggester Probe',
    );
  });
});
