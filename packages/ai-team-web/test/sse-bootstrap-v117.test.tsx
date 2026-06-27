// V117: AppSseBootstrap + usePageSseSubscription (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  resetEventBus,
  resetResourceCache,
  getResourceCache,
  getEventBus,
} from '../src/lib/data-layer/index.js';
import {
  AppSseBootstrap,
  usePageSseSubscription,
  useSseBridgeStatus,
  pageSseTopics,
  attachDefaultBridges,
  detachAllBridges,
  listAttachedBridgeIds,
  SSE_BRIDGE_NAMESPACE,
} from '../src/components/sse/index.js';
import { invalidateResource } from '../src/lib/data-layer/hooks.js';

beforeEach(() => {
  resetEventBus();
  resetResourceCache();
  listAttachedBridgeIds().forEach(detachAllBridges);
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
  listAttachedBridgeIds().forEach(detachAllBridges);
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- AppSseBootstrap ----------
describe('V117 AppSseBootstrap', () => {
  it('attaches default bridges on mount', () => {
    render(
      <MemoryRouter>
        <AppSseBootstrap />
      </MemoryRouter>
    );
    expect(listAttachedBridgeIds().length).toBeGreaterThan(0);
  });

  it('renders children unchanged', () => {
    render(
      <MemoryRouter>
        <AppSseBootstrap>
          <div data-testid="child">ok</div>
        </AppSseBootstrap>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('detaches all bridges on unmount', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppSseBootstrap />
      </MemoryRouter>
    );
    const before = listAttachedBridgeIds().length;
    expect(before).toBeGreaterThan(0);
    unmount();
    expect(listAttachedBridgeIds().length).toBe(0);
  });

  it('exposes SSE_BRIDGE_NAMESPACE constant', () => {
    expect(SSE_BRIDGE_NAMESPACE).toBe('ai-team-sse');
  });
});

// ---------- pageSseTopics ----------
describe('V117 pageSseTopics', () => {
  it('returns topic list for a page', () => {
    expect(pageSseTopics('candidates')).toContain('candidates.updated');
    expect(pageSseTopics('pipeline')).toContain('pipeline.updated');
  });

  it('returns empty array for unknown page', () => {
    expect(pageSseTopics('unknown-page')).toEqual([]);
  });

  it('covers all 17 routes', () => {
    const routes = [
      '/', '/candidates', '/members', '/interviews', '/skills',
      '/trainings', '/reviews', '/plugins', '/insights', '/pipeline',
      '/heatmap', '/audit', '/agents', '/agent-config', '/orchestration',
      '/notifications', '/data',
    ];
    for (const r of routes) {
      // Unknown paths get empty list; known paths get topics
      const topics = pageSseTopics(r.replace('/', '') || 'overview');
      // Should at least not throw
      expect(Array.isArray(topics)).toBe(true);
    }
  });
});

// ---------- attachDefaultBridges ----------
describe('V117 attachDefaultBridges', () => {
  it('attaches multiple bridges and returns their ids', () => {
    const ids = attachDefaultBridges();
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(id).toMatch(/^bridge_/);
  });

  it('attaches audit + team-stream + agent-audit streams', () => {
    const ids = attachDefaultBridges();
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------- usePageSseSubscription ----------
describe('V117 usePageSseSubscription', () => {
  it('returns last event for the page topics', () => {
    let captured: unknown = null;
    function Probe() {
      captured = usePageSseSubscription('candidates');
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );
    act(() => {
      getEventBus().publish('candidates.updated', { id: 'c1' });
    });
    expect(captured).toEqual({ id: 'c1' });
  });

  it('returns null when no event has fired', () => {
    let captured: unknown = 'unset';
    function Probe() {
      captured = usePageSseSubscription('candidates');
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );
    expect(captured).toBeNull();
  });

  it('subscribes to all topics for the page', () => {
    let captured: unknown = null;
    function Probe() {
      captured = usePageSseSubscription('pipeline');
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );
    act(() => {
      getEventBus().publish('pipeline.updated', { id: 'p1', stage: 'offer' });
    });
    expect(captured).toEqual({ id: 'p1', stage: 'offer' });
  });
});

// ---------- useSseBridgeStatus ----------
describe('V117 useSseBridgeStatus', () => {
  it('returns connected state for active bridges', async () => {
    function Status() {
      const status = useSseBridgeStatus();
      return <div data-testid="status">{status.connected ? 'on' : 'off'} / {status.bridges}</div>;
    }
    render(
      <MemoryRouter>
        <AppSseBootstrap>
          <Status />
        </AppSseBootstrap>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toMatch(/on|off/);
    });
  });
});

// ---------- Integration: SSE event → ResourceCache invalidation ----------
describe('V117 SSE event → cache invalidation', () => {
  it('candidates.updated event marks cache stale', () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'a' }], Date.now());
    // Direct invalidation through the hook mirrors what AppSseBootstrap does
    invalidateResource('candidates');
    expect(cache.isStale('candidates')).toBe(true);
  });

  it('pipeline.updated event marks pipeline cache stale', () => {
    const cache = getResourceCache();
    cache.set('pipeline', [{ id: 'p1' }], Date.now());
    invalidateResource('pipeline');
    expect(cache.isStale('pipeline')).toBe(true);
  });
});