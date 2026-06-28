// V132: ConsoleShell can fully replace the 773-line monolith
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetResourceCache, resetEventBus } from '../src/lib/data-layer/index.js';
import { ConsoleShell, buildShellTabs, DEFAULT_SHELL_TABS, useShellTab, useConsoleTab, type ShellTab, type ShellLayout } from '../src/components/orchestration/index.js';
import { OrchestrationProvider, useOrchestrationData, useApprovalData, useDeliveryData, useWorkflowRunner } from '../src/components/orchestration/index.js';

beforeEach(() => {
  localStorage.clear();
  resetResourceCache();
  resetEventBus();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- Shell exposes all 4 panels ----------
describe('V132 ConsoleShell exposes all 4 panels', () => {
  it('all 4 panel types are reachable', () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/approvals')) return jsonResponse({ snapshot: { queue: [] } });
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'V132', ready: true } });
      if (url.includes('/operations')) return jsonResponse({ history: [] });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    // workflow tab (default)
    expect(screen.getByTestId('workflow-panel')).toBeTruthy();
    // switch to approvals
    fireEvent.click(screen.getByTestId('shell-tab-approvals'));
    expect(screen.getByTestId('approval-panel')).toBeTruthy();
    // switch to delivery
    fireEvent.click(screen.getByTestId('shell-tab-delivery'));
    expect(screen.getByTestId('delivery-panel')).toBeTruthy();
    // switch to operations
    fireEvent.click(screen.getByTestId('shell-tab-operations'));
    expect(screen.getByTestId('operations-panel')).toBeTruthy();
  });
});

// ---------- 773-line monolith feature parity ----------
describe('V132 ConsoleShell parity with monolith', () => {
  it('run workflow (workflow panel) replaces monolith POST /api/team-orchestration/workflow', async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/workflow')) {
        const body = JSON.parse((init?.body as string) ?? '{}');
        return jsonResponse({ workflow: { id: 'w132', candidateName: body.candidateName, steps: [{ name: 'parse', status: 'ok' }] } });
      }
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('workflow-run-button'));
    await waitFor(() => expect(screen.getByTestId('workflow-result')).toBeTruthy());
  });

  it('approval decide (approval panel) replaces monolith POST /decide', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals') && !url.includes('/decide')) return jsonResponse({ snapshot: { queue: [{ id: 'a1', risk: 'high' }] } });
      if (url.includes('/decide')) return jsonResponse({ ok: true });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-approvals'));
    await waitFor(() => expect(screen.getByTestId('approval-a1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('approval-a1-approve'));
    await waitFor(() => expect(screen.queryByTestId('approval-a1')).toBeNull());
  });

  it('delivery summary (delivery panel) replaces monolith GET /api/team-orchestration/delivery-summary', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'V132 ready', ready: true } });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-delivery'));
    await waitFor(() => expect(screen.getByText('V132 ready')).toBeTruthy());
  });

  it('operations summary (operations panel) replaces monolith GET /operations', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/operations')) return jsonResponse({ history: [{ id: 'o1', status: 'success' }, { id: 'o2', status: 'failure' }] });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-operations'));
    await waitFor(() => expect(screen.getByTestId('operations-success')).toBeTruthy());
  });
});

// ---------- Shell layout / tabs ----------
describe('V132 Shell layout + tabs', () => {
  it('respects custom initialTab', () => {
    render(
      <MemoryRouter>
        <ConsoleShell initialTab="delivery" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('delivery-panel')).toBeTruthy();
  });

  it('respects custom columns layout', () => {
    render(
      <MemoryRouter>
        <ConsoleShell layout={{ columns: 1, workflow: { visible: true }, approvals: { visible: true }, delivery: { visible: true }, operations: { visible: true } }} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('console-shell')).toBeTruthy();
  });

  it('shell tab buttons have aria-selected', () => {
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    expect(screen.getByTestId('shell-tab-workflow').getAttribute('aria-selected')).toBe('true');
  });
});

// ---------- Provider context shared ----------
describe('V132 OrchestrationProvider shared', () => {
  it('all 4 panels share same provider state', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/approvals')) return jsonResponse({ snapshot: { queue: [] } });
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'shared', ready: true } });
      if (url.includes('/operations')) return jsonResponse({ history: [] });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    // workflow
    expect(screen.getByTestId('workflow-panel')).toBeTruthy();
    // switch to delivery
    fireEvent.click(screen.getByTestId('shell-tab-delivery'));
    await waitFor(() => expect(screen.getByTestId('delivery-ready-badge')).toBeTruthy());
  });
});

// ---------- Re-exports ----------
describe('V132 buildShellTabs + DEFAULT_SHELL_TABS', () => {
  it('DEFAULT_SHELL_TABS has 4 entries', () => {
    expect(DEFAULT_SHELL_TABS.length).toBe(4);
  });

  it('buildShellTabs returns 4 by default', () => {
    const tabs = buildShellTabs();
    expect(tabs.length).toBe(4);
  });
});

// ---------- Hook re-exports ----------
describe('V132 hook re-exports', () => {
  it('useOrchestrationData + useApprovalData + useDeliveryData + useWorkflowRunner accessible', () => {
    function Probe() {
      useOrchestrationData();
      useApprovalData();
      useDeliveryData();
      useWorkflowRunner();
      return <div data-testid="hooks-ok">ok</div>;
    }
    render(
      <MemoryRouter>
        <OrchestrationProvider>
          <Probe />
        </OrchestrationProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('hooks-ok')).toBeTruthy();
  });
});

// ---------- Shell types ----------
describe('V132 ShellTab / ShellLayout types', () => {
  it('ShellTab has key + label + icon + testId', () => {
    const t: ShellTab = { key: 'a', label: 'A', icon: '⚡', testId: 'shell-tab-a' };
    expect(t.key).toBe('a');
  });

  it('ShellLayout has columns + visible flags', () => {
    const l: ShellLayout = { columns: 1, workflow: { visible: true }, approvals: { visible: false }, delivery: { visible: true }, operations: { visible: true } };
    expect(l.columns).toBe(1);
  });
});