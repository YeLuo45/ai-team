// V176: EvalResultsTable tests.
//
// Three surfaces:
//   1. Empty-state rendering (no results)
//   2. Header / per-runner chips / footer copy
//   3. Per-fixture row expand/collapse + check details

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EvalResultsTable } from '../src/components/llm/EvalResultsTable';
import type { EvalCaseResult } from '../src/lib/llm/eval-harness';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function passedResult(over: Partial<EvalCaseResult> = {}): EvalCaseResult {
  return {
    fixtureId: over.fixtureId ?? 'f1',
    label: over.label,
    runnerLabel: over.runnerLabel ?? 'A',
    actual: null,
    expectation: {},
    checks: over.checks ?? [{ name: 'ok', passed: true }],
    elapsedMs: over.elapsedMs ?? 12,
    passed: over.passed ?? true,
    error: over.error,
  };
}

function failedResult(over: Partial<EvalCaseResult> = {}): EvalCaseResult {
  return {
    fixtureId: over.fixtureId ?? 'f2',
    label: over.label,
    runnerLabel: over.runnerLabel ?? 'B',
    actual: null,
    expectation: {},
    checks: over.checks,
    elapsedMs: over.elapsedMs ?? 35,
    passed: over.passed ?? false,
    error: over.error,
  };
}
function erroredResult(over: Partial<EvalCaseResult> = {}): EvalCaseResult {
  return failedResult({
    ...over,
    error: over.error ?? 'upstream down',
    checks: [],
    passed: false,
  });
}

describe('EvalResultsTable — empty state', () => {
  it('renders the empty card when there are no results', () => {
    const { container } = render(<EvalResultsTable results={[]} testId="ert" />);
    expect(container.querySelector('[data-testid="ert-empty"]')).toBeTruthy();
  });
});

describe('EvalResultsTable — populated suite', () => {
  const suite: EvalCaseResult[] = [
    passedResult({ fixtureId: 'comm-1', label: 'communication Q', elapsedMs: 17 }),
    failedResult({
      fixtureId: 'tech-1',
      label: 'technical Q',
      elapsedMs: 41,
      checks: [{ name: 'focus tag', passed: false, detail: 'actual=communication' }],
    }),
    erroredResult({ fixtureId: 'error-1', label: 'agent threw', elapsedMs: 8 }),
  ];

  it('renders title + counts + total elapsed + footer', () => {
    const { container } = render(
      <EvalResultsTable results={suite} testId="ert" />,
    );
    expect(container.querySelector('[data-testid="ert-title"]')?.textContent).toContain(
      'Agent Eval Harness',
    );
    expect(container.querySelector('[data-testid="ert-counts"]')?.textContent).toContain(
      '1/3',
    );
    expect(container.querySelector('[data-testid="ert-elapsed"]')?.textContent).toMatch(
      /\d+ ms/,
    );
    expect(container.querySelector('[data-testid="ert-footer"]')?.textContent).toContain(
      '全局 pass-rate',
    );
  });

  it('renders one chip per runner with the right tone', () => {
    const { container } = render(
      <EvalResultsTable results={suite} testId="ert" />,
    );
    const a = container.querySelector('[data-testid="ert-runner-A"]') as HTMLElement | null;
    const b = container.querySelector('[data-testid="ert-runner-B"]') as HTMLElement | null;
    expect(a?.className).toMatch(/bg-emerald/);
    expect(b?.className).toMatch(/bg-rose/);
    expect(a?.textContent).toContain('1 ✅');
    expect(b?.textContent).toContain('0 ✅ / 2 ❌');
  });

  it('marks failed rows with the rose-tone status pill', () => {
    const { container } = render(
      <EvalResultsTable results={suite} testId="ert" />,
    );
    const statuses = container.querySelectorAll('[data-testid="ert-row-status"]');
    expect(statuses.length).toBe(3);
    expect(statuses[0]?.textContent).toContain('pass');
    expect(statuses[1]?.textContent).toContain('fail');
    expect(statuses[2]?.textContent).toContain('fail');
  });

  it('omits the details row until the user expands it', () => {
    const { container } = render(
      <EvalResultsTable results={suite} testId="ert" />,
    );
    expect(container.querySelector('[data-testid="ert-row-details"]')).toBeNull();
  });

  it('expands a row on click, showing every check + colour-coded status', () => {
    const { container } = render(<EvalResultsTable results={suite} testId="ert" />);
    const toggle = container.querySelector('button[data-testid="ert-row-toggle-tech-1"]') as HTMLButtonElement | null;
    expect(toggle).toBeTruthy();
    act(() => {
      fireEvent.click(toggle!);
    });
    const detailRow = container.querySelector('tr[data-testid="ert-row-details-tech-1"]') as HTMLElement | null;
    expect(detailRow).toBeTruthy();
    expect(detailRow!.textContent).toContain('focus tag');
    expect(detailRow!.textContent).toContain('actual=communication');

    const checks = container.querySelectorAll('[data-testid="ert-row-check"][data-fixture-id="tech-1"]');
    expect(checks.length).toBeGreaterThan(0);
    expect(checks[0]?.getAttribute('data-passed')).toBe('false');
  });

  it('collapses an expanded row on a second click', () => {
    const { container } = render(<EvalResultsTable results={suite} testId="ert" />);
    const toggle = container.querySelector('button[data-testid="ert-row-toggle-tech-1"]') as HTMLButtonElement | null;
    act(() => {
      fireEvent.click(toggle!);
    });
    expect(container.querySelector('tr[data-testid="ert-row-details-tech-1"]')).toBeTruthy();
    act(() => {
      fireEvent.click(toggle!);
    });
    expect(container.querySelector('tr[data-testid="ert-row-details-tech-1"]')).toBeNull();
  });

  it('shows the agent-thrown message instead of check details when the runner errored', () => {
    const { container } = render(<EvalResultsTable results={suite} testId="ert" />);
    const toggle = container.querySelector('button[data-testid="ert-row-toggle-error-1"]') as HTMLButtonElement | null;
    act(() => {
      fireEvent.click(toggle!);
    });
    const detailRow = container.querySelector('tr[data-testid="ert-row-details-error-1"]') as HTMLElement | null;
    expect(detailRow).toBeTruthy();
    expect(detailRow!.textContent).toContain('agent threw: upstream down');
  });

  it('renders per-row fixtureId + label cells', () => {
    const { container } = render(
      <EvalResultsTable results={suite} testId="ert" />,
    );
    const row = container.querySelector('[data-testid="ert-row"][data-fixture="tech-1"]') as HTMLElement | null;
    expect(row?.textContent).toContain('tech-1');
    expect(row?.textContent).toContain('technical Q');
    expect(row?.textContent).toContain('41 ms');
  });
});
