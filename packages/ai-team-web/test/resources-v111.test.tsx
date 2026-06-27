// V111: Per-resource hooks + 4 mutation hooks (RED tests)
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
  useCandidates,
  useMembers,
  useInterviews,
  useTrainings,
  useReviews,
  useNotifications,
  useInsights,
  useAudit,
  useApprovalQueue,
  usePipeline,
  useHeatmap,
  useAgentAudit,
  usePlugins,
  useOrchestration,
  useTeamStats,
  usePipelineAdvance,
  useApprovalDecide,
  useInterviewFinalize,
  useCandidateDelete,
} from '../src/lib/data-layer/resources.js';

beforeEach(() => {
  resetResourceCache();
  resetEventBus();
  globalThis.fetch = vi.fn();
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

// ---------- useCandidates ----------
describe('V111 useCandidates', () => {
  it('fetches from /api/candidates', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 'c1', name: 'A' }])) as any;
    const { result } = renderHook(() => useCandidates());
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ id: 'c1', name: 'A' }]);
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: Array<unknown[]> } };
    const firstUrl = (fetchMock.mock.calls[0] as unknown[])[0];
    expect(firstUrl).toBe('/api/candidates');
  });

  it('uses fallback /data/candidates.json when api fails', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 503)) as any;
    const { result } = renderHook(() => useCandidates());
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});

// ---------- useMembers ----------
describe('V111 useMembers', () => {
  it('fetches /api/members', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 'm1', name: 'M' }])) as any;
    const { result } = renderHook(() => useMembers());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'm1', name: 'M' }]));
  });
});

// ---------- useInterviews ----------
describe('V111 useInterviews', () => {
  it('fetches /api/interviews', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 'i1' }])) as any;
    const { result } = renderHook(() => useInterviews());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'i1' }]));
  });
});

// ---------- useTrainings ----------
describe('V111 useTrainings', () => {
  it('fetches /api/trainings', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 't1' }])) as any;
    const { result } = renderHook(() => useTrainings());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 't1' }]));
  });
});

// ---------- useReviews ----------
describe('V111 useReviews', () => {
  it('fetches /api/reviews', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 'r1' }])) as any;
    const { result } = renderHook(() => useReviews());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'r1' }]));
  });
});

// ---------- useNotifications ----------
describe('V111 useNotifications', () => {
  it('fetches /api/notifications', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 'n1', read: false }])) as any;
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'n1', read: false }]));
  });
});

// ---------- useInsights ----------
describe('V111 useInsights', () => {
  it('fetches /api/insights', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ growth: [], gaps: [] })) as any;
    const { result } = renderHook(() => useInsights());
    await waitFor(() => expect(result.current.data).toEqual({ growth: [], gaps: [] }));
  });
});

// ---------- useAudit ----------
describe('V111 useAudit', () => {
  it('fetches /api/agent-audit', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ calls: [] })) as any;
    const { result } = renderHook(() => useAudit());
    await waitFor(() => expect(result.current.data).toEqual({ calls: [] }));
  });
});

// ---------- useApprovalQueue ----------
describe('V111 useApprovalQueue', () => {
  it('fetches /api/team-orchestration/approvals', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 'a1' }])) as any;
    const { result } = renderHook(() => useApprovalQueue());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'a1' }]));
  });
});

// ---------- usePipeline ----------
describe('V111 usePipeline', () => {
  it('fetches /api/pipeline/funnel', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ total: 5, byStage: {}, steps: [], overallConversion: 0, averageDwellDays: 0, generatedAt: '' })) as any;
    const { result } = renderHook(() => usePipeline());
    await waitFor(() => expect(result.current.data?.total).toBe(5));
  });
});

// ---------- useHeatmap ----------
describe('V111 useHeatmap', () => {
  it('fetches /api/insights/capability-heatmap', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ rows: [], cols: [], cells: [], overallAverage: 0, criticalGaps: 0, generatedAt: '' })) as any;
    const { result } = renderHook(() => useHeatmap());
    await waitFor(() => expect(result.current.data?.criticalGaps).toBe(0));
  });
});

// ---------- useAgentAudit ----------
describe('V111 useAgentAudit', () => {
  it('fetches /api/agent-audit/stats', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ total: 10, failures: 1 })) as any;
    const { result } = renderHook(() => useAgentAudit());
    await waitFor(() => expect(result.current.data).toEqual({ total: 10, failures: 1 }));
  });
});

