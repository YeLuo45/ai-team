// V133: TeamOrchestrationConsole is now a 1-line ConsoleShell wrapper
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetResourceCache, resetEventBus } from '../src/lib/data-layer/index.js';
import TeamOrchestrationConsole from '../src/pages/TeamOrchestrationConsole.js';

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

// ---------- Page is thin wrapper around ConsoleShell ----------
describe('V133 TeamOrchestrationConsole delegates to ConsoleShell', () => {
  it('renders console shell root', () => {
    render(
      <MemoryRouter>
        <TeamOrchestrationConsole />
      </MemoryRouter>
    );
    expect(screen.getByTestId('console-shell')).toBeTruthy();
  });

  it('exposes 4 tab buttons', () => {
    render(
      <MemoryRouter>
        <TeamOrchestrationConsole />
      </MemoryRouter>
    );
    expect(screen.getByTestId('shell-tab-workflow')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-approvals')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-delivery')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-operations')).toBeTruthy();
  });

  it('shows workflow panel by default', () => {
    render(
      <MemoryRouter>
        <TeamOrchestrationConsole />
      </MemoryRouter>
    );
    expect(screen.getByTestId('workflow-panel')).toBeTruthy();
  });

  it('switches to approval / delivery / operations panels', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals')) return jsonResponse({ snapshot: { queue: [] } });
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'V133 ready', ready: true } });
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/operations')) return jsonResponse({ history: [] });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <TeamOrchestrationConsole />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-approvals'));
    await waitFor(() => expect(screen.getByTestId('approval-panel')).toBeTruthy());
    fireEvent.click(screen.getByTestId('shell-tab-delivery'));
    await waitFor(() => expect(screen.getByTestId('delivery-panel')).toBeTruthy());
    fireEvent.click(screen.getByTestId('shell-tab-operations'));
    await waitFor(() => expect(screen.getByTestId('operations-panel')).toBeTruthy());
  });

  it('run workflow via workflow panel', async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/workflow')) {
        const body = JSON.parse((init?.body as string) ?? '{}');
        return jsonResponse({ workflow: { id: 'w133', candidateName: body.candidateName, steps: [{ name: 'parse', status: 'ok' }] } });
      }
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <TeamOrchestrationConsole />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('workflow-run-button'));
    await waitFor(() => expect(screen.getByTestId('workflow-result')).toBeTruthy());
  });

  it('approval decide optimistic update', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals') && !url.includes('/decide')) return jsonResponse({ snapshot: { queue: [{ id: 'a1', risk: 'high' }] } });
      if (url.includes('/decide')) return jsonResponse({ ok: true });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <TeamOrchestrationConsole />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-approvals'));
    await waitFor(() => expect(screen.getByTestId('approval-a1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('approval-a1-approve'));
    await waitFor(() => expect(screen.queryByTestId('approval-a1')).toBeNull());
  });
});

// ---------- Page is 1-line wrapper (file-size sanity) ----------
describe('V133 thin wrapper contract', () => {
  it('page file is under 20 lines', async () => {
    const fs = await import('node:fs');
    const text = fs.readFileSync('packages/ai-team-web/src/pages/TeamOrchestrationConsole.tsx', 'utf-8');
    const lines = text.split('\n').length;
    expect(lines).toBeLessThan(20);
  });
});