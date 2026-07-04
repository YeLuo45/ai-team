// V146: CandidateInterviewPanel — back / prev / next nav toolbar + Interviews page wiring
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Candidate, Interview } from '@ai-team/core';
import { CandidateInterviewPanel, type CandidateNavContext } from '../src/components/interview/index.js';
import { Interviews } from '../src/pages/Interviews.js';

vi.mock('../src/lib/hooks.js', () => ({
  useTeamData: vi.fn(),
}));

const { useTeamData } = await import('../src/lib/hooks.js');

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: overrides.id ?? 'ct_a',
    name: overrides.name ?? 'A',
    position: overrides.position ?? 'Engineer',
    source: overrides.source ?? 'website',
    status: overrides.status ?? 'new',
    createdAt: overrides.createdAt ?? '2026-06-21T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-06-21T00:00:00Z',
  };
}

function makeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: overrides.id ?? 'iv_1',
    candidateId: overrides.candidateId ?? 'ct_a',
    position: overrides.position ?? 'Engineer',
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

const evalData = {
  overall: 80,
  breakdown: { technical: 80, communication: 80, problemSolving: 80, culture: 80 },
  strengths: ['s'],
  concerns: [],
  recommendation: 'hire' as const,
  summary: 'ok',
  evaluatedAt: '2026-06-21T01:00:00Z',
};

beforeEach(() => vi.restoreAllMocks());
afterEach(() => cleanup());

// ---------------- CandidateInterviewPanel nav toolbar ----------------

