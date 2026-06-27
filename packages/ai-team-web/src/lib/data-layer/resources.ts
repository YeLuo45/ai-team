// V111: Per-resource hooks + 4 mutation hooks
// Provides typed hooks for each entity + optimistic mutations

import { useCallback } from 'react';
import { getEventBus, getResourceCache, useResource, useResourceMutation } from './hooks.js';

// ---------- fetch helpers ----------
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function tryApiElseStatic<T>(apiUrl: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(apiUrl);
  } catch {
    return fallback;
  }
}

// ---------- Read hooks (15) ----------
export function useCandidates() {
  return useResource<Array<Record<string, unknown>>>(
    'candidates',
    () => tryApiElseStatic('/api/candidates', []),
    { staleTime: 30_000 }
  );
}

export function useMembers() {
  return useResource<Array<Record<string, unknown>>>(
    'members',
    () => tryApiElseStatic('/api/members', []),
    { staleTime: 30_000 }
  );
}

export function useInterviews() {
  return useResource<Array<Record<string, unknown>>>(
    'interviews',
    () => tryApiElseStatic('/api/interviews', []),
    { staleTime: 15_000 }
  );
}

export function useTrainings() {
  return useResource<Array<Record<string, unknown>>>(
    'trainings',
    () => tryApiElseStatic('/api/trainings', []),
    { staleTime: 30_000 }
  );
}

export function useReviews() {
  return useResource<Array<Record<string, unknown>>>(
    'reviews',
    () => tryApiElseStatic('/api/reviews', []),
    { staleTime: 30_000 }
  );
}

export function useNotifications() {
  return useResource<Array<Record<string, unknown>>>(
    'notifications',
    () => tryApiElseStatic('/api/notifications', []),
    { staleTime: 10_000 }
  );
}

export function useInsights() {
  return useResource<Record<string, unknown>>(
    'insights',
    () => tryApiElseStatic('/api/insights', {}),
    { staleTime: 60_000 }
  );
}

export function useAudit() {
  return useResource<Record<string, unknown>>(
    'audit',
    () => tryApiElseStatic('/api/agent-audit', { calls: [] }),
    { staleTime: 30_000 }
  );
}

export function useApprovalQueue() {
  return useResource<Array<Record<string, unknown>>>(
    'approvals',
    () => tryApiElseStatic('/api/team-orchestration/approvals', []),
    { staleTime: 10_000 }
  );
}

export function usePipeline() {
  return useResource<Record<string, unknown>>(
    'pipeline',
    () => fetchJson<Record<string, unknown>>('/api/pipeline/funnel'),
    { staleTime: 15_000 }
  );
}

export function useHeatmap() {
  return useResource<Record<string, unknown>>(
    'heatmap',
    () => fetchJson<Record<string, unknown>>('/api/insights/capability-heatmap'),
    { staleTime: 60_000 }
  );
}

export function useAgentAudit() {
  return useResource<Record<string, unknown>>(
    'agent-audit',
    () => tryApiElseStatic('/api/agent-audit/stats', {}),
    { staleTime: 30_000 }
  );
}

export function usePlugins() {
  return useResource<Array<Record<string, unknown>>>(
    'plugins',
    () => tryApiElseStatic('/api/plugins', []),
    { staleTime: 60_000 }
  );
}

export function useOrchestration() {
  return useResource<Array<Record<string, unknown>>>(
    'orchestration',
    () => tryApiElseStatic('/api/team-orchestration/scenarios', []),
    { staleTime: 60_000 }
  );
}

export function useTeamStats() {
  return useResource<Record<string, unknown>>(
    'team-stats',
    () => tryApiElseStatic('/api/stats', {}),
    { staleTime: 10_000 }
  );
}

// ---------- Mutation hooks (4) ----------
export function usePipelineAdvance() {
  const cache = getResourceCache();
  const bus = getEventBus();
  const { mutate, loading } = useResourceMutation<{ id: string; stage: string }, Array<Record<string, unknown>>>({
    resourceKey: 'pipeline',
    optimistic: (input) => (prev) =>
      prev ? prev.map((p) => (p.id === input.id ? { ...p, stage: input.stage } : p)) : prev,
    mutate: ({ id, stage }) => fetchJson(`/api/pipeline/${encodeURIComponent(id)}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    }),
  });

  const advance = useCallback(async (id: string, stage: string) => {
    try {
      const out = await mutate({ id, stage });
      bus.publish('pipeline.advanced', { id, stage });
      // Refresh local cache after success
      const fresh = await tryApiElseStatic<Array<Record<string, unknown>>>('/api/pipeline/funnel', []);
      const items = (fresh as unknown as { byStage?: unknown; steps?: unknown });
      const arr = Array.isArray(fresh) ? fresh : [];
      cache.set('pipeline', arr.length ? arr : (cache.get('pipeline') ?? []), Date.now());
      void items;
      return out;
    } catch (err) {
      throw err;
    }
  }, [bus, cache, mutate]);

  return { advance, loading };
}

export function useApprovalDecide() {
  const cache = getResourceCache();
  const bus = getEventBus();
  const { mutate, loading } = useResourceMutation<{ id: string; decision: string }, Array<Record<string, unknown>>>({
    resourceKey: 'approvals',
    optimistic: (input) => (prev) =>
      prev ? prev.filter((a: { id: string }) => a.id !== input.id) : prev,
    mutate: ({ id, decision }) => fetchJson(`/api/team-orchestration/approvals/${encodeURIComponent(id)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    }),
  });

  const decide = useCallback(async (id: string, decision: string) => {
    const out = await mutate({ id, decision });
    bus.publish('approvals.decided', { id, decision });
    return out;
  }, [bus, mutate]);

  return { decide, loading, _cache: cache };
}

export function useInterviewFinalize() {
  const cache = getResourceCache();
  const bus = getEventBus();
  const { mutate, loading } = useResourceMutation<{ id: string }, Array<Record<string, unknown>>>({
    resourceKey: 'interviews',
    optimistic: (input) => (prev) =>
      prev ? prev.map((i: { id: string }) => (i.id === input.id ? { ...i, status: 'finalized' } : i)) : prev,
    mutate: ({ id }) => fetchJson(`/api/interviews/${encodeURIComponent(id)}/finalize`, {
      method: 'POST',
    }),
  });

  const finalize = useCallback(async (id: string) => {
    const out = await mutate({ id });
    bus.publish('interviews.finalized', { id });
    return out;
  }, [bus, mutate]);

  return { finalize, loading, _cache: cache };
}

export function useCandidateDelete() {
  const cache = getResourceCache();
  const bus = getEventBus();
  const { mutate, loading } = useResourceMutation<{ id: string }, Array<Record<string, unknown>>>({
    resourceKey: 'candidates',
    optimistic: (input) => (prev) =>
      prev ? prev.filter((c: { id: string }) => c.id !== input.id) : prev,
    mutate: ({ id }) => fetchJson(`/api/candidates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  });

  const del = useCallback(async (id: string) => {
    const out = await mutate({ id });
    bus.publish('candidates.deleted', { id });
    return out;
  }, [bus, mutate]);

  return { del, loading, _cache: cache };
}