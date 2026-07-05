// V159: PipelineProgress — time-in-stage helper + inline "⏱ 在 X 阶段停留" label
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  computeTimeInCurrentStage,
  PipelineProgress,
} from '../src/components/interview/index.js';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

const FIXED_NOW = new Date('2026-07-04T12:00:00.000Z');

// ---------------- helpers ----------------

describe('computeTimeInCurrentStage', () => {
  it('returns "—" when no timestamp is provided', () => {
    const t = computeTimeInCurrentStage(undefined, FIXED_NOW);
    expect(t.formatted).toBe('—');
    expect(t.since).toBeNull();
  });

  it('returns "—" when the timestamp is not a valid ISO date', () => {
    const t = computeTimeInCurrentStage('not-a-date', FIXED_NOW);
    expect(t.formatted).toBe('—');
  });

  it('formats "X 天 Y 小时" when the diff is >= 1 day', () => {
    const t = computeTimeInCurrentStage('2026-06-29T09:00:00.000Z', FIXED_NOW);
    expect(t.days).toBe(5);
    expect(t.hours).toBe(3);
    expect(t.formatted).toBe('5 天 3 小时');
  });

  it('formats "X 天" (no hours) when hours is 0', () => {
    const t = computeTimeInCurrentStage('2026-06-29T12:00:00.000Z', FIXED_NOW);
    expect(t.formatted).toBe('5 天');
  });

  it('formats "X 小时" / "X 小时 Y 分钟" when diff < 1 day', () => {
    const t = computeTimeInCurrentStage('2026-07-04T09:30:00.000Z', FIXED_NOW);
    expect(t.formatted).toBe('2 小时 30 分钟');
  });

  it('formats "X 分钟" when diff < 1 hour', () => {
    const t = computeTimeInCurrentStage('2026-07-04T11:30:00.000Z', FIXED_NOW);
    expect(t.formatted).toBe('30 分钟');
  });

  it('formats "刚刚" when diff < 1 minute', () => {
    const t = computeTimeInCurrentStage('2026-07-04T11:59:30.000Z', FIXED_NOW);
    expect(t.formatted).toBe('刚刚');
  });

  it('returns "刚刚" when the timestamp is in the future (clock skew)', () => {
    const t = computeTimeInCurrentStage('2026-07-05T00:00:00.000Z', FIXED_NOW);
    expect(t.formatted).toBe('刚刚');
  });
});

// ---------------- UI ----------------

describe('PipelineProgress UI — "⏱ 在 X 阶段停留" (V159)', () => {
  it('renders the time-in-stage label with the formatted string', () => {
    render(
      <PipelineProgress
        status="interviewing"
        stageEnteredAt="2026-06-29T09:00:00.000Z"
      />,
    );
    const label = screen.getByTestId('pipeline-time-in-stage');
    expect(label.textContent).toContain('在');
    expect(label.textContent).toContain('阶段停留');
  });

  it('falls back to "—" when stageEnteredAt is not provided', () => {
    render(<PipelineProgress status="interviewing" />);
    const label = screen.getByTestId('pipeline-time-in-stage');
    expect(label.textContent).toContain('—');
  });

  it('shows the current stage label in the inline text (e.g. "面试中")', () => {
    render(<PipelineProgress status="interviewing" />);
    const label = screen.getByTestId('pipeline-time-in-stage');
    expect(label.textContent).toContain('面试中');
  });

  it('does NOT throw when stageEnteredAt is invalid', () => {
    expect(() =>
      render(<PipelineProgress status="interviewing" stageEnteredAt="garbage" />),
    ).not.toThrow();
  });
});