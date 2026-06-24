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
      if (method === 'POST' && url.endsWith('/api/team-orchestration/release-operations')) {
        return jsonResponse({ record: { id: 'release_ops_operator-1_2026-06-24T11:00:00Z', userId: 'operator-1', updatedAt: '2026-06-24T11:00:00Z', ready: true, snapshot: body?.snapshot } }, true, 201);
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/ci-artifact-upload-bridge')) {
        return jsonResponse({ bridge: { ready: true, uploadTarget: body?.uploadTarget, evidencePath: body?.outputPath, issues: [], commands: ['node scripts/import-ci-artifact.mjs --version V100', 'gh release upload v100 docs/delivery/ai-team-v100-release-evidence.json --clobber'] } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/audit-replay-smoke')) {
        return jsonResponse({ gate: { ready: true, replayedStatuses: ['accepted', 'deployed', 'delivered'], issues: [], markdown: '# Proposal Audit Replay Smoke Gate' } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/release-operations/history')) {
        return jsonResponse({ history: { storageKey: 'ai-team:release-operations-history:v1', latestVersion: 'V101', readyCount: 2, blockedCount: 0, entries: body?.entries ?? [], serialized: '{}' } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/ci-artifact-provenance')) {
        return jsonResponse({ provenance: { ready: true, subject: 'release-check.json@aaaaaaaaaaaa', attestation: body, issues: [], markdown: '# CI Artifact Provenance' } });
      }
      if (method === 'POST' && url.endsWith('/api/team-orchestration/audit-replay-diff')) {
        return jsonResponse({ diff: { proposalId: body?.proposalId, changed: true, added: ['deployed', 'delivered'], removed: [], steps: [], markdown: '# Proposal Replay Visual Diff' } });
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
    await waitFor(() => screen.getByText(/Report and cockpit saved locally/));
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

  it('shows release readiness, imports evidence JSON, and classifies commit-ready diff lines', async () => {
    render(<TeamOrchestrationConsole />);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-release-dashboard')); });
    expect(screen.getByText(/Release readiness/)).toBeTruthy();
    expect(screen.getByText(/Build: ready/)).toBeTruthy();

    fireEvent.change(screen.getByTestId('release-evidence-json'), {
      target: { value: '{"version":"V72","summary":{"ready":true,"headline":"V72 ready","testPassRatePct":100,"coverageStatus":"pass","readmeStatus":"pass","buildStatus":"pass","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}' },
    });
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-import-evidence')); });
    expect(screen.getByText(/Imported V72 schema v1 migrated/)).toBeTruthy();

    fireEvent.change(screen.getByTestId('diff-lines-input'), {
      target: { value: 'M packages/ai-team-core/src/delivery-summary.ts\n?? packages/ai-team-core/test/delivery-summary-v72.test.ts\nM docs/delivery/index.md' },
    });
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-classify-diff')); });
    expect(screen.getByText(/source 1 · tests 1 · docs 1/)).toBeTruthy();
    expect(screen.getByText(/Safe add:/)).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-delivery-checklist')); });
    expect(screen.getByText(/Delivery checklist: ready/)).toBeTruthy();
    expect(screen.getByText(/delivered: done/)).toBeTruthy();
  });

  it('restores a persisted delivery cockpit snapshot from the main console', async () => {
    render(<TeamOrchestrationConsole />);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-restore-cockpit')); });

    expect(screen.getByText(/Restore V96 cockpit/)).toBeTruthy();
    expect(screen.getByText(/coverage · ready · V96/)).toBeTruthy();
  });

  it('persists release operations and filters the proposal audit timeline', async () => {
    render(<TeamOrchestrationConsole />);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-operations-panel')); });
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-audit-ledger')); });
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-persist-operations')); });
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-filter-audit')); });

    expect(screen.getByText(/Persisted release ops: operator-1/)).toBeTruthy();
    expect(screen.getByText(/audit · 2026-06-24T08:00:00Z/)).toBeTruthy();
    expect(screen.getByText(/Audit timeline: 1/)).toBeTruthy();
    expect(window.localStorage.getItem('ai-team:release-operations:v1')).toContain('operator-1');
  });

  it('syncs release operations API, upload bridge, replay smoke, and V101-V103 actions', async () => {
    render(<TeamOrchestrationConsole />);

    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-sync-release-ops')); });
    await waitFor(() => screen.getByText(/Release ops API: operator-1/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-upload-bridge')); });
    await waitFor(() => screen.getByText(/Upload bridge: release-asset/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-replay-smoke')); });
    await waitFor(() => screen.getByText(/Replay smoke: ready/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-ops-history')); });
    await waitFor(() => screen.getByText(/Ops history: V101/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-provenance')); });
    await waitFor(() => screen.getByText(/Artifact provenance: signed/));
    await act(async () => { fireEvent.click(screen.getByTestId('team-orchestration-replay-diff')); });
    await waitFor(() => screen.getByText(/Replay diff: changed/));

    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/release-operations'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/ci-artifact-upload-bridge'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/audit-replay-smoke'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/release-operations/history'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/ci-artifact-provenance'))).toBe(true);
    expect(fetchCalls.some((call) => call.url.endsWith('/api/team-orchestration/audit-replay-diff'))).toBe(true);
  });
});
