// V42-V44: Team Orchestration Console tests
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import TeamOrchestrationConsole from '../src/pages/TeamOrchestrationConsole.js';

const originalFetch = globalThis.fetch;

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
    statusText: ok ? 'OK' : 'Error',
  });
}

describe('V42 TeamOrchestrationConsole page', () => {
  let fetchCalls: Array<{ url: string; method: string; body?: unknown }>;

  beforeEach(() => {
    fetchCalls = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, method, body });
      if (method === 'POST' && url.endsWith('/api/team-orchestration/workflow')) {
        return jsonResponse({ workflow: { candidateName: 'Ada Chen', recommendation: { decision: 'hire', confidence: 82 }, reviewGate: { required: false, queue: [] }, steps: [{ agent: 'resume', status: 'completed' }] } });
      }
      if (method === 'GET' && url.endsWith('/api/team-orchestration/approvals')) {
        return jsonResponse({ snapshot: { pending: [{ id: 'ap-1', agent: 'legal', priority: 'high', reason: 'needs review' }], byStatus: { pending: 1, approved: 0, rejected: 0, edited: 0 }, byPriority: { high: 1, critical: 0 } } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/llmops/alerts')) {
        return jsonResponse({ alerts: [{ kind: 'cost', severity: 'warning', message: 'LLM cost exceeded policy' }] });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/simulate/batch')) {
        return jsonResponse({ batch: { winners: ['c1'], droppedIds: [], results: [{ id: 'c1', name: 'Ada', recommendation: 'hire_to_close_gap', rankingScore: 92 }] } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/org-memory/Growth/context')) {
        return jsonResponse({ context: { team: 'Growth', summary: 'Growth context built from 2 memory signals', citations: ['org:Growth:feedback:1'] } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/org-memory/Growth')) {
        return jsonResponse({ entry: { team: 'Growth', roleProfile: body?.roleProfile, feedback: body?.feedback, preferences: body?.preferences } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/delivery-summary')) {
        return jsonResponse({ summary: { ready: true, headline: 'V54 ready — tests 100%, coverage 98.6%, README 11/11', blockers: [] } });
      }
      return jsonResponse({}, false, 404);
    }) as any;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('runs workflow, loads approvals and checks llmops alerts', async () => {
    render(<TeamOrchestrationConsole />);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-run')); });
    await waitFor(() => screen.getByText(/Ada Chen/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-load-approvals')); });
    await waitFor(() => screen.getByText(/needs review/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-check-alerts')); });
    await waitFor(() => screen.getByText(/LLM cost exceeded policy/));

    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/workflow'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/approvals'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/llmops/alerts'))).toBe(true);
  });

  it('surfaces scenario batch, org memory context, and delivery summary actions for web parity', async () => {
    render(<TeamOrchestrationConsole />);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-run-batch')); });
    await waitFor(() => screen.getByText(/Batch winners: c1/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-load-memory')); });
    await waitFor(() => screen.getByText(/Growth context built from 2 memory signals/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-delivery-summary')); });
    await waitFor(() => screen.getByText(/V54 ready/));

    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/simulate/batch'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/org-memory/Growth/context'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/delivery-summary'))).toBe(true);
  });

  it('lets web users edit workflow params, persist org memory, and save delivery reports', async () => {
    render(<TeamOrchestrationConsole />);

    fireEvent.change(screen.getByTestId('workflow-candidate-name'), { target: { value: 'Grace Hopper' } });
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-run')); });
    await waitFor(() => screen.getByText(/Ada Chen/));
    expect((fetchCalls.find((call) => call.url.endsWith('/api/team-orchestration/workflow'))?.body as { candidateName?: string } | undefined)?.candidateName).toBe('Grace Hopper');

    fireEvent.change(screen.getByTestId('org-memory-feedback'), { target: { value: 'retention matters\nasync updates' } });
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-save-memory')); });
    await waitFor(() => screen.getByText(/Org memory saved/));
    const memoryCall = fetchCalls.find((call) => call.url.endsWith('/api/team-orchestration/org-memory/Growth'));
    expect(memoryCall?.body?.feedback).toEqual(['retention matters', 'async updates']);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-save-report')); });
    await waitFor(() => screen.getByText(/Report saved locally/));
  });

  it('applies orchestration presets and downloads release evidence for the web console', async () => {
    const createObjectURL = vi.fn(() => 'blob:release-evidence');
    const revokeObjectURL = vi.fn();
    const originalUrl = globalThis.URL;
    Object.defineProperty(globalThis, 'URL', { value: { ...originalUrl, createObjectURL, revokeObjectURL }, configurable: true });
    render(<TeamOrchestrationConsole />);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-preset-security')); });
    expect(screen.getByTestId('workflow-candidate-name')).toHaveProperty('value', 'Security Reviewer');
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-run')); });
    expect((fetchCalls.find((call) => call.url.endsWith('/api/team-orchestration/workflow'))?.body as { candidateName?: string } | undefined)?.candidateName).toBe('Security Reviewer');

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-download-evidence')); });
    await waitFor(() => screen.getByText(/Release evidence downloaded/));
    expect(createObjectURL).toHaveBeenCalled();
    Object.defineProperty(globalThis, 'URL', { value: originalUrl, configurable: true });
  });
});
