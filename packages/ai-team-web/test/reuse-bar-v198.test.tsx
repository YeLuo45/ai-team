// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ReuseBar } from '../src/components/interview/ReuseBar';
import type { HistoryLikeEntry } from '../src/lib/question-suggestion/reuse';

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
const DAY = 86_400_000;

function history(): HistoryLikeEntry[] {
  return [
    { questionId: 'q-a', question: 'Question A?', adoptedAtMs: NOW - 1 * DAY, focusTag: 'technical' },
    { questionId: 'q-a', question: 'Question A?', adoptedAtMs: NOW - 2 * DAY, focusTag: 'technical' },
    { questionId: 'q-b', question: 'Question B?', adoptedAtMs: NOW - 3 * DAY, focusTag: 'communication' },
  ];
}

describe('ReuseBar', () => {
  it('renders the empty state when no candidates match', () => {
    const { container } = render(
      <ReuseBar
        history={history()}
        focusTag="culture"
        nowMs={NOW}
        testId="rb"
      />,
    );
    const root = container.querySelector('[data-testid="rb"]');
    expect(root?.getAttribute('data-state')).toBe('empty');
    expect(container.textContent).toContain('No reuse candidates yet.');
  });

  it('renders candidates and surfaces the count + score data', () => {
    const { container } = render(
      <ReuseBar history={history()} nowMs={NOW} testId="rb" />,
    );
    const root = container.querySelector('[data-testid="rb"]');
    expect(root?.getAttribute('data-state')).toBe('ready');
    expect(root?.getAttribute('data-count')).toBeTruthy();
    const button = container.querySelector('[data-testid="rb-pick-q-a"]');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('data-score')).toBeTruthy();
    expect(button?.getAttribute('data-adoption-count')).toBe('2');
  });

  it('fires onPick when a candidate is clicked', () => {
    let captured: { questionId: string; question: string } | null = null;
    const { container } = render(
      <ReuseBar
        history={history()}
        nowMs={NOW}
        onPick={(c) => {
          captured = c;
        }}
        testId="rb"
      />,
    );
    const button = container.querySelector(
      '[data-testid="rb-pick-q-a"]',
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    button?.click();
    expect(captured?.questionId).toBe('q-a');
  });
});
