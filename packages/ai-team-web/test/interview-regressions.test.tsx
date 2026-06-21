// V33: Interview UX regression tests
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { InterviewSimulator } from '../src/components/InterviewSimulator.js';
import { Interviews } from '../src/pages/Interviews.js';
import { api } from '../src/lib/api.js';
import type { Candidate, Interview } from '@ai-team/core';

vi.mock('../src/lib/hooks.js', () => ({
  useTeamData: vi.fn(),
}));

const { useTeamData } = await import('../src/lib/hooks.js');

const candidate: Candidate = {
  id: 'ct_1',
  name: '张三',
  position: 'Frontend Engineer',
  source: 'website',
  status: 'new',
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-21T00:00:00Z',
};

function makeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: overrides.id ?? 'iv_1',
    candidateId: overrides.candidateId ?? candidate.id,
    position: overrides.position ?? candidate.position,
    type: overrides.type ?? 'technical',
    status: overrides.status ?? 'in_progress',
    turns: overrides.turns ?? [],
    aiConducted: overrides.aiConducted ?? true,
    interviewerName: overrides.interviewerName ?? 'AI',
    startedAt: overrides.startedAt ?? '2026-06-21T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InterviewSimulator regressions', () => {
  it('allows typing after interview starts even when first question is empty', async () => {
    const started = makeInterview({ id: 'iv_empty_question' });
    vi.spyOn(api, 'startInterview').mockResolvedValue({ interview: started, nextQuestion: null });
    vi.spyOn(api, 'submitAnswer').mockResolvedValue({
      interview: makeInterview({ id: started.id, turns: [{ role: 'candidate', content: '你好', timestamp: '2026-06-21T00:01:00Z' }] }),
      nextQuestion: '请介绍一个项目。',
      done: false,
    });

    render(<InterviewSimulator candidate={candidate} onClose={() => {}} onComplete={() => {}} />);

    const input = await screen.findByTestId('interview-answer-input') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    fireEvent.change(input, { target: { value: '你好' } });
    fireEvent.click(screen.getByTestId('interview-send-button'));

    await waitFor(() => expect(api.submitAnswer).toHaveBeenCalledWith('iv_empty_question', '你好'));
  });
});

describe('Interviews page regressions', () => {
  it('shows interview attempt number for each candidate interview', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [candidate],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [
          makeInterview({ id: 'iv_first', candidateId: candidate.id, startedAt: '2026-06-20T00:00:00Z', status: 'completed' }),
          makeInterview({ id: 'iv_second', candidateId: candidate.id, startedAt: '2026-06-21T00:00:00Z', status: 'in_progress' }),
        ],
      },
    });

    render(<Interviews />);

    await waitFor(() => screen.getByTestId('interview-attempt-iv_second'));
    expect(screen.getByTestId('interview-attempt-iv_first').textContent).toContain('第 1 面');
    expect(screen.getByTestId('interview-attempt-iv_second').textContent).toContain('第 2 面');
  });
});
