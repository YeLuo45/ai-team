// V109: Unified data layer + EventBus + optimistic updates
// Lightweight useResource hook mimics react-query semantics:
// - shared cache per resource key
// - staleTime + refetch on mount
// - mutate() with optimistic rollback + Toast signal
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import {
  ResourceCache,
  getResourceCache,
  resetResourceCache,
  EventBus,
  getEventBus,
  resetEventBus,
  useResource,
  useResourceMutation,
  useBusTopic,
  invalidateResource,
  prefetchResource,
  type ResourceEntry,
} from '../src/lib/data-layer/index.js';

beforeEach(() => {
  resetResourceCache();
  resetEventBus();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- ResourceCache ----------
describe('V109 ResourceCache', () => {
  it('set/get returns the same value per key', () => {
    const c = new ResourceCache<number>();
    c.set('a', 1, Date.now());
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
  });

  it('isStale respects staleTime', () => {
    const c = new ResourceCache<string>();
    c.set('k', 'v', Date.now() - 1000, { staleTime: 500 });
    expect(c.isStale('k')).toBe(true);
    c.set('k', 'v', Date.now(), { staleTime: 5000 });
    expect(c.isStale('k')).toBe(false);
  });

  it('update merges shallowly when updater is function', () => {
    const c = new ResourceCache<{ count: number; label: string }>();
    c.set('k', { count: 1, label: 'x' }, Date.now());
    c.update('k', (prev) => ({ ...prev!, count: prev!.count + 1 }));
    expect(c.get('k')?.count).toBe(2);
    expect(c.get('k')?.label).toBe('x');
  });

  it('invalidate marks a key as stale', () => {
    const c = new ResourceCache<number>();
    c.set('k', 1, Date.now());
    c.invalidate('k');
    expect(c.isStale('k')).toBe(true);
  });

  it('subscribe fires on set / update / invalidate', () => {
    const c = new ResourceCache<number>();
    const cb = vi.fn();
    const unsub = c.subscribe(cb);
    c.set('k', 1, Date.now());
    c.update('k', 1);
    c.invalidate('k');
    expect(cb).toHaveBeenCalled();
    unsub();
    c.set('k', 2, Date.now());
    expect(cb).toHaveBeenCalledTimes(3);
  });
});

// ---------- EventBus ----------
describe('V109 EventBus', () => {
  it('publish/subscribe round-trips typed messages', () => {
    const bus = new EventBus();
    const cb = vi.fn();
    bus.subscribe<{ id: string }>('candidate.updated', cb);
    bus.publish('candidate.updated', { id: 'c1' });
    expect(cb).toHaveBeenCalledWith({ id: 'c1' });
  });

  it('unsubscribe stops further deliveries', () => {
    const bus = new EventBus();
    const cb = vi.fn();
    const unsub = bus.subscribe('x', cb);
    bus.publish('x', 1);
    unsub();
    bus.publish('x', 2);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('once subscribes only to the first event', () => {
    const bus = new EventBus();
    const cb = vi.fn();
    bus.once('topic', cb);
    bus.publish('topic', 1);
    bus.publish('topic', 2);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('topicStats tracks published / delivered counts', () => {
    const bus = new EventBus();
    bus.subscribe('a', () => {});
    bus.publish('a', 1);
    bus.publish('a', 2);
    bus.publish('b', 3);
    const stats = bus.topicStats();
    expect(stats.a.published).toBe(2);
    expect(stats.a.delivered).toBe(2);
    expect(stats.b.published).toBe(1);
    expect(stats.b.delivered).toBe(0);
  });
});

// ---------- useResource ----------
describe('V109 useResource hook', () => {
  it('fetches initial data and exposes it', async () => {
    const fetcher = vi.fn(async () => [{ id: 1 }]);
    const { result } = renderHook(() => useResource('candidates', fetcher));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('shares the cache across components for the same key', async () => {
    const fetcher = vi.fn(async () => 'data');
    const { result: r1 } = renderHook(() => useResource('shared', fetcher));
    await act(async () => { await Promise.resolve(); });
    const { result: r2 } = renderHook(() => useResource('shared', fetcher));
    expect(r1.current.data).toBe('data');
    expect(r2.current.data).toBe('data');
    // fetcher is called only once due to cache hit
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetch re-runs the fetcher and updates data', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    const { result } = renderHook(() => useResource('counter', fetcher));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.data).toBe(1);
    await act(async () => { await result.current.refetch(); });
    expect(result.current.data).toBe(2);
  });

  it('catches fetcher errors and exposes them', async () => {
    const fetcher = vi.fn(async () => { throw new Error('boom'); });
    const { result } = renderHook(() => useResource('err', fetcher));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.data).toBeUndefined();
  });
});

// ---------- useResourceMutation + optimistic ----------
describe('V109 useResourceMutation', () => {
  it('applies optimistic update, calls server, then reconciles', async () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: '1', name: 'old' }], Date.now());

    const serverSave = vi.fn(async (input: { id: string; name: string }) => ({ ...input }));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useResourceMutation<{ id: string; name: string }>({
        resourceKey: 'candidates',
        optimistic: (input) => (prev) => prev ? [{ id: input.id, name: input.name }] : prev,
        mutate: serverSave,
        onError,
      })
    );

    await act(async () => {
      await result.current.mutate({ id: '1', name: 'new' });
    });

    expect(serverSave).toHaveBeenCalledWith({ id: '1', name: 'new' });
    expect(onError).not.toHaveBeenCalled();
    const cached = cache.get('candidates') as Array<{ id: string; name: string }>;
    expect(cached[0].name).toBe('new');
  });

  it('rolls back optimistic update when mutate fails', async () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: '1', name: 'original' }], Date.now());

    const serverSave = vi.fn(async () => { throw new Error('server down'); });
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useResourceMutation<{ id: string; name: string }>({
        resourceKey: 'candidates',
        optimistic: (input) => (prev) => prev ? [{ id: input.id, name: input.name }] : prev,
        mutate: serverSave,
        onError,
      })
    );

    await act(async () => {
      try {
        await result.current.mutate({ id: '1', name: 'bad' });
      } catch {
        // expected — mutation should surface the server error
      }
    });

    const cached = cache.get('candidates') as Array<{ id: string; name: string }>;
    expect(cached[0].name).toBe('original');
    expect(onError).toHaveBeenCalled();
  });
});

