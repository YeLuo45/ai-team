// V121: Orchestration data hooks — extracted from TeamOrchestrationConsole 773-line monolith

import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface OrchestrationApi {
  scenarios: Array<{ id: string; label?: string; [k: string]: unknown }>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  runWorkflow: (candidateName: string) => Promise<{ workflow: Record<string, unknown> }>;
  loadApprovals: () => Promise<{ snapshot: { queue: Array<Record<string, unknown>> } }>;
  loadDelivery: () => Promise<{ summary: Record<string, unknown> }>;
}

const OrchestrationContext = createContext<OrchestrationContextValue | null>(null);

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------- useOrchestrationData ----------
export function useOrchestrationData(): OrchestrationApi {
  const [scenarios, setScenarios] = useState<OrchestrationApi['scenarios']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ scenarios?: OrchestrationApi['scenarios'] } | OrchestrationApi['scenarios']>(
        '/api/team-orchestration/scenarios'
      );
      const list = Array.isArray(data) ? data : data.scenarios ?? [];
      setScenarios(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runWorkflow = useCallback(async (candidateName: string) => {
    return fetchJson<{ workflow: Record<string, unknown> }>('/api/team-orchestration/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateName }),
    });
  }, []);

  const loadApprovals = useCallback(async () => {
    return fetchJson<{ snapshot: { queue: Array<Record<string, unknown>> } }>(
      '/api/team-orchestration/approvals'
    );
  }, []);

  const loadDelivery = useCallback(async () => {
    return fetchJson<{ summary: Record<string, unknown> }>(
      '/api/team-orchestration/delivery-summary'
    );
  }, []);

  return { scenarios, loading, error, refresh, runWorkflow, loadApprovals, loadDelivery };
}

// ---------- useApprovalData ----------
export interface ApprovalData {
  queue: Array<{ id: string; risk?: string; decision?: string; [k: string]: unknown }>;
  snapshot: { queue: ApprovalData['queue'] } | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  decide: (id: string, decision: string) => Promise<{ ok: boolean }>;
}

export function useApprovalData(): ApprovalData {
  const [snapshot, setSnapshot] = useState<{ queue: ApprovalData['queue'] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ snapshot: ApprovalData['snapshot'] }>(
        '/api/team-orchestration/approvals'
      );
      setSnapshot(data.snapshot ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = useCallback(async (id: string, decision: string) => {
    // Optimistic update: remove from queue immediately
    const previous = snapshot;
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        queue: prev.queue.filter((q: { id: string }) => String(q.id) !== id),
      };
    });
    try {
      return await fetchJson<{ ok: boolean }>(
        `/api/team-orchestration/approvals/${encodeURIComponent(id)}/decide`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        }
      );
    } catch (err) {
      // Rollback on failure
      setSnapshot(previous ?? null);
      throw err;
    }
  }, [snapshot]);

  return {
    queue: snapshot?.queue ?? [],
    snapshot,
    loading,
    error,
    refresh,
    decide,
  };
}

// ---------- useDeliveryData ----------
export interface DeliveryData {
  summary: { headline?: string; ready?: boolean; [k: string]: unknown } | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDeliveryData(): DeliveryData {
  const [summary, setSummary] = useState<DeliveryData['summary']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ summary: DeliveryData['summary'] }>(
        '/api/team-orchestration/delivery-summary'
      );
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, error, refresh };
}

// ---------- useWorkflowRunner ----------
export interface WorkflowResult {
  id: string;
  candidateName?: string;
  steps?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

export interface WorkflowRunner {
  result: WorkflowResult | null;
  loading: boolean;
  error: string | null;
  run: (candidateName: string) => Promise<WorkflowResult>;
}

export function useWorkflowRunner(): WorkflowRunner {
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (candidateName: string): Promise<WorkflowResult> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ workflow: WorkflowResult }>(
        '/api/team-orchestration/workflow',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateName }),
        }
      );
      setResult(data.workflow);
      return data.workflow;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'workflow failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, run };
}

// ---------- OrchestrationProvider ----------
export interface OrchestrationContextValue {
  orchestration: OrchestrationApi;
  approval: ApprovalData;
  delivery: DeliveryData;
  workflow: WorkflowRunner;
}

let _contextValue: OrchestrationContextValue | null = null;
// silence unused-var by exposing it for diagnostics
export function _peekContextValue(): OrchestrationContextValue | null {
  return _contextValue;
}

export function OrchestrationProvider({ children }: { children: ReactNode }) {
  const orchestration = useOrchestrationData();
  const approval = useApprovalData();
  const delivery = useDeliveryData();
  const workflow = useWorkflowRunner();
  const value: OrchestrationContextValue = { orchestration, approval, delivery, workflow };
  return (
    <OrchestrationContext.Provider value={value}>
      {children}
    </OrchestrationContext.Provider>
  );
}

export function useOrchestration(): OrchestrationContextValue | null {
  return useContext(OrchestrationContext);
}