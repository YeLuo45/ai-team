// V152: PipelineProgress — prev/next stage navigation buttons
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  mapStatusToPipeline,
  nextStage,
  PipelineProgress,
  prevStage,
  stageToStatus,
  type PipelineStage,
} from '../src/components/interview/index.js';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- helpers ----------------

describe('nextStage / prevStage', () => {
  it('advances from "new" to "screening"', () => {
    expect(nextStage('new')).toBe('screening');
  });

  it('advances through the full chain (new → screening → interviewing → offer → hired)', () => {
    expect(nextStage('new')).toBe('screening');
    expect(nextStage('screening')).toBe('interviewing');
    expect(nextStage('interviewing')).toBe('offer');
    expect(nextStage('offer')).toBe('hired');
  });

  it('returns null after the last stage ("hired")', () => {
    expect(nextStage('hired')).toBeNull();
  });

  it('walks backward through the chain', () => {
    expect(prevStage('hired')).toBe('offer');
    expect(prevStage('offer')).toBe('interviewing');
    expect(prevStage('interviewing')).toBe('screening');
    expect(prevStage('screening')).toBe('new');
  });

  it('returns null at the first stage ("new")', () => {
    expect(prevStage('new')).toBeNull();
  });

  it('round-trips a few stages', () => {
    expect(prevStage(nextStage('new')!)).toBe('new');
    expect(prevStage(nextStage('screening')!)).toBe('screening');
    expect(prevStage(nextStage('interviewing')!)).toBe('interviewing');
  });
});

describe('stageToStatus', () => {
  it('returns the stage as-is (PipelineStage ⇄ CandidateStatus share the same vocabulary)', () => {
    expect(stageToStatus('new' as PipelineStage)).toBe('new');
    expect(stageToStatus('interviewing' as PipelineStage)).toBe('interviewing');
    expect(stageToStatus('hired' as PipelineStage)).toBe('hired');
  });
});

describe('mapStatusToPipeline (smoke test for V152)', () => {
  it('still returns the same shape as before (currentStage, currentIndex, totalStages, isOffPath)', () => {
    const result = mapStatusToPipeline('interviewing');
    expect(result.currentStage).toBe('interviewing');
    expect(result.currentIndex).toBe(2);
    expect(result.totalStages).toBe(5);
    expect(result.isOffPath).toBe(false);
  });
});

// ---------------- UI: prev/next buttons ----------------

describe('PipelineProgress UI — prev/next buttons', () => {
  it('does not render prev/next buttons when onAdvance is not provided', () => {
    render(<PipelineProgress status="new" />);
    expect(screen.queryByTestId('pipeline-prev')).toBeNull();
    expect(screen.queryByTestId('pipeline-next')).toBeNull();
  });

  it('renders prev disabled + next enabled for "new"', () => {
    const onAdvance = vi.fn();
    render(<PipelineProgress status="new" onAdvance={onAdvance} />);
    const prev = screen.getByTestId('pipeline-prev') as HTMLButtonElement;
    const next = screen.getByTestId('pipeline-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(prev.title).toBe('已是第一阶段');
    expect(next.disabled).toBe(false);
    expect(next.title).toBe('下一阶段：screening');
  });

  it('renders prev enabled + next disabled for "hired"', () => {
    const onAdvance = vi.fn();
    render(<PipelineProgress status="hired" onAdvance={onAdvance} />);
    const prev = screen.getByTestId('pipeline-prev') as HTMLButtonElement;
    const next = screen.getByTestId('pipeline-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
    expect(prev.title).toBe('上一阶段：offer');
    expect(next.disabled).toBe(true);
    expect(next.title).toBe('已是最后阶段');
  });

  it('renders both prev + next enabled for "interviewing"', () => {
    const onAdvance = vi.fn();
    render(<PipelineProgress status="interviewing" onAdvance={onAdvance} />);
    const prev = screen.getByTestId('pipeline-prev') as HTMLButtonElement;
    const next = screen.getByTestId('pipeline-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
    expect(prev.title).toBe('上一阶段：screening');
    expect(next.disabled).toBe(false);
    expect(next.title).toBe('下一阶段：offer');
  });

  it('invokes onAdvance with the next stage when next is clicked', () => {
    const onAdvance = vi.fn();
    render(<PipelineProgress status="screening" onAdvance={onAdvance} />);
    fireEvent.click(screen.getByTestId('pipeline-next'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onAdvance).toHaveBeenCalledWith('interviewing');
  });

  it('invokes onAdvance with the previous stage when prev is clicked', () => {
    const onAdvance = vi.fn();
    render(<PipelineProgress status="interviewing" onAdvance={onAdvance} />);
    fireEvent.click(screen.getByTestId('pipeline-prev'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onAdvance).toHaveBeenCalledWith('screening');
  });

  it('disables both buttons when busy=true', () => {
    const onAdvance = vi.fn();
    render(<PipelineProgress status="interviewing" onAdvance={onAdvance} busy />);
    const prev = screen.getByTestId('pipeline-prev') as HTMLButtonElement;
    const next = screen.getByTestId('pipeline-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    fireEvent.click(prev);
    fireEvent.click(next);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('does not invoke onAdvance when the boundary button (next on "hired") is clicked', () => {
    const onAdvance = vi.fn();
    render(<PipelineProgress status="hired" onAdvance={onAdvance} />);
    // next is disabled, so click should be ignored
    fireEvent.click(screen.getByTestId('pipeline-next'));
    expect(onAdvance).not.toHaveBeenCalled();
  });
});