// V150: PipelineProgress — candidate status → 5-stage hiring timeline
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  mapStatusToPipeline,
  PipelineProgress,
  type PipelineStage,
} from '../src/components/interview/index.js';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- helpers ----------------

describe('mapStatusToPipeline', () => {
  it('maps all 5 in-path statuses to the matching stage index', () => {
    const cases: Array<[string, PipelineStage, number]> = [
      ['new',          'new',          0],
      ['screening',    'screening',    1],
      ['interviewing', 'interviewing', 2],
      ['offer',        'offer',        3],
      ['hired',        'hired',        4],
    ];
    for (const [status, expectedStage, expectedIndex] of cases) {
      const result = mapStatusToPipeline(status);
      expect(result.currentStage).toBe(expectedStage);
      expect(result.currentIndex).toBe(expectedIndex);
      expect(result.isOffPath).toBe(false);
      expect(result.totalStages).toBe(5);
    }
  });

  it('marks "rejected" as off-path (mapped to interviewing stage)', () => {
    const result = mapStatusToPipeline('rejected');
    expect(result.isOffPath).toBe(true);
    expect(result.currentStage).toBe('interviewing');
  });

  it('falls back to "new" for unknown / undefined status', () => {
    expect(mapStatusToPipeline(undefined).currentStage).toBe('new');
    expect(mapStatusToPipeline('garbage').currentStage).toBe('new');
  });
});

// ---------------- UI ----------------

describe('PipelineProgress UI', () => {
  it('renders 5 steps in fixed order with Chinese labels', () => {
    render(<PipelineProgress status="new" />);
    const steps = screen.getByTestId('pipeline-steps');
    const items = steps.querySelectorAll('li');
    expect(items).toHaveLength(5);
    expect(steps.textContent).toContain('新录入');
    expect(steps.textContent).toContain('筛选中');
    expect(steps.textContent).toContain('面试中');
    expect(steps.textContent).toContain('Offer');
    expect(steps.textContent).toContain('已入职');
  });

  it('marks the matching step as current and earlier steps as completed', () => {
    render(<PipelineProgress status="interviewing" />);
    // 'new' is completed
    const newStep = screen.getByTestId('pipeline-step-new');
    expect(newStep.querySelector('[data-completed="true"]')).toBeTruthy();
    expect(newStep.querySelector('[data-current="true"]')).toBeNull();

    // 'screening' is completed
    const screening = screen.getByTestId('pipeline-step-screening');
    expect(screening.querySelector('[data-completed="true"]')).toBeTruthy();

    // 'interviewing' is current
    const interviewing = screen.getByTestId('pipeline-step-interviewing');
    expect(interviewing.querySelector('[data-current="true"]')).toBeTruthy();
    expect(screen.getByTestId('pipeline-current-dot-interviewing')).toBeTruthy();

    // 'offer' and 'hired' are not started
    const offer = screen.getByTestId('pipeline-step-offer');
    expect(offer.querySelector('[data-current="true"]')).toBeNull();
    expect(offer.querySelector('[data-completed="true"]')).toBeNull();
  });

  it('marks all steps as completed when status is "hired"', () => {
    render(<PipelineProgress status="hired" />);
    for (const key of ['new', 'screening', 'interviewing', 'offer']) {
      const step = screen.getByTestId(`pipeline-step-${key}`);
      expect(step.querySelector('[data-completed="true"]')).toBeTruthy();
    }
    const hired = screen.getByTestId('pipeline-step-hired');
    expect(hired.querySelector('[data-current="true"]')).toBeTruthy();
  });

  it('shows the off-path badge when status is "rejected"', () => {
    render(<PipelineProgress status="rejected" />);
    expect(screen.getByTestId('pipeline-off-path').textContent).toContain('已拒绝');
  });

  it('does not show the off-path badge for in-path statuses', () => {
    render(<PipelineProgress status="interviewing" />);
    expect(screen.queryByTestId('pipeline-off-path')).toBeNull();
  });

  it('falls back to "new" stage when status is undefined or unknown', () => {
    const { rerender } = render(<PipelineProgress status={undefined} />);
    const newStep = screen.getByTestId('pipeline-step-new');
    expect(newStep.querySelector('[data-current="true"]')).toBeTruthy();

    rerender(<PipelineProgress status="garbage" />);
    const newStep2 = screen.getByTestId('pipeline-step-new');
    expect(newStep2.querySelector('[data-current="true"]')).toBeTruthy();
  });
});