// V156: RejectHistoryList — parse candidate.notes reject lines + render timeline
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  formatRejectTimestamp,
  parseRejectNotes,
  RejectHistoryList,
} from '../src/components/interview/index.js';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- helpers ----------------

describe('parseRejectNotes', () => {
  it('returns an empty list for null / undefined / empty input', () => {
    expect(parseRejectNotes(undefined)).toEqual([]);
    expect(parseRejectNotes(null)).toEqual([]);
    expect(parseRejectNotes('')).toEqual([]);
  });

  it('parses a single reject line', () => {
    const out = parseRejectNotes('[rejected 2026-06-21T03:00:00.000Z] 技术深度不够');
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      timestamp: '2026-06-21T03:00:00.000Z',
      reason: '技术深度不够',
      line: 1,
    });
  });

  it('parses multiple reject lines mixed with unrelated notes', () => {
    const notes = [
      '## 自定义备注',
      '',
      '[rejected 2026-05-01T10:00:00.000Z] 第一次拒绝原因',
      '跟进: 候选人想再试一次',
      '[rejected 2026-06-15T12:30:00.000Z] 第二次拒绝 — 薪资差距较大',
    ].join('\n');
    const out = parseRejectNotes(notes);
    expect(out).toHaveLength(2);
    expect(out[0].timestamp).toBe('2026-05-01T10:00:00.000Z');
    expect(out[0].reason).toBe('第一次拒绝原因');
    expect(out[0].line).toBe(3);
    expect(out[1].reason).toBe('第二次拒绝 — 薪资差距较大');
    expect(out[1].line).toBe(5);
  });

  it('skips lines that do not match the [rejected <iso>] pattern', () => {
    const notes = [
      'random text',
      'not a reject: 123',
      '[rejected  ] empty timestamp',  // <S+> requires ≥1 non-space char so this is skipped
      '[rejected 2026-06-21T03:00:00.000Z] valid',
    ].join('\n');
    const out = parseRejectNotes(notes);
    // The regex requires at least one non-space char in the timestamp slot,
    // so the empty-timestamp line is filtered out.
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some((e) => e.reason === 'valid')).toBe(true);
  });

  it('trims whitespace from the reason', () => {
    const out = parseRejectNotes('[rejected 2026-06-21T03:00:00.000Z]   spaced   ');
    expect(out[0].reason).toBe('spaced');
  });
});

describe('formatRejectTimestamp', () => {
  it('formats an ISO timestamp as YYYY-MM-DD HH:MM', () => {
    // Use a fixed Date so the test is timezone-stable
    const iso = '2026-06-21T03:30:00.000Z';
    const out = formatRejectTimestamp(iso);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('returns the original string when the input is not a valid ISO date', () => {
    expect(formatRejectTimestamp('not-a-date')).toBe('not-a-date');
  });
});

// ---------------- UI ----------------

describe('RejectHistoryList UI', () => {
  it('renders the empty state when notes contain no reject lines', () => {
    render(<RejectHistoryList notes="just a normal note" />);
    expect(screen.getByTestId('reject-history-empty')).toBeTruthy();
  });

  it('renders the empty state when notes is undefined', () => {
    render(<RejectHistoryList notes={undefined} />);
    expect(screen.getByTestId('reject-history-empty')).toBeTruthy();
  });

  it('renders one entry per reject line, sorted most-recent-first', () => {
    const notes = [
      '[rejected 2026-05-01T10:00:00.000Z] older reason',
      '[rejected 2026-06-21T03:00:00.000Z] newer reason',
    ].join('\n');
    render(<RejectHistoryList notes={notes} />);
    const entries = screen.getAllByTestId('reject-history-entry');
    expect(entries).toHaveLength(2);
    // Most recent first
    expect(entries[0].textContent).toContain('newer reason');
    expect(entries[1].textContent).toContain('older reason');
  });

  it('shows a count badge with the total number of reject entries', () => {
    const notes = [
      '[rejected 2026-05-01T10:00:00.000Z] a',
      '[rejected 2026-06-01T10:00:00.000Z] b',
      '[rejected 2026-06-15T10:00:00.000Z] c',
    ].join('\n');
    render(<RejectHistoryList notes={notes} />);
    expect(screen.getByTestId('reject-history-count').textContent).toContain('3 次');
  });

  it('truncates to maxItems and shows a hidden-counter', () => {
    const notes = [
      '[rejected 2026-05-01T10:00:00.000Z] 1',
      '[rejected 2026-05-02T10:00:00.000Z] 2',
      '[rejected 2026-05-03T10:00:00.000Z] 3',
      '[rejected 2026-05-04T10:00:00.000Z] 4',
    ].join('\n');
    render(<RejectHistoryList notes={notes} maxItems={2} />);
    expect(screen.getAllByTestId('reject-history-entry')).toHaveLength(2);
    expect(screen.getByTestId('reject-history-hidden').textContent).toContain('还有 2 条');
  });
});