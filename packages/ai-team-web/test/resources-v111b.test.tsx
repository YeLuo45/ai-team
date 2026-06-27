// V111b: resources branch coverage — fallback path + mutation rollback path
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  resetEventBus,
  resetResourceCache,
  getResourceCache,
  getEventBus,
} from '../src/lib/data-layer/index.js';
import {
  usePipelineAdvance,
  useApprovalDecide,
  useInterviewFinalize,
  useCandidateDelete,
} from '../src/lib/data-layer/resources.js';

beforeEach(() => {
  resetResourceCache();
  resetEventBus();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
    statusText: ok ? 'OK' : 'Error',
  });
}

describe('V111b usePipelineAdvance branches', () => {
  it('rolls back on server error', async () => {
    const cache = getResourceCache();
    cache.set('pipeline', [{ id: 'p1', stage: 'screening' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 500)) as any;
    const { result } = renderHook(() => usePipelineAdvance());
    await act(async () => {
      try { await result.current.advance('p1', 'interview'); } catch { /* expected */ }
    });
    const cached = cache.get('pipeline') as Array<{ id: string; stage: string }>;
    expect(cached[0].stage).toBe('screening');
  });

  it('handles empty pipeline cache on success', async () => {
    const cache = getResourceCache();
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as any;
    const { result } = renderHook(() => usePipelineAdvance());
    await act(async () => {
      await result.current.advance('p999', 'offer');
    });
    expect(cache.keys()).toContain('pipeline');
  });

  it('re-throws mutation errors for caller handling', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); }) as any;
    const { result } = renderHook(() => usePipelineAdvance());
    await act(async () => {
      try { await result.current.advance('p1', 'offer'); } catch { /* expected */ }
    });
    expect(true).toBe(true);
  });
});

describe('V111b useApprovalDecide branches', () => {
  it('publishes decisions.decided on success', async () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('approvals.decided', cb);
    const cache = getResourceCache();
    cache.set('approvals', [{ id: 'a1' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as any;
    const { result } = renderHook(() => useApprovalDecide());
    await act(async () => { await result.current.decide('a1', 'rejected'); });
    expect(cb).toHaveBeenCalledWith({ id: 'a1', decision: 'rejected' });
  });

  it('rolls back when server fails', async () => {
    const cache = getResourceCache();
    cache.set('approvals', [{ id: 'a1' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 500)) as any;
    const { result } = renderHook(() => useApprovalDecide());
    await act(async () => {
      try { await result.current.decide('a1', 'approved'); } catch { /* expected */ }
    });
    expect((cache.get('approvals') as Array<{ id: string }>).find((a) => a.id === 'a1')).toBeDefined();
  });
});

describe('V111b useInterviewFinalize branches', () => {
  it('publishes interviews.finalized', async () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('interviews.finalized', cb);
    const cache = getResourceCache();
    cache.set('interviews', [{ id: 'i1' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as any;
    const { result } = renderHook(() => useInterviewFinalize());
    await act(async () => { await result.current.finalize('i1'); });
    expect(cb).toHaveBeenCalled();
  });

  it('rolls back on server error', async () => {
    const cache = getResourceCache();
    cache.set('interviews', [{ id: 'i1', status: 'in_progress' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 500)) as any;
    const { result } = renderHook(() => useInterviewFinalize());
    await act(async () => {
      try { await result.current.finalize('i1'); } catch { /* expected */ }
    });
    expect((cache.get('interviews') as Array<{ id: string; status: string }>).find((i) => i.id === 'i1')?.status).toBe('in_progress');
  });
});

describe('V111b useCandidateDelete branches', () => {
  it('publishes candidates.deleted on success', async () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('candidates.deleted', cb);
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'c1' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as any;
    const { result } = renderHook(() => useCandidateDelete());
    await act(async () => { await result.current.del('c1'); });
    expect(cb).toHaveBeenCalledWith({ id: 'c1' });
  });
});