// ---------- usePlugins ----------
describe('V111 usePlugins', () => {
  it('fetches /api/plugins', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 'p1' }])) as any;
    const { result } = renderHook(() => usePlugins());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'p1' }]));
  });
});

// ---------- useOrchestration ----------
describe('V111 useOrchestration', () => {
  it('fetches /api/team-orchestration/scenarios', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse([{ id: 's1' }])) as any;
    const { result } = renderHook(() => useOrchestration());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 's1' }]));
  });
});

// ---------- useTeamStats ----------
describe('V111 useTeamStats', () => {
  it('fetches /api/stats', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ candidates: 10, members: 5 })) as any;
    const { result } = renderHook(() => useTeamStats());
    await waitFor(() => expect(result.current.data).toEqual({ candidates: 10, members: 5 }));
  });
});

// ---------- usePipelineAdvance (optimistic) ----------
describe('V111 usePipelineAdvance', () => {
  it('POSTs to /api/pipeline/:id/advance and optimistically updates local stage', async () => {
    const cache = getResourceCache();
    cache.set('pipeline', [{ id: 'p1', stage: 'screening' }], Date.now());
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/advance')) return jsonResponse({ ok: true });
      return jsonResponse([{ id: 'p1', stage: 'interview' }]);
    }) as any;
    const { result } = renderHook(() => usePipelineAdvance());
    await act(async () => {
      await result.current.advance('p1', 'interview');
    });
    const cached = cache.get('pipeline') as Array<{ id: string; stage: string }>;
    expect(cached[0].stage).toBe('interview');
  });
});

// ---------- useApprovalDecide ----------
describe('V111 useApprovalDecide', () => {
  it('POSTs decide and removes from queue optimistically', async () => {
    const cache = getResourceCache();
    cache.set('approvals', [{ id: 'a1' }, { id: 'a2' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true, decision: 'approved' })) as any;
    const { result } = renderHook(() => useApprovalDecide());
    await act(async () => {
      await result.current.decide('a1', 'approved');
    });
    const cached = cache.get('approvals') as Array<{ id: string }>;
    expect(cached.find((a) => a.id === 'a1')).toBeUndefined();
    expect(cached.find((a) => a.id === 'a2')).toBeDefined();
  });
});

// ---------- useInterviewFinalize ----------
describe('V111 useInterviewFinalize', () => {
  it('POSTs finalize and marks interview complete', async () => {
    const cache = getResourceCache();
    cache.set('interviews', [{ id: 'i1', status: 'in_progress' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as any;
    const { result } = renderHook(() => useInterviewFinalize());
    await act(async () => {
      await result.current.finalize('i1');
    });
    const cached = cache.get('interviews') as Array<{ id: string; status: string }>;
    expect(cached[0].status).toBe('finalized');
  });
});

// ---------- useCandidateDelete ----------
describe('V111 useCandidateDelete', () => {
  it('DELETEs and removes from cache optimistically', async () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as any;
    const { result } = renderHook(() => useCandidateDelete());
    await act(async () => {
      await result.current.del('c1');
    });
    const cached = cache.get('candidates') as Array<{ id: string; name: string }>;
    expect(cached.find((c) => c.id === 'c1')).toBeUndefined();
    expect(cached.find((c) => c.id === 'c2')).toBeDefined();
  });

  it('rolls back on server error', async () => {
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'c1' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 500)) as any;
    const { result } = renderHook(() => useCandidateDelete());
    await act(async () => {
      try {
        await result.current.del('c1');
      } catch {
        /* expected */
      }
    });
    const cached = cache.get('candidates') as Array<{ id: string }>;
    expect(cached.find((c) => c.id === 'c1')).toBeDefined();
  });
});

// ---------- Event bus integration ----------
describe('V111 EventBus integration', () => {
  it('mutation publishes a topic on the bus', async () => {
    const bus = getEventBus();
    const cb = vi.fn();
    bus.subscribe('candidates.deleted', cb);
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'c1' }], Date.now());
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })) as any;
    const { result } = renderHook(() => useCandidateDelete());
    await act(async () => {
      await result.current.del('c1');
    });
    expect(cb).toHaveBeenCalled();
  });
});