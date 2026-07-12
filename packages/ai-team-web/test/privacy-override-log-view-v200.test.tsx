// V200: PrivacyOverrideLogView tests — presentational UI for V188 log.
//
// Three surfaces:
//   1. Header counts (allowed / denied / timeout)
//   2. Highlight-op chips + filter label pass-through
//   3. Per-row rendering (outcome badge, op label, reason, actor, age)

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PrivacyOverrideLogView } from '../src/components/privacy/PrivacyOverrideLogView';
import type { PrivacyOverrideEvent } from '../src/lib/privacy/override-log';

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
const MIN = 60 * 1000;
const HR = 60 * MIN;
const DAY = 24 * HR;

function makeEvent(over: Partial<PrivacyOverrideEvent> = {}): PrivacyOverrideEvent {
  return {
    id: over.id ?? 'priv-1',
    op: over.op ?? 'export-interview',
    reason: over.reason ?? 'demo write',
    outcome: over.outcome ?? 'allowed',
    decidedAtMs: over.decidedAtMs ?? NOW,
    actor: over.actor,
    expiresAtMs: over.expiresAtMs,
  };
}

describe('PrivacyOverrideLogView', () => {
  it('renders empty state when no events are provided', () => {
    const { container } = render(<PrivacyOverrideLogView testId="pol" />);
    const root = container.querySelector('[data-testid="pol"]');
    expect(root?.getAttribute('data-total')).toBe('0');
    expect(root?.getAttribute('data-allowed')).toBe('0');
    expect(root?.getAttribute('data-denied')).toBe('0');
    expect(root?.getAttribute('data-timeout')).toBe('0');
    expect(container.querySelector('[data-testid="pol-empty"]')).toBeTruthy();
  });

  it('aggregates counts and renders one row per event', () => {
    const events: PrivacyOverrideEvent[] = [
      makeEvent({ id: 'a', outcome: 'allowed', decidedAtMs: NOW - 5 * MIN, actor: 'alice' }),
      makeEvent({ id: 'b', outcome: 'denied', decidedAtMs: NOW - 2 * HR, actor: 'bob' }),
      makeEvent({ id: 'c', outcome: 'timeout', decidedAtMs: NOW - 3 * DAY, actor: 'carol' }),
      makeEvent({ id: 'd', outcome: 'allowed', decidedAtMs: NOW - 4 * DAY }),
    ];
    const { container } = render(
      <PrivacyOverrideLogView testId="pol" events={events} nowMs={NOW} />,
    );
    const root = container.querySelector('[data-testid="pol"]');
    expect(root?.getAttribute('data-total')).toBe('4');
    expect(root?.getAttribute('data-allowed')).toBe('2');
    expect(root?.getAttribute('data-denied')).toBe('1');
    expect(root?.getAttribute('data-timeout')).toBe('1');
    expect(container.querySelectorAll('[data-testid="pol-list"] > li').length).toBe(4);
  });

  it('sorts events most-recent first', () => {
    const events: PrivacyOverrideEvent[] = [
      makeEvent({ id: 'old', decidedAtMs: NOW - 5 * DAY }),
      makeEvent({ id: 'new', decidedAtMs: NOW - 1 * MIN }),
      makeEvent({ id: 'mid', decidedAtMs: NOW - 1 * HR }),
    ];
    const { container } = render(
      <PrivacyOverrideLogView testId="pol" events={events} nowMs={NOW} limit={3} />,
    );
    const ids = Array.from(
      container.querySelectorAll('[data-testid="pol-list"] > li'),
    ).map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual([
      'pol-row-new',
      'pol-row-mid',
      'pol-row-old',
    ]);
  });

  it('renders highlight-op chips when highlightOps is provided', () => {
    const events: PrivacyOverrideEvent[] = [
      makeEvent({ id: 'a', op: 'export-audio', outcome: 'allowed' }),
      makeEvent({ id: 'b', op: 'export-interview', outcome: 'denied' }),
      makeEvent({ id: 'c', op: 'clipboard-copy', outcome: 'timeout' }),
    ];
    const { container } = render(
      <PrivacyOverrideLogView
        testId="pol"
        events={events}
        nowMs={NOW}
        highlightOps={['export-audio', 'export-interview']}
      />,
    );
    const audioChip = container.querySelector('[data-testid="pol-op-export-audio"]');
    const interviewChip = container.querySelector('[data-testid="pol-op-export-interview"]');
    const clipboardChip = container.querySelector('[data-testid="pol-op-clipboard-copy"]');
    expect(audioChip?.getAttribute('data-count')).toBe('1');
    expect(interviewChip?.getAttribute('data-count')).toBe('1');
    expect(clipboardChip).toBeNull();
  });

  it('surfaces the filter label when provided', () => {
    const { container } = render(
      <PrivacyOverrideLogView
        testId="pol"
        events={[makeEvent({ id: 'a', outcome: 'allowed' })]}
        nowMs={NOW}
        filterLabel="outcome=allowed · 7d"
      />,
    );
    const filterEl = container.querySelector('[data-testid="pol-filter"]');
    expect(filterEl?.textContent).toContain('outcome=allowed · 7d');
  });

  it('caps rendered rows at the configured limit', () => {
    const events: PrivacyOverrideEvent[] = Array.from({ length: 8 }, (_, i) =>
      makeEvent({ id: `e${i}`, decidedAtMs: NOW - i * MIN }),
    );
    const { container } = render(
      <PrivacyOverrideLogView testId="pol" events={events} nowMs={NOW} limit={3} />,
    );
    expect(container.querySelectorAll('[data-testid="pol-list"] > li').length).toBe(3);
  });
});