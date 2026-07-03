// V145: Candidates page — interview count + navigate to /interviews detail
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Candidate, Interview } from '@ai-team/core';
import { Candidates } from '../src/pages/Candidates.js';
import { Interviews } from '../src/pages/Interviews.js';

vi.mock('../src/lib/hooks.js', () => ({
  useTeamData: vi.fn(),
}));

const { useTeamData } = await import('../src/lib/hooks.js');

const candidateWithInterviews: Candidate = {
  id: 'ct_t01',
  name: '李婷',
  position: '资深前端工程师',
  source: 'referral',
  status: 'interviewing',
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-25T00:00:00Z',
  email: 'liting@example.com',
};

const candidateNoInterviews: Candidate = {
  id: 'ct_t02',
  name: '赵六',
  position: 'Dev',
  source: 'website',
  status: 'new',
  createdAt: '2026-06-22T00:00:00Z',
  updatedAt: '2026-06-22T00:00:00Z',
};

function makeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: overrides.id ?? 'iv_1',
    candidateId: overrides.candidateId ?? candidateWithInterviews.id,
    position: overrides.position ?? candidateWithInterviews.position,
    type: overrides.type ?? 'technical',
    status: overrides.status ?? 'completed',
    turns: overrides.turns ?? [],
    aiConducted: overrides.aiConducted ?? true,
    interviewerName: overrides.interviewerName ?? 'AI',
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    evaluation: overrides.evaluation,
  };
}

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/interviews" element={<Interviews />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Candidates — interview count badge + navigate button', () => {
  it('shows interview count + enables navigate button for candidates with interviews', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [candidateWithInterviews, candidateNoInterviews],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [
          makeInterview({ id: 'iv_a', candidateId: candidateWithInterviews.id, completedAt: '2026-06-21T01:00:00Z' }),
          makeInterview({ id: 'iv_b', candidateId: candidateWithInterviews.id, completedAt: '2026-06-22T01:00:00Z' }),
          makeInterview({ id: 'iv_c', candidateId: candidateWithInterviews.id, completedAt: '2026-06-23T01:00:00Z' }),
        ],
      },
    });

    renderWithRouter('/candidates');

    await waitFor(() => screen.getByTestId('candidate-view-interviews-ct_t01'));
    expect(screen.getByTestId('candidate-interview-count-ct_t01').textContent).toBe('3 场面试');
    const btnWithIv = screen.getByTestId('candidate-view-interviews-ct_t01') as HTMLButtonElement;
    expect(btnWithIv.disabled).toBe(false);

    expect(screen.getByTestId('candidate-interview-count-ct_t02').textContent).toBe('0 场面试');
    const btnNoIv = screen.getByTestId('candidate-view-interviews-ct_t02') as HTMLButtonElement;
    expect(btnNoIv.disabled).toBe(true);
    expect(btnNoIv.title).toContain('暂无面试记录');
  });

  it('navigates to /interviews?candidate=<id> when the navigate button is clicked', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [candidateWithInterviews],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [makeInterview({ id: 'iv_a', candidateId: candidateWithInterviews.id })],
      },
    });

    renderWithRouter('/candidates');

    await waitFor(() => screen.getByTestId('candidate-view-interviews-ct_t01'));
    fireEvent.click(screen.getByTestId('candidate-view-interviews-ct_t01'));

    // After navigation, the Interviews page should mount and select ct_t01
    await waitFor(() => screen.getByTestId('candidate-card-ct_t01'));
    expect(screen.getByTestId('resume-card')).toBeTruthy();
    // The candidate sidebar should highlight ct_t01 (active card has border-brand-500)
    const activeCard = screen.getByTestId('candidate-card-ct_t01');
    expect(activeCard.getAttribute('class') ?? '').toMatch(/border-brand-500/);
  });
});

describe('Interviews — auto-select candidate from URL ?candidate=<id>', () => {
  it('honors ?candidate=<id> when that candidate has interviews', async () => {
    const otherCandidate: Candidate = {
      id: 'ct_other',
      name: 'Other',
      position: 'PM',
      source: 'website',
      status: 'new',
      createdAt: '2026-06-20T00:00:00Z',
      updatedAt: '2026-06-20T00:00:00Z',
    };
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [candidateWithInterviews, otherCandidate],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [
          makeInterview({ id: 'iv_t', candidateId: candidateWithInterviews.id, completedAt: '2026-06-21T01:00:00Z' }),
          makeInterview({ id: 'iv_o', candidateId: otherCandidate.id, completedAt: '2026-06-20T01:00:00Z' }),
        ],
      },
    });

    renderWithRouter('/interviews?candidate=ct_t01');

    await waitFor(() => screen.getByTestId('candidate-card-ct_t01'));
    const activeCard = screen.getByTestId('candidate-card-ct_t01');
    expect(activeCard.getAttribute('class') ?? '').toMatch(/border-brand-500/);
    expect(screen.getByTestId('resume-card')).toBeTruthy();
  });

  it('falls back to the latest candidate when ?candidate=<id> points to a missing id', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [candidateWithInterviews],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [makeInterview({ id: 'iv_a', candidateId: candidateWithInterviews.id, completedAt: '2026-06-21T01:00:00Z' })],
      },
    });

    renderWithRouter('/interviews?candidate=ct_does_not_exist');

    await waitFor(() => screen.getByTestId('candidate-card-ct_t01'));
    const activeCard = screen.getByTestId('candidate-card-ct_t01');
    expect(activeCard.getAttribute('class') ?? '').toMatch(/border-brand-500/);
  });
});