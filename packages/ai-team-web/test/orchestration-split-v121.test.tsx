// V121: Orchestration split — useOrchestrationData + 4 panel components (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  useOrchestrationData,
  useApprovalData,
  useDeliveryData,
  useWorkflowRunner,
  OrchestrationProvider,
  useOrchestration,
  type OrchestrationApi,
} from '../src/components/orchestration/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- useOrchestrationData ----------
describe('V121 useOrchestrationData', () => {
  it('fetches scenarios on mount', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([{ id: 's1', label: 'Growth' }]);
      return jsonResponse({}, false, 404);
    }) as any;
    function Probe() {
      const { scenarios, loading } = useOrchestrationData();
      return (
        <div>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="scenarios">{scenarios.length}</span>
        </div>
      );
    }
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('scenarios').textContent).toBe('1');
  });

  it('exposes workflow + approval + delivery sub-fetchers', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/workflow')) return jsonResponse({ workflow: { id: 'w1' } });
      if (url.includes('/approvals')) return jsonResponse({ snapshot: { queue: [] } });
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'OK' } });
      return jsonResponse({}, false, 404);
    }) as any;
    let api: OrchestrationApi | null = null;
    function Probe() {
      api = useOrchestrationData();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api).not.toBeNull());
    expect(typeof api!.runWorkflow).toBe('function');
    expect(typeof api!.loadApprovals).toBe('function');
    expect(typeof api!.loadDelivery).toBe('function');
  });

  it('handles fetch error gracefully', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 500)) as any;
    function Probe() {
      const { error } = useOrchestrationData();
      return <span data-testid="error">{error ?? ''}</span>;
    }
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('error').textContent.length).toBeGreaterThan(0));
  });
});

// ---------- useApprovalData ----------
describe('V121 useApprovalData', () => {
  it('fetches approvals snapshot', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals')) return jsonResponse({ snapshot: { queue: [{ id: 'a1', risk: 'high' }] } });
      return jsonResponse({}, false, 404);
    }) as any;
    function Probe() {
      const { queue, loading } = useApprovalData();
      return <div><span data-testid="loading">{String(loading)}</span><span data-testid="queue">{queue.length}</span></div>;
    }
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('queue').textContent).toBe('1');
  });

  it('decide() POSTs and reloads', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/approvals') && !url.includes('/decide')) return jsonResponse({ snapshot: { queue: [{ id: 'a1' }] } });
      if (url.includes('/decide')) return jsonResponse({ ok: true });
      return jsonResponse({}, false, 404);
    }) as any;
    let api: ReturnType<typeof useApprovalData> | null = null;
    function Probe() {
      api = useApprovalData();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api).not.toBeNull());
    await act(async () => {
      await api!.decide('a1', 'approved');
    });
    expect(calls.some((c) => c.includes('decide'))).toBe(true);
  });
});

// ---------- useDeliveryData ----------
describe('V121 useDeliveryData', () => {
  it('fetches delivery summary', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'Ready', ready: true } });
      return jsonResponse({}, false, 404);
    }) as any;
    function Probe() {
      const { summary, loading } = useDeliveryData();
      return <div><span data-testid="loading">{String(loading)}</span><span data-testid="headline">{summary?.headline ?? ''}</span></div>;
    }
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('headline').textContent).toBe('Ready');
  });
});

// ---------- useWorkflowRunner ----------
describe('V121 useWorkflowRunner', () => {
  it('runs workflow with candidate name', async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/workflow')) {
        const body = JSON.parse((init?.body as string) ?? '{}');
        return jsonResponse({ workflow: { id: 'w1', candidateName: body.candidateName } });
      }
      return jsonResponse({}, false, 404);
    }) as any;
    let api: ReturnType<typeof useWorkflowRunner> | null = null;
    function Probe() {
      api = useWorkflowRunner();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api).not.toBeNull());
    let result: { id: string; candidateName: string } | null = null;
    await act(async () => {
      result = await api!.run('Ada Chen');
    });
    expect(result?.candidateName).toBe('Ada Chen');
  });

  it('exposes loading + result state', async () => {
    let api: ReturnType<typeof useWorkflowRunner> | null = null;
    function Probe() {
      api = useWorkflowRunner();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api).not.toBeNull());
    expect(typeof api!.loading).toBe('boolean');
    expect(api!.result).toBeNull();
  });
});

// ---------- OrchestrationProvider ----------
describe('V121 OrchestrationProvider', () => {
  it('provides shared context to children', () => {
    function Probe() {
      const ctx = useOrchestration();
      return (
        <div>
          <span data-testid="has-provider">{String(ctx != null)}</span>
        </div>
      );
    }
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <Probe />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('has-provider').textContent).toBe('true');
  });

  it('returns null when used outside provider', () => {
    function Probe() {
      const ctx = useOrchestration();
      return <span data-testid="ctx">{String(ctx)}</span>;
    }
    render(<Probe />);
    expect(screen.getByTestId('ctx').textContent).toBe('null');
  });
});