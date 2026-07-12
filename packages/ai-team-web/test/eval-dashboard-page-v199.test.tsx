// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EvalDashboardPage } from '../src/components/llm/EvalDashboardPage';
import type { EvalCaseResult } from '../src/lib/llm/eval-harness';
import { buildEntry } from '../src/lib/llm/eval-timeline';

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function caseResult(
  fixtureId: string,
  passed: boolean,
  runnerLabel = 'r',
): EvalCaseResult {
  return {
    fixtureId,
    runnerLabel,
    actual: null,
    expectation: { focusTag: 'technical' },
    checks: [],
    elapsedMs: 42,
    passed,
  };
}

describe('EvalDashboardPage', () => {
  it('renders all sections when inputs are provided', () => {
    const recent = [
      caseResult('a', true),
      caseResult('b', false),
      caseResult('c', false),
    ];
    const timeline = [
      buildEntry('t1', {
        startedAtMs: NOW - 1 * DAY,
        durationMs: 100,
        runnerLabel: 'r',
        results: [
          { fixtureId: 'a', passed: true },
          { fixtureId: 'b', passed: false },
        ],
      }),
    ];
    const adoptions = [
      { questionId: 'q-1', question: 'Q1', adoptedAtMs: NOW - 1 * DAY },
      { questionId: 'q-1', question: 'Q1', adoptedAtMs: NOW - 2 * DAY },
      { questionId: 'q-2', question: 'Q2', adoptedAtMs: NOW - 30 * DAY },
    ];
    const { container } = render(
      <EvalDashboardPage
        recentResults={recent}
        timeline={timeline}
        adoptions={adoptions}
        nowMs={NOW}
        testId="db"
      />,
    );
    const root = container.querySelector('[data-testid="db"]');
    expect(root?.getAttribute('data-cases')).toBe('3');
    expect(root?.getAttribute('data-pass-rate')).toMatch(/33\.\d/);
    expect(container.querySelector('[data-testid="db-top-failures"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="db-failure-c"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="db-top-q-q-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="db-timeline"]')).toBeTruthy();
  });

  it('handles empty input without crashing', () => {
    const { container } = render(<EvalDashboardPage testId="db" />);
    const root = container.querySelector('[data-testid="db"]');
    expect(root?.getAttribute('data-cases')).toBe('0');
    expect(container.querySelector('[data-testid="db-top-failures"]')).toBeTruthy();
  });
});
