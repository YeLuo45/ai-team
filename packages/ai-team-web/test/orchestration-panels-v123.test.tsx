// V123: Orchestration panel components + selectors — extracted from 773-line monolith
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetResourceCache, resetEventBus } from '../src/lib/data-layer/index.js';
import {
  WorkflowPanel,
  ApprovalPanel,
  DeliveryPanel,
  OperationsPanel,
  useWorkflowPanelState,
  useApprovalPanelState,
  useDeliveryPanelState,
  useOperationsPanelState,
  selectWorkflowStep,
  selectApprovalRisk,
  computeDeliveryReady,
  summarizeOperations,
  buildPanelTabs,
  DEFAULT_PANEL_TABS,
  type PanelTab,
} from '../src/components/orchestration/panels.js';
import { OrchestrationProvider } from '../src/components/orchestration/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetResourceCache();
  resetEventBus();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- selectWorkflowStep ----------
describe('V123 selectWorkflowStep', () => {
  it('returns step summary or null', () => {
    expect(selectWorkflowStep(null)).toBeNull();
    expect(selectWorkflowStep({ steps: [{ name: 's1', status: 'ok' }] })).toEqual({ name: 's1', status: 'ok' });
  });

  it('picks first error step when present', () => {
    const wf = {
      steps: [
        { name: 's1', status: 'ok' },
        { name: 's2', status: 'error', message: 'boom' },
      ],
    };
    expect(selectWorkflowStep(wf)).toEqual({ name: 's2', status: 'error', message: 'boom' });
  });
});

// ---------- selectApprovalRisk ----------
describe('V123 selectApprovalRisk', () => {
  it('returns risk level or normal', () => {
    expect(selectApprovalRisk(null)).toBe('normal');
    expect(selectApprovalRisk({ risk: 'critical' })).toBe('critical');
    expect(selectApprovalRisk({ risk: 'high' })).toBe('high');
    expect(selectApprovalRisk({ risk: 'low' })).toBe('low');
    expect(selectApprovalRisk({})).toBe('normal');
  });
});

// ---------- computeDeliveryReady ----------
describe('V123 computeDeliveryReady', () => {
  it('returns boolean + reason', () => {
    expect(computeDeliveryReady(null)).toEqual({ ready: false, reason: 'no-data' });
    expect(computeDeliveryReady({ ready: true })).toEqual({ ready: true, reason: 'ok' });
    expect(computeDeliveryReady({ ready: false, blockers: ['coverage'] })).toEqual({
      ready: false,
      reason: 'blockers:coverage',
    });
  });
});

// ---------- summarizeOperations ----------
describe('V123 summarizeOperations', () => {
  it('aggregates ops counts by status', () => {
    const summary = summarizeOperations([
      { id: 'o1', status: 'success' },
      { id: 'o2', status: 'success' },
      { id: 'o3', status: 'failure' },
      { id: 'o4', status: 'pending' },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.success).toBe(2);
    expect(summary.failure).toBe(1);
    expect(summary.pending).toBe(1);
  });

  it('handles empty list', () => {
    expect(summarizeOperations([])).toEqual({ total: 0, success: 0, failure: 0, pending: 0 });
  });
});

// ---------- DEFAULT_PANEL_TABS + buildPanelTabs ----------
describe('V123 panel tabs', () => {
  it('DEFAULT_PANEL_TABS has 4 entries', () => {
    expect(DEFAULT_PANEL_TABS.length).toBe(4);
    const keys = DEFAULT_PANEL_TABS.map((t: PanelTab) => t.key);
    expect(keys).toEqual(['workflow', 'approvals', 'delivery', 'operations']);
  });

  it('every tab has key + label + icon', () => {
    for (const t of DEFAULT_PANEL_TABS) {
      expect(t.key).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.icon).toBeTruthy();
    }
  });

  it('buildPanelTabs returns copy', () => {
    const tabs = buildPanelTabs();
    expect(tabs.length).toBe(4);
    tabs[0]!.label = 'modified';
    expect(DEFAULT_PANEL_TABS[0]!.label).not.toBe('modified');
  });

  it('buildPanelTabs accepts overrides', () => {
    const tabs = buildPanelTabs([{ key: 'custom', label: 'Custom', icon: '⚡' }]);
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.key).toBe('custom');
  });
});

