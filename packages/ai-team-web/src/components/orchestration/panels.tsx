// V123: Orchestration panel components + selectors — extracted from 773-line monolith

import { useEffect, useState } from 'react';
import { Card, Badge, Button, Stat } from '../design-system/index.js';
import {
  useApprovalData,
  useDeliveryData,
  useOrchestrationData,
  useWorkflowRunner,
} from './hooks.js';

// ---------- Pure selectors ----------
export function selectWorkflowStep(workflow: { steps?: Array<{ name: string; status: string; message?: string }> } | null): { name: string; status: string; message?: string } | null {
  if (!workflow?.steps) return null;
  const errorStep = workflow.steps.find((s) => s.status === 'error');
  if (errorStep) return errorStep;
  return workflow.steps[0] ?? null;
}

export type ApprovalRisk = 'low' | 'normal' | 'high' | 'critical';

export function selectApprovalRisk(item: { risk?: string } | null): ApprovalRisk {
  if (!item) return 'normal';
  const r = (item.risk ?? 'normal').toLowerCase();
  if (r === 'critical' || r === 'high' || r === 'low') return r;
  return 'normal';
}

export interface DeliveryReady {
  ready: boolean;
  reason: string;
}

export function computeDeliveryReady(summary: { ready?: boolean; blockers?: string[] } | null): DeliveryReady {
  if (!summary) return { ready: false, reason: 'no-data' };
  if (summary.ready) return { ready: true, reason: 'ok' };
  const blockers = summary.blockers ?? [];
  if (blockers.length === 0) return { ready: false, reason: 'not-ready' };
  return { ready: false, reason: `blockers:${blockers.join(',')}` };
}

export interface OperationsSummary {
  total: number;
  success: number;
  failure: number;
  pending: number;
}

export function summarizeOperations(items: Array<{ id: string; status: string }>): OperationsSummary {
  const out: OperationsSummary = { total: items.length, success: 0, failure: 0, pending: 0 };
  for (const i of items) {
    if (i.status === 'success') out.success++;
    else if (i.status === 'failure') out.failure++;
    else if (i.status === 'pending') out.pending++;
  }
  return out;
}

// ---------- Panel tabs ----------
export interface PanelTab {
  key: string;
  label: string;
  icon: string;
}

export const DEFAULT_PANEL_TABS: PanelTab[] = [
  { key: 'workflow', label: '工作流', icon: '🔄' },
  { key: 'approvals', label: '审批', icon: '⚖️' },
  { key: 'delivery', label: '交付', icon: '🚚' },
  { key: 'operations', label: '运维', icon: '🛰️' },
];

export function buildPanelTabs(overrides?: PanelTab[]): PanelTab[] {
  if (overrides && overrides.length > 0) return [...overrides];
  return DEFAULT_PANEL_TABS.map((t) => ({ ...t }));
}

// ---------- Panel state hooks ----------
const DEFAULT_CANDIDATE_NAME = 'Ada Chen';

export function useWorkflowPanelState() {
  const workflow = useWorkflowRunner();
  const [candidateName, setCandidateName] = useState(DEFAULT_CANDIDATE_NAME);
  const run = async () => workflow.run(candidateName);
  return { ...workflow, candidateName, setCandidateName, run };
}

export function useApprovalPanelState() {
  return useApprovalData();
}

export function useDeliveryPanelState() {
  return useDeliveryData();
}