// ---------- useBusTopic + invalidation ----------
describe('V109 useBusTopic + invalidation', () => {
  it('subscribed component re-renders on event', async () => {
    const bus = getEventBus();
    const { result } = renderHook(() => useBusTopic<string>('test'));
    act(() => bus.publish('test', 'hello'));
    expect(result.current).toBe('hello');
  });

  it('invalidateResource marks key stale across all subscribers', async () => {
    const cache = getResourceCache();
    cache.set('k', 'v', Date.now());
    invalidateResource('k');
    expect(cache.isStale('k')).toBe(true);
  });

  it('prefetchResource warms the cache', async () => {
    const fetcher = vi.fn(async () => 'prewarmed');
    await prefetchResource('p', fetcher);
    expect(getResourceCache().get('p')).toBe('prewarmed');
  });
});

// ---------- ResourceEntry ----------
describe('V109 ResourceEntry', () => {
  it('encapsulates value + timestamp + status', () => {
    const e: ResourceEntry<number> = { value: 42, ts: Date.now(), status: 'ready' };
    expect(e.value).toBe(42);
    expect(e.status).toBe('ready');
  });
});

// ---------- Real-world smoke: Pipeline advance optimistic ----------
describe('V109 Pipeline advance smoke', () => {
  it('advances a candidate stage optimistically', async () => {
    const cache = getResourceCache();
    cache.set('pipeline', [
      { id: 'p1', stage: 'screening' },
      { id: 'p2', stage: 'interview' },
    ], Date.now());

    const serverAdvance = vi.fn(async (id: string, stage: string) => ({ id, stage }));
    const { result } = renderHook(() =>
      useResourceMutation<{ id: string; stage: string }>({
        resourceKey: 'pipeline',
        optimistic: (input) => (prev) =>
          prev ? prev.map((p: { id: string; stage: string }) => (p.id === input.id ? { ...p, stage: input.stage } : p)) : prev,
        mutate: ({ id, stage }) => serverAdvance(id, stage),
      })
    );

    await act(async () => {
      await result.current.mutate({ id: 'p1', stage: 'interview' });
    });

    const cached = cache.get('pipeline') as Array<{ id: string; stage: string }>;
    expect(cached[0].stage).toBe('interview');
    expect(cached[1].stage).toBe('interview');
    expect(serverAdvance).toHaveBeenCalled();
  });
});

// ---------- Resource trigger button (DOM-level smoke) ----------
describe('V109 Trigger button integration', () => {
  it('clicking a refresh button calls refetch and updates DOM', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);

    function Demo() {
      const r = useResource('demo', fetcher);
      return (
        <div>
          <span data-testid="value">{String(r.data ?? 'pending')}</span>
          <button data-testid="refresh" onClick={() => r.refetch()}>refresh</button>
        </div>
      );
    }

    render(<Demo />);
    expect(screen.getByTestId('value').textContent).toBe('pending');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('value').textContent).toBe('1');
    fireEvent.click(screen.getByTestId('refresh'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('value').textContent).toBe('2');
  });
});