// ---------- useWorkflowPanelState ----------
describe('V123 useWorkflowPanelState', () => {
  it('exposes workflow + candidateName + setCandidateName + run', async () => {
    let api: ReturnType<typeof useWorkflowPanelState> | null = null;
    function Probe() {
      api = useWorkflowPanelState();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api).not.toBeNull());
    expect(api!.candidateName).toBe('Ada Chen');
    act(() => api!.setCandidateName('Bob'));
    expect(api!.candidateName).toBe('Bob');
  });

  it('run() updates state', async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/workflow')) {
        const body = JSON.parse((init?.body as string) ?? '{}');
        return jsonResponse({ workflow: { id: 'w1', candidateName: body.candidateName } });
      }
      return jsonResponse({}, false, 404);
    }) as any;
    let api: ReturnType<typeof useWorkflowPanelState> | null = null;
    function Probe() {
      api = useWorkflowPanelState();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api).not.toBeNull());
    await act(async () => {
      await api!.run();
    });
    expect(api?.result?.candidateName).toBe('Ada Chen');
  });
});

// ---------- useApprovalPanelState ----------
describe('V123 useApprovalPanelState', () => {
  it('exposes queue + decide', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals') && !url.includes('/decide')) {
        return jsonResponse({ snapshot: { queue: [{ id: 'a1', risk: 'high' }] } });
      }
      if (url.includes('/decide')) return jsonResponse({ ok: true });
      return jsonResponse({}, false, 404);
    }) as any;
    let api: ReturnType<typeof useApprovalPanelState> | null = null;
    function Probe() {
      api = useApprovalPanelState();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api?.queue.length).toBe(1));
    expect(api!.queue[0]!.id).toBe('a1');
    await act(async () => {
      await api!.decide('a1', 'approved');
    });
    expect(api!.queue.find((q) => q.id === 'a1')).toBeUndefined();
  });
});

// ---------- useDeliveryPanelState ----------
describe('V123 useDeliveryPanelState', () => {
  it('exposes summary + saveReport', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'OK', ready: true } });
      return jsonResponse({}, false, 404);
    }) as any;
    let api: ReturnType<typeof useDeliveryPanelState> | null = null;
    function Probe() {
      api = useDeliveryPanelState();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api?.summary?.headline).toBe('OK'));
  });
});

// ---------- useOperationsPanelState ----------
describe('V123 useOperationsPanelState', () => {
  it('exposes summary + operations list', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/operations')) return jsonResponse({ history: [{ id: 'o1', status: 'success' }] });
      return jsonResponse({}, false, 404);
    }) as any;
    let api: ReturnType<typeof useOperationsPanelState> | null = null;
    function Probe() {
      api = useOperationsPanelState();
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(api?.summary.total).toBe(1));
  });
});

// ---------- WorkflowPanel component ----------
describe('V123 WorkflowPanel', () => {
  it('renders candidate input + run button', () => {
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <WorkflowPanel />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('workflow-panel')).toBeTruthy();
    expect(screen.getByTestId('workflow-run-button')).toBeTruthy();
  });

  it('shows workflow result after run', async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/workflow')) {
        const body = JSON.parse((init?.body as string) ?? '{}');
        return jsonResponse({ workflow: { id: 'w1', candidateName: body.candidateName, steps: [{ name: 'parse', status: 'ok' }] } });
      }
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <WorkflowPanel />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('workflow-run-button'));
    await waitFor(() => expect(screen.getByTestId('workflow-result')).toBeTruthy());
  });
});

// ---------- ApprovalPanel component ----------
describe('V123 ApprovalPanel', () => {
  it('renders approval queue', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals')) return jsonResponse({ snapshot: { queue: [{ id: 'a1', risk: 'high' }] } });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <ApprovalPanel />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('approval-a1')).toBeTruthy());
  });

  it('decide button triggers decide + reload', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals') && !url.includes('/decide')) return jsonResponse({ snapshot: { queue: [{ id: 'a1', risk: 'high' }] } });
      if (url.includes('/decide')) return jsonResponse({ ok: true });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <ApprovalPanel />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByTestId('approval-a1'));
    fireEvent.click(screen.getByTestId('approval-a1-approve'));
    await waitFor(() => expect(screen.queryByTestId('approval-a1')).toBeNull());
  });
});

// ---------- DeliveryPanel component ----------
describe('V123 DeliveryPanel', () => {
  it('renders summary headline + ready badge', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'V122 ready', ready: true } });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <DeliveryPanel />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('V122 ready')).toBeTruthy());
    expect(screen.getByTestId('delivery-ready-badge')).toBeTruthy();
  });

  it('shows blockers when not ready', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { ready: false, blockers: ['coverage'] } });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <DeliveryPanel />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('delivery-blockers')).toBeTruthy());
  });
});

// ---------- OperationsPanel component ----------
describe('V123 OperationsPanel', () => {
  it('renders summary cards (total/success/failure/pending)', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/operations')) return jsonResponse({ history: [
        { id: 'o1', status: 'success' },
        { id: 'o2', status: 'failure' },
        { id: 'o3', status: 'pending' },
      ] });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <OperationsPanel />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('operations-total')).toBeTruthy();
      expect(screen.getByTestId('operations-success')).toBeTruthy();
    });
  });
});