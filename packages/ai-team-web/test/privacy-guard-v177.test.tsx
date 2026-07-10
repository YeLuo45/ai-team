// V177: PrivacyGuard tests.
//
// Two surfaces:
//   1. Pure helpers (lib/privacy/guard.ts): evaluateGuard / isOperationBlocked / guardTone
//   2. PrivacyGate component: render decision tree for each mode + op combo

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  evaluateGuard,
  isOperationBlocked,
  guardTone,
  OK,
  WARN_PARTIAL,
  BLOCK_REMOTE_OP,
  type PrivacySensitiveOp,
} from '../src/lib/privacy/guard';
import {
  summarizePrivacy,
  type PrivacyInputs,
  type PrivacyStatus,
} from '../src/lib/privacy/summary';
import { PrivacyGate, usePrivacyDecision } from '../src/components/privacy/PrivacyGate';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function status(mode: 'full-local' | 'partial-local' | 'remote'): PrivacyStatus {
  if (mode === 'full-local') {
    return summarizePrivacy({ sttLocal: true, llmLocal: true } satisfies PrivacyInputs);
  }
  if (mode === 'partial-local') {
    return summarizePrivacy({ sttLocal: true, llmLocal: false } satisfies PrivacyInputs);
  }
  return summarizePrivacy({ sttLocal: false, llmLocal: false } satisfies PrivacyInputs);
}

const OPS: ReadonlyArray<PrivacySensitiveOp> = [
  'export-audio',
  'export-interview',
  'clipboard-copy',
  'cloud-summary',
];

describe('evaluateGuard', () => {
  it('returns the OK sentinel when the privacy status is full-local', () => {
    for (const op of OPS) {
      const d = evaluateGuard(status('full-local'), op);
      expect(d).toBe(OK);
      expect(d.blocked).toBe(false);
      expect(d.tone).toBe('ok');
    }
  });

  it('returns the WARN_PARTIAL sentinel when the status is partial-local', () => {
    for (const op of OPS) {
      const d = evaluateGuard(status('partial-local'), op);
      expect(d).toBe(WARN_PARTIAL);
      expect(d.blocked).toBe(false);
      expect(d.tone).toBe('warn');
    }
  });

  it('blocks every privacy-sensitive op in remote mode', () => {
    for (const op of OPS) {
      const d = evaluateGuard(status('remote'), op);
      expect(d.blocked).toBe(true);
      expect(d.tone).toBe('block');
      expect(d.label).toContain('已阻止');
    }
  });

  it('uses the BLOCK_REMOTE_OP decision for export-audio in remote mode', () => {
    const d = evaluateGuard(status('remote'), 'export-audio');
    expect(d).toBe(BLOCK_REMOTE_OP);
  });

  it('never resolves to a different BLOCK_REMOTE decision at the same op boundary', () => {
    for (const op of OPS) {
      const d = evaluateGuard(status('remote'), op);
      // Sanity: BLOCK_REMOTE_OP itself varies by op. The test just asserts
      // the result remains consistent across calls.
      const d2 = evaluateGuard(status('remote'), op);
      expect(d).toBe(d2);
    }
  });
});

describe('isOperationBlocked / guardTone', () => {
  it('mirrors evaluateGuard()', () => {
    for (const mode of ['full-local', 'partial-local', 'remote'] as const) {
      for (const op of OPS) {
        const s = status(mode);
        const d = evaluateGuard(s, op);
        expect(isOperationBlocked(s, op)).toBe(d.blocked);
        expect(guardTone(s, op)).toBe(d.tone);
      }
    }
  });
});

describe('PrivacyGate', () => {
  it('renders children raw with no decoration when privacy is full-local', () => {
    const { container } = render(
      <PrivacyGate status={status('full-local')} op="export-audio" testId="pg">
        <button data-testid="child">Save audio</button>
      </PrivacyGate>,
    );
    expect(container.querySelector('[data-testid="pg-ok"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="pg-chip"]')).toBeNull();
    expect(container.querySelector('[data-testid="pg-blocked"]')).toBeNull();
  });

  it('renders a warning chip + visible children when partial-local', () => {
    const { container } = render(
      <PrivacyGate status={status('partial-local')} op="export-interview" testId="pg">
        <span data-testid="child">Export</span>
      </PrivacyGate>,
    );
    expect(container.querySelector('[data-testid="pg-warn"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="pg-chip"]')?.textContent).toContain(
      '部分数据外发',
    );
    expect(container.querySelector('[data-testid="pg-detail"]')?.textContent).toBe(
      '部分 provider 为远程 — 数据可能经过外部服务',
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it('blocks the operation with a banner + fallback in remote mode', () => {
    const { container } = render(
      <PrivacyGate
        status={status('remote')}
        op="clipboard-copy"
        testId="pg"
        fallback={<span data-testid="fallback">请重新选择本地 provider</span>}
      >
        <button data-testid="child">Copy to clipboard</button>
      </PrivacyGate>,
    );
    const blocked = container.querySelector('[data-testid="pg-blocked"]') as HTMLElement | null;
    expect(blocked).toBeTruthy();
    expect(blocked!.getAttribute('role')).toBe('alert');
    expect(blocked!.getAttribute('data-blocked')).toBe('true');
    expect(blocked!.getAttribute('data-op')).toBe('clipboard-copy');
    expect(blocked!.getAttribute('data-mode')).toBe('remote');
    expect(blocked!.textContent).toContain('已阻止');
    // Children suppressed.
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
    // Fallback rendered.
    expect(container.querySelector('[data-testid="fallback"]')).toBeTruthy();
  });

  it('omits the fallback node when none is supplied (blocked variant)', () => {
    const { container } = render(
      <PrivacyGate status={status('remote')} op="export-audio" testId="pg">
        <button data-testid="child">Save</button>
      </PrivacyGate>,
    );
    expect(container.querySelector('[data-testid="pg-blocked"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
    expect(container.querySelector('[data-testid="pg-fallback"]')).toBeNull();
  });

  it('also blocks cloud-summary in remote mode', () => {
    const { container } = render(
      <PrivacyGate status={status('remote')} op="cloud-summary" testId="pg">
        <span data-testid="child">x</span>
      </PrivacyGate>,
    );
    expect(container.querySelector('[data-testid="pg-blocked"]')).toBeTruthy();
  });

  it('exports usePrivacyDecision as a thin hook wrapper', () => {
    const d = usePrivacyDecision(status('partial-local'), 'export-audio');
    expect(d.tone).toBe('warn');
  });
});
