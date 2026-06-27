// V110b: SSEBridge branch coverage — connect path + factory + null data
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import {
  resetEventBus,
  resetResourceCache,
  getEventBus,
  getResourceCache,
} from '../src/lib/data-layer/index.js';
import {
  createSseBridge,
  attachBridge,
  detachBridge,
  listActiveBridges,
  parseSseEvent,
  buildSseUrl,
  type SseLikeSource,
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

describe('V110b SSEBridge branch coverage', () => {
  it('uses custom sourceFactory when provided', () => {
    const factory = vi.fn(
      (_url: string): SseLikeSource => ({
        addEventListener: () => {},
        close: () => {},
      })
    );
    const bridge = createSseBridge({ url: '/api/x', sourceFactory: factory });
    expect(factory).toHaveBeenCalledWith('/api/x');
    bridge.close();
  });

  it('handles message with empty data (no JSON parse error)', () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('ping', cb);
    const bridge = createSseBridge({ url: '/api/x' });
    act(() => {
      bridge.handleChunk('event: ping\ndata: \n\n');
    });
    expect(cb).toHaveBeenCalledWith(null);
    bridge.close();
  });

  it('keeps non-JSON data as string', () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('raw', cb);
    const bridge = createSseBridge({ url: '/api/x' });
    act(() => {
      bridge.handleChunk('event: raw\ndata: not-json\n\n');
    });
    expect(cb).toHaveBeenCalledWith('not-json');
    bridge.close();
  });

  it('connect() runs in jsdom without throwing', () => {
    const bridge = createSseBridge({ url: '/api/test' });
    expect(bridge).toBeDefined();
    bridge.close();
  });

  it('buffer accumulates across multiple handleChunk calls until \\n\\n', () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('partial', cb);
    const bridge = createSseBridge({ url: '/api/x' });
    act(() => {
      bridge.handleChunk('event: partial\nda');
      bridge.handleChunk('ta: 1\n\n');
    });
    expect(cb).toHaveBeenCalledWith(1);
    bridge.close();
  });

  it('parseSseEvent handles missing colon (skip line)', () => {
    const out = parseSseEvent('garbage-no-colon\n\n');
    expect(out).toEqual([]);
  });

  it('parseSseEvent ignores event without data', () => {
    const out = parseSseEvent('event: lonely\n\n');
    expect(out).toEqual([]);
  });

  it('parseSseEvent handles id field', () => {
    const out = parseSseEvent('id: 42\nevent: ping\ndata: ok\n\n');
    expect(out[0].id).toBe('42');
  });

  it('invalidateResource via well-known topic', () => {
    const cache = getResourceCache();
    cache.set('pipeline', [{ id: 'p1' }], Date.now());
    const bridge = createSseBridge({ url: '/api/x' });
    act(() => {
      bridge.handleChunk('event: pipeline.updated\ndata: {}\n\n');
    });
    expect(cache.isStale('pipeline')).toBe(true);
    bridge.close();
  });

  it('close() is idempotent', () => {
    const bridge = createSseBridge({ url: '/api/x' });
    bridge.close();
    bridge.close();
    expect(listActiveBridges().find((b) => b === bridge)).toBeUndefined();
  });

  it('attachBridge returns registered bridge', () => {
    const b = attachBridge('/api/attach-1');
    expect(b.id).toMatch(/^bridge_/);
    expect(detachBridge(b.id)).toBe(true);
  });

  it('detachBridge returns false for unknown id', () => {
    expect(detachBridge('bridge_does_not_exist')).toBe(false);
  });

  it('simulateDisconnect stops after maxRetries', async () => {
    const reconnect = vi.fn();
    const bridge = createSseBridge({
      url: '/api/x',
      reconnectStrategy: { initialDelay: 1, maxDelay: 5, maxRetries: 2 },
      onReconnect: reconnect,
    });
    await bridge.simulateDisconnect();
    await bridge.simulateDisconnect();
    await bridge.simulateDisconnect(); // should no-op
    expect(reconnect).toHaveBeenCalledTimes(2);
    bridge.close();
  });

  it('simulateDisconnect no-op when already closed', async () => {
    const reconnect = vi.fn();
    const bridge = createSseBridge({ url: '/api/x', onReconnect: reconnect });
    bridge.close();
    await bridge.simulateDisconnect();
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('buildSseUrl handles no slash boundary', () => {
    expect(buildSseUrl('/api', 'stream')).toBe('/api/stream');
  });
});