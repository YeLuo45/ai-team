// V154: PipelineProgress — "恢复为面试中" off-path restore button
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PipelineProgress } from '../src/components/interview/index.js';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

describe('PipelineProgress — "恢复为面试中" button (V154)', () => {
  it('does NOT render the restore button when status is not "rejected"', () => {
    render(<PipelineProgress status="interviewing" onRestore={() => {}} />);
    expect(screen.queryByTestId('pipeline-restore')).toBeNull();
  });

  it('does NOT render the restore button when status="rejected" but onRestore is missing', () => {
    render(<PipelineProgress status="rejected" />);
    expect(screen.queryByTestId('pipeline-restore')).toBeNull();
  });

  it('renders the restore button when status="rejected" + onRestore is provided', () => {
    render(<PipelineProgress status="rejected" onRestore={() => {}} />);
    const btn = screen.getByTestId('pipeline-restore');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('恢复为面试中');
    expect(btn.getAttribute('title')).toContain('恢复到面试中阶段');
  });

  it('invokes onRestore with "interviewing" when clicked', () => {
    const onRestore = vi.fn();
    render(<PipelineProgress status="rejected" onRestore={onRestore} />);
    fireEvent.click(screen.getByTestId('pipeline-restore'));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith('interviewing');
  });

  it('disables the restore button when busy=true and ignores clicks', () => {
    const onRestore = vi.fn();
    render(<PipelineProgress status="rejected" onRestore={onRestore} busy />);
    const btn = screen.getByTestId('pipeline-restore') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('renders restore + record-reject side-by-side when both callbacks are provided', () => {
    render(
      <PipelineProgress
        status="rejected"
        onRestore={() => {}}
        onRecordReject={() => {}}
      />,
    );
    expect(screen.getByTestId('pipeline-restore')).toBeTruthy();
    expect(screen.getByTestId('pipeline-record-reject')).toBeTruthy();
  });
});