describe('CandidateInterviewPanel — nav toolbar', () => {
  it('renders the toolbar with back/prev/next when callbacks are provided', () => {
    const candidate = makeCandidate({ name: '李婷' });
    const rounds = [makeInterview({ id: 'iv_1', evaluation: evalData })].map((iv) => Object.assign(iv, { round: 1 }));
    const nav: CandidateNavContext = {
      hasPrev: true,
      hasNext: true,
      prevCandidateName: '王浩',
      nextCandidateName: '陈思',
      currentIndex: 2,
      total: 4,
    };
    render(
      <CandidateInterviewPanel
        candidate={candidate}
        candidateId={candidate.id}
        rounds={rounds}
        nav={nav}
        onBack={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByTestId('candidate-nav-toolbar')).toBeTruthy();
    expect(screen.getByTestId('candidate-nav-position').textContent).toBe('2 / 4');
    expect(screen.getByTestId('candidate-nav-prev').getAttribute('title')).toBe('上一位：王浩');
    expect(screen.getByTestId('candidate-nav-next').getAttribute('title')).toBe('下一位：陈思');
  });

  it('disables prev when hasPrev is false and shows fallback tooltip', () => {
    const candidate = makeCandidate({ name: '李婷' });
    const rounds = [makeInterview({ id: 'iv_1', evaluation: evalData })].map((iv) => Object.assign(iv, { round: 1 }));
    const nav: CandidateNavContext = {
      hasPrev: false,
      hasNext: true,
      currentIndex: 1,
      total: 3,
    };
    render(
      <CandidateInterviewPanel
        candidate={candidate}
        candidateId={candidate.id}
        rounds={rounds}
        nav={nav}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    const prev = screen.getByTestId('candidate-nav-prev') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(prev.getAttribute('title')).toBe('已是第一位候选人');
  });

  it('disables next at the end with fallback tooltip', () => {
    const candidate = makeCandidate({ name: '陈思' });
    const rounds = [makeInterview({ id: 'iv_1', evaluation: evalData })].map((iv) => Object.assign(iv, { round: 1 }));
    const nav: CandidateNavContext = {
      hasPrev: true,
      hasNext: false,
      currentIndex: 3,
      total: 3,
    };
    render(
      <CandidateInterviewPanel
        candidate={candidate}
        candidateId={candidate.id}
        rounds={rounds}
        nav={nav}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    const next = screen.getByTestId('candidate-nav-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(next.getAttribute('title')).toBe('已是最后一位候选人');
  });

  it('invokes onBack / onPrev / onNext callbacks', () => {
    const candidate = makeCandidate();
    const rounds = [makeInterview({ id: 'iv_1', evaluation: evalData })].map((iv) => Object.assign(iv, { round: 1 }));
    const onBack = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const nav: CandidateNavContext = {
      hasPrev: true,
      hasNext: true,
      currentIndex: 2,
      total: 3,
    };
    render(
      <CandidateInterviewPanel
        candidate={candidate}
        candidateId={candidate.id}
        rounds={rounds}
        nav={nav}
        onBack={onBack}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByTestId('candidate-nav-back'));
    fireEvent.click(screen.getByTestId('candidate-nav-prev'));
    fireEvent.click(screen.getByTestId('candidate-nav-next'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the toolbar when no nav callback is provided', () => {
    const candidate = makeCandidate();
    const rounds = [makeInterview({ id: 'iv_1', evaluation: evalData })].map((iv) => Object.assign(iv, { round: 1 }));
    render(<CandidateInterviewPanel candidate={candidate} candidateId={candidate.id} rounds={rounds} />);
    expect(screen.queryByTestId('candidate-nav-toolbar')).toBeNull();
  });
});

// ---------------- Interviews page nav integration ----------------

describe('Interviews page — nav toolbar wired', () => {
  it('shows the nav toolbar with prev/next for the currently selected candidate', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [
          makeCandidate({ id: 'ct_a', name: 'A' }),
          makeCandidate({ id: 'ct_b', name: 'B' }),
          makeCandidate({ id: 'ct_c', name: 'C' }),
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [
          makeInterview({ id: 'iv_a', candidateId: 'ct_a', completedAt: '2026-06-21T01:00:00Z', evaluation: evalData }),
          makeInterview({ id: 'iv_b', candidateId: 'ct_b', completedAt: '2026-06-22T01:00:00Z', evaluation: evalData }),
          makeInterview({ id: 'iv_c', candidateId: 'ct_c', completedAt: '2026-06-23T01:00:00Z', evaluation: evalData }),
        ],
      },
    });

    render(<MemoryRouter><Interviews /></MemoryRouter>);

    await waitFor(() => screen.getByTestId('candidate-nav-toolbar'), { timeout: 3000 });
    expect(screen.getByTestId('candidate-nav-position').textContent).toMatch(/1 \/ 3|2 \/ 3|3 \/ 3/);
    // Latest interview sorts first (ct_c) → currentIndex=1 → prev=null
    expect(screen.queryByTestId('candidate-nav-prev')).toBeNull();
    expect(screen.getByTestId('candidate-nav-next').getAttribute('title')).toBe('下一位：B');
    const next = screen.getByTestId('candidate-nav-next') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
  });

  it('clicking "下一个" switches the active candidate', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [
          makeCandidate({ id: 'ct_a', name: 'A' }),
          makeCandidate({ id: 'ct_b', name: 'B' }),
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [
          makeInterview({ id: 'iv_a', candidateId: 'ct_a', completedAt: '2026-06-21T01:00:00Z', evaluation: evalData }),
          makeInterview({ id: 'iv_b', candidateId: 'ct_b', completedAt: '2026-06-22T01:00:00Z', evaluation: evalData }),
        ],
      },
    });

    render(<MemoryRouter><Interviews /></MemoryRouter>);

    await waitFor(() => screen.getByTestId('candidate-nav-toolbar'));
    // Get the first active card before clicking next
    const initialActive = screen.getByTestId('candidate-card-ct_b'); // latest first
    expect(initialActive.getAttribute('class') ?? '').toMatch(/border-brand-500/);

    fireEvent.click(screen.getByTestId('candidate-nav-next'));
    await waitFor(() => {
      const newActive = screen.getByTestId('candidate-card-ct_a');
      expect(newActive.getAttribute('class') ?? '').toMatch(/border-brand-500/);
    });
  });

  it('the "上一个" / "下一个" buttons are absent when only one candidate exists', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [makeCandidate({ id: 'ct_a', name: 'A' })],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [makeInterview({ id: 'iv_a', candidateId: 'ct_a', completedAt: '2026-06-21T01:00:00Z', evaluation: evalData })],
      },
    });

    render(<MemoryRouter><Interviews /></MemoryRouter>);

    await waitFor(() => screen.getByTestId('candidate-nav-toolbar'));
    expect(screen.queryByTestId('candidate-nav-prev')).toBeNull();
    expect(screen.queryByTestId('candidate-nav-next')).toBeNull();
    expect(screen.getByTestId('candidate-nav-position').textContent).toBe('1 / 1');
  });
});