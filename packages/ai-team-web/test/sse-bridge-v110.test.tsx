// V110: SSE Bridge + per-resource hooks — RED tests
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  getEventBus,
  resetEventBus,
  getResourceCache,
  resetResourceCache,
  invalidateResource,
} from '../src/lib/data-layer/index.js';
import {
  parseSseEvent,
  createSseBridge,
  buildSseUrl,
  SseBridge,
  attachBridge,
  detachBridge,
  listActiveBridges,
  type SseMessage,
} from '../src/lib/data-layer/SSEBridge.js';

beforeEach(() => {
  resetEventBus();
  resetResourceCache();
});

afterEach(() => {
  cleanup();
  listActiveBridges().forEach((b) => b.close());
  vi.restoreAllMocks();
});

// ---------- parseSseEvent ----------
describe('V110 parseSseEvent', () => {
  it('parses a single event block', () => {
    const raw = 'event: candidate.updated\ndata: {"id":"c1"}\n\n';
    const out = parseSseEvent(raw);
    expect(out).toEqual([{ event: 'candidate.updated', data: '{"id":"c1"}' }]);
  });

  it('parses multiple events split by blank lines', () => {
    const raw = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';
    const out = parseSseEvent(raw);
    expect(out.length).toBe(2);
    expect(out[0].event).toBe('a');
    expect(out[1].event).toBe('b');
  });

  it('defaults event to "message" when omitted', () => {
    const raw = 'data: hello\n\n';
    const out = parseSseEvent(raw);
    expect(out[0].event).toBe('message');
    expect(out[0].data).toBe('hello');
  });

  it('skips comment lines starting with :', () => {
    const raw = ': keepalive\nevent: ping\ndata: 1\n\n';
    const out = parseSseEvent(raw);
    expect(out[0].event).toBe('ping');
    expect(out[0].data).toBe('1');
  });

  it('returns empty array for empty input', () => {
    expect(parseSseEvent('')).toEqual([]);
    expect(parseSseEvent('\n\n')).toEqual([]);
  });

  it('handles multi-line data concatenation with newline', () => {
    const raw = 'data: line1\ndata: line2\n\n';
    const out = parseSseEvent(raw);
    expect(out[0].data).toBe('line1\nline2');
  });
});

// ---------- createSseBridge ----------
describe('V110 createSseBridge', () => {
  it('publishes SSE messages to the event bus', () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('candidate.updated', cb);
    const bridge = createSseBridge({ url: '/api/stream' });
    act(() => {
      bridge.handleChunk('event: candidate.updated\ndata: {"id":"c1"}\n\n');
    });
    expect(cb).toHaveBeenCalledWith({ id: 'c1' });
    bridge.close();
  });

  it('triggers resource invalidation for topic that ends with .updated', () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'old' }], Date.now());
    const bridge = createSseBridge({ url: '/api/stream' });
    act(() => {
      bridge.handleChunk('event: candidates.updated\ndata: {}\n\n');
    });
    expect(cache.isStale('candidates')).toBe(true);
    bridge.close();
  });

  it('attaches + detaches bridge lifecycle', () => {
    const b = attachBridge('/api/stream-1');
    expect(listActiveBridges().some((x) => x === b)).toBe(true);
    detachBridge(b.id);
    expect(listActiveBridges().some((x) => x === b)).toBe(false);
  });

  it('close() stops further message delivery', () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('x', cb);
    const bridge = createSseBridge({ url: '/api/x' });
    bridge.close();
    bridge.handleChunk('event: x\ndata: 1\n\n');
    expect(cb).not.toHaveBeenCalled();
  });

  it('auto-reconnects with exponential backoff up to maxRetries', async () => {
    let attempts = 0;
    const reconnect = vi.fn(async () => {
      attempts++;
    });
    const bridge = createSseBridge({
      url: '/api/x',
      reconnectStrategy: { initialDelay: 10, maxDelay: 100, maxRetries: 3 },
      onReconnect: reconnect,
    });
    await bridge.simulateDisconnect();
    await bridge.simulateDisconnect();
    await bridge.simulateDisconnect();
    expect(reconnect).toHaveBeenCalledTimes(3);
    bridge.close();
  });
});

// ---------- buildSseUrl ----------
describe('V110 buildSseUrl', () => {
  it('appends /stream to a base path', () => {
    expect(buildSseUrl('/api/agent-audit')).toBe('/api/agent-audit/stream');
  });

  it('does not double-slash when path ends with /', () => {
    expect(buildSseUrl('/api/foo/')).toBe('/api/foo/stream');
  });

  it('preserves custom suffix', () => {
    expect(buildSseUrl('/api/x', '/events')).toBe('/api/x/events');
  });
});

// ---------- SseBridge typed dispatch ----------
describe('V110 SseBridge typed dispatch', () => {
  it('routes well-known topics to specific resource keys', () => {
    const cache = getResourceCache();
    cache.set('candidates', [], Date.now());
    cache.set('members', [], Date.now());
    cache.set('pipeline', [], Date.now());

    const bridge = createSseBridge({ url: '/api/stream' });
    act(() => {
      bridge.handleChunk('event: candidates.updated\ndata: 1\n\nevent: members.updated\ndata: 2\n\nevent: pipeline.updated\ndata: 3\n\n');
    });

    expect(cache.isStale('candidates')).toBe(true);
    expect(cache.isStale('members')).toBe(true);
    expect(cache.isStale('pipeline')).toBe(true);
    bridge.close();
  });

  it('dispatches unknown topics without invalidation', () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'x' }], Date.now());
    const bridge = createSseBridge({ url: '/api/stream' });
    act(() => {
      bridge.handleChunk('event: mystery.topic\ndata: 1\n\n');
    });
    expect(cache.isStale('candidates')).toBe(false);
    expect(cache.get('candidates')).toEqual([{ id: 'x' }]);
    bridge.close();
  });
});

// ---------- Integration: bridge + invalidation + useResource ----------
describe('V110 bridge + invalidation integration', () => {
  it('SSE update causes next useResource call to refetch', async () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'old' }], Date.now());
    const bridge = createSseBridge({ url: '/api/stream' });
    act(() => {
      bridge.handleChunk('event: candidates.updated\ndata: {}\n\n');
    });
    expect(cache.isStale('candidates')).toBe(true);
    invalidateResource('candidates');
    expect(cache.isStale('candidates')).toBe(true);
    bridge.close();
  });
});