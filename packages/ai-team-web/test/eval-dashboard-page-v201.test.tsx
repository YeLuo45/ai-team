// V201: EvalDashboard page tests — wires V199 EvalDashboardPage into the
// SPA route. Verifies the page reads adoption history from localStorage
// and renders the dashboard with the right data-testid / counts.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EvalDashboard } from '../src/pages/EvalDashboard';
import { writeHistory } from '../src/lib/question-suggestion/history';

vi.mock('../src/lib/hooks', () => ({
  useTeamData: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useTeamData } = await import('../src/lib/hooks');
const mockedUseTeamData = useTeamData as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-12T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('EvalDashboard page', () => {
  it('renders loading state when team data is loading', () => {
    mockedUseTeamData.mockReturnValue({
      loading: true,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: null,
    });
    const { container } = render(<EvalDashboard />);
    expect(container.querySelector('[data-testid="eval-dashboard-loading"]')).toBeTruthy();
  });

  it('renders error state when team data fails to load', () => {
    mockedUseTeamData.mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: 'boom',
      data: null,
    });
    const { container } = render(<EvalDashboard />);
    const errEl = container.querySelector('[data-testid="eval-dashboard-error"]');
    expect(errEl).toBeTruthy();
    expect(errEl?.textContent).toContain('boom');
  });

  it('renders the EvalDashboardPage with adoption events pulled from history', () => {
    mockedUseTeamData.mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [],
        members: [],
        trainings: [],
        generatedAt: '2026-07-12T09:00:00Z',
        interviews: [],
      },
    });
    const NOW = Date.now();
    writeHistory(window.localStorage, {
      version: 1,
      entries: [
        {
          suggestionId: 'q-1',
          question: 'Q1',
          rationale: 'r',
          difficulty: 'medium',
          adoptedAt: NOW - 60_000,
          sessionId: 'ct_alice',
          candidateName: 'Alice',
          position: 'Senior',
        },
        {
          suggestionId: 'q-1',
          question: 'Q1',
          rationale: 'r',
          difficulty: 'medium',
          adoptedAt: NOW - 2 * 86_400_000,
          sessionId: 'ct_bob',
          candidateName: 'Bob',
          position: 'Junior',
        },
        {
          suggestionId: 'q-2',
          question: 'Q2',
          rationale: 'r',
          difficulty: 'easy',
          adoptedAt: NOW - 30 * 86_400_000,
          sessionId: 'ct_carol',
          candidateName: 'Carol',
          position: 'Senior',
        },
      ],
    });

    const { container } = render(<EvalDashboard />);
    const root = container.querySelector('[data-testid="eval-dashboard"]');
    expect(root).toBeTruthy();
    const dash = container.querySelector('[data-testid="edp"]');
    expect(dash).toBeTruthy();
    expect(dash?.getAttribute('data-cases')).toBe('0'); // no eval results yet
    expect(dash?.getAttribute('data-pass-rate')).toBe('0.0');
    expect(container.querySelector('[data-testid="edp-adoptions"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="edp-top-q-q-1"]')).toBeTruthy();
  });
});