export function useOperationsPanelState() {
  const orchestration = useOrchestrationData();
  const [history, setHistory] = useState<Array<{ id: string; status: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/team-orchestration/operations');
        if (!res.ok) return;
        const data = (await res.json()) as { history?: Array<{ id: string; status: string }> };
        if (!cancelled) setHistory(data.history ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = summarizeOperations(history);
  void orchestration; // exposed for callers that want scenario data
  return { history, summary };
}

// ---------- WorkflowPanel ----------
export function WorkflowPanel() {
  const state = useWorkflowPanelState();
  const step = selectWorkflowStep(state.result as unknown as { steps?: Array<{ name: string; status: string; message?: string }> } | null);

  return (
    <Card
      testId="workflow-panel"
      title="工作流执行"
      subtitle={`候选：${state.candidateName}`}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            data-testid="workflow-candidate-input"
            value={state.candidateName}
            onChange={(e) => state.setCandidateName(e.target.value)}
            className="flex-1 rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <Button
            size="sm"
            testId="workflow-run-button"
            onClick={() => void state.run()}
            disabled={state.loading}
          >
            {state.loading ? '执行中…' : '▶ 运行'}
          </Button>
        </div>

        {state.error && (
          <div className="text-sm text-rose-600" data-testid="workflow-error">
            {state.error}
          </div>
        )}

        {state.result && (
          <div data-testid="workflow-result" className="rounded border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-sm">
              <strong>{state.result.candidateName ?? state.candidateName}</strong> · workflow {state.result.id}
            </div>
            {step && (
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={step.status === 'error' ? 'danger' : 'success'}>
                  {step.name}
                </Badge>
                <span className="text-xs text-slate-500">{step.status}</span>
                {step.message && <span className="text-xs text-rose-500">{step.message}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- ApprovalPanel ----------
export function ApprovalPanel() {
  const state = useApprovalPanelState();

  return (
    <Card testId="approval-panel" title="人工审批" subtitle={`待决 ${state.queue.length} 项`}>
      {state.loading && state.queue.length === 0 ? (
        <div className="text-sm text-slate-500">加载中…</div>
      ) : state.queue.length === 0 ? (
        <div className="text-sm text-slate-500">暂无待审批</div>
      ) : (
        <div className="space-y-2">
          {state.queue.map((item) => {
            const id = String(item.id);
            const risk = selectApprovalRisk(item);
            return (
              <div
                key={id}
                data-testid={`approval-${id}`}
                className="flex items-center justify-between rounded border border-slate-200 p-2 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    tone={risk === 'critical' ? 'danger' : risk === 'high' ? 'warning' : 'neutral'}
                  >
                    {risk}
                  </Badge>
                  <span className="text-sm">{id}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  testId={`approval-${id}-approve`}
                  onClick={() => void state.decide(id, 'approved')}
                >
                  通过
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------- DeliveryPanel ----------
export function DeliveryPanel() {
  const state = useDeliveryPanelState();
  const summary = state.summary as { ready?: boolean; blockers?: string[]; headline?: string } | null;
  const ready = computeDeliveryReady(summary);

  return (
    <Card testId="delivery-panel" title="交付状态" subtitle={summary?.headline ?? ''}>
      {summary && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {ready.ready ? (
              <Badge tone="success">
                <span data-testid="delivery-ready-badge">就绪</span>
              </Badge>
            ) : (
              <Badge tone="danger">
                <span data-testid="delivery-ready-badge">未就绪</span>
              </Badge>
            )}
            <span className="text-xs text-slate-500">{ready.reason}</span>
          </div>

          {!ready.ready && summary.blockers && (
            <div data-testid="delivery-blockers" className="space-y-1">
              {summary.blockers.map((b: string) => (
                <div key={b} className="text-xs text-rose-500">· {b}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- OperationsPanel ----------
export function OperationsPanel() {
  const state = useOperationsPanelState();

  return (
    <Card testId="operations-panel" title="运维历史" subtitle={`总计 ${state.summary.total} 条`}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="成功" value={state.summary.success} />
        <Stat label="失败" value={state.summary.failure} />
        <Stat label="待定" value={state.summary.pending} />
        <div data-testid="operations-total" className="hidden">{state.summary.total}</div>
        <div data-testid="operations-success" className="hidden">{state.summary.success}</div>
        <div data-testid="operations-failure" className="hidden">{state.summary.failure}</div>
        <div data-testid="operations-pending" className="hidden">{state.summary.pending}</div>
      </div>
    </Card>
  );
}