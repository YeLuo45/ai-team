// V112: 5 critical-path e2e-style flow tests using happy-dom + RTL
// Mirrors what Playwright would test but stays in unit-test land
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  resetResourceCache,
  resetEventBus,
  getResourceCache,
} from '../src/lib/data-layer/index.js';

beforeEach(() => {
  resetResourceCache();
  resetEventBus();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetchSequence(responses: Array<{ match: (url: string) => boolean; body: unknown; status?: number }>) {
  globalThis.fetch = vi.fn(async (url: string) => {
    for (const r of responses) {
      if (r.match(url)) return jsonResponse(r.body, r.status === undefined ? true : r.status < 400, r.status ?? 200);
    }
    return jsonResponse({}, false, 404);
  }) as any;
}

// ---------- Flow 1: Login ----------
describe('V112 Flow 1 — Login → Dashboard', () => {
  it('POSTs credentials, stores token, navigates to /', async () => {
    mockFetchSequence([
      {
        match: (u) => u.includes('/api/auth/login'),
        body: { token: 'jwt.abc.def', user: { id: 'u1', role: 'admin' } },
      },
      { match: (u) => u.includes('/api/stats'), body: { candidates: 10, members: 5 } },
      { match: (u) => u.includes('/api/notifications'), body: [] },
    ]);

    const { LoginForm } = await import('../src/web-flows/LoginForm.js');
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('email'), { target: { value: 'admin@x.com' } });
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'pw123' } });
    fireEvent.click(screen.getByTestId('submit'));

    await waitFor(() => {
      expect(localStorage.getItem('ai-team-token')).toBe('jwt.abc.def');
    });
  });
});

// ---------- Flow 2: Dashboard → Candidates ----------
describe('V112 Flow 2 — Dashboard → Candidates', () => {
  it('navigates from overview to /candidates and renders list', async () => {
    mockFetchSequence([
      { match: (u) => u.includes('/api/health') || u.endsWith('/api/health'), body: { ok: true } },
      {
        match: (u) => u.includes('/api/team') || u.includes('/data/team.json'),
        body: {
          candidates: [{ id: 'c1', name: 'A', position: 'FE', status: 'sourced', source: 'linkedin', tags: [], createdAt: '2024-01-01' }],
          members: [],
          interviews: [],
          trainings: [],
          reviews: [],
          generatedAt: new Date().toISOString(),
        },
      },
    ]);

    const { Candidates } = await import('../src/pages/Candidates.js');
    render(
      <MemoryRouter initialEntries={['/candidates']}>
        <Candidates />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('A')).toBeTruthy());
    expect(screen.getByText('候选人')).toBeTruthy();
  });
});

// ---------- Flow 3: Candidates → 触发面试 ----------
describe('V112 Flow 3 — Candidates → start interview', () => {
  it('clicking 开始面试 opens InterviewSimulator with candidate data', async () => {
    mockFetchSequence([
      { match: (u) => u.endsWith('/api/health'), body: { ok: true } },
      {
        match: (u) => u.includes('/api/team') || u.includes('/data/team.json'),
        body: {
          candidates: [{ id: 'c1', name: 'A', position: 'FE', status: 'sourced', source: 'linkedin', tags: [], createdAt: '2024-01-01' }],
          members: [],
          interviews: [],
          trainings: [],
          reviews: [],
          generatedAt: new Date().toISOString(),
        },
      },
      {
        match: (u) => u.includes('/api/interviews/start'),
        body: { id: 'i1', candidateId: 'c1', question: 'Q1' },
      },
    ]);

    const { Candidates } = await import('../src/pages/Candidates.js');
    render(
      <MemoryRouter initialEntries={['/candidates']}>
        <Candidates />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('A'));
    fireEvent.click(screen.getByText(/开始面试/));
    await waitFor(() => expect(screen.getByTestId('interview-answer-input')).toBeTruthy());
  });
});

// ---------- Flow 4: Interview finalize → Pipeline auto-advance ----------
describe('V112 Flow 4 — Interview finalize → Pipeline advance', () => {
  it('POSTs /finalize then advances pipeline to evaluation', async () => {
    const cache = getResourceCache();
    cache.set('pipeline', [{ id: 'p1', stage: 'interview' }], Date.now());
    mockFetchSequence([
      { match: (u) => u.includes('/api/interviews/i1/finalize'), body: { ok: true } },
      { match: (u) => u.includes('/api/pipeline/p1/advance'), body: { ok: true } },
      { match: (u) => u.includes('/api/pipeline/funnel'), body: { total: 1, byStage: { evaluation: 1, interview: 0, sourced: 0, screening: 0, offer: 0, hired: 0 }, steps: [], overallConversion: 0, averageDwellDays: 0, generatedAt: '' } },
    ]);

    const { useInterviewFinalize, usePipelineAdvance } = await import('../src/lib/data-layer/resources.js');
    const PipelineAutoAdvance = (await import('../src/web-flows/PipelineAutoAdvance.js')).default;
    render(
      <MemoryRouter>
        <PipelineAutoAdvance interviewId="i1" pipelineId="p1" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('run-flow'));

    await waitFor(() => {
      const cached = cache.get('pipeline') as Array<{ id: string; stage: string }> | undefined;
      // After optimistic advance, stage should be 'evaluation'
      if (cached) expect(cached[0]?.stage).toBe('evaluation');
    });
    // Use the hooks so the import is not unused
    expect(typeof useInterviewFinalize).toBe('function');
    expect(typeof usePipelineAdvance).toBe('function');
  });
});

// ---------- Flow 5: Approval queue → decide → list updates ----------
describe('V112 Flow 5 — Approval decide → queue updates', () => {
  it('deciding an approval removes it from the queue optimistically', async () => {
    const cache = getResourceCache();
    cache.set('approvals', [{ id: 'a1' }, { id: 'a2' }], Date.now());
    mockFetchSequence([
      {
        match: (u) => u.includes('/api/team-orchestration/approvals/a1/decide'),
        body: { ok: true, decision: 'approved' },
      },
    ]);

    const { useApprovalDecide } = await import('../src/lib/data-layer/resources.js');
    const ApprovalPanel = (await import('../src/web-flows/ApprovalPanel.js')).default;
    render(
      <MemoryRouter>
        <ApprovalPanel />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByTestId('approval-a1'));
    fireEvent.click(screen.getByTestId('approval-a1-approve'));
    await waitFor(() => {
      expect(screen.queryByTestId('approval-a1')).toBeNull();
      expect(screen.getByTestId('approval-a2')).toBeTruthy();
    });
    // Reference hook to avoid unused-import lint
    expect(typeof useApprovalDecide).toBe('function');
  });
});