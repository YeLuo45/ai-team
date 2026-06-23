import { describe, expect, it } from 'vitest';
import {
  applyApprovalDecision,
  buildApprovalQueueSnapshot,
  buildLlmOpsAlerts,
  type ApprovalRecord,
  type LlmOpsAlertPolicy,
} from '../src/team-orchestration.js';

function approval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: 'ap-1',
    workflowId: 'wf-1',
    candidateId: 'ct-1',
    agent: 'legal',
    priority: 'high',
    reason: 'legal reported high risk',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('approval persistence V42', () => {
  it('approves a pending approval record with reviewer metadata', () => {
    const result = applyApprovalDecision(approval(), {
      decision: 'approved',
      reviewerId: 'u-1',
      note: 'risk accepted with mitigation',
      decidedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(result.status).toBe('approved');
    expect(result.reviewerId).toBe('u-1');
    expect(result.note).toBe('risk accepted with mitigation');
    expect(result.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('rejects re-deciding a non-pending approval record', () => {
    expect(() => applyApprovalDecision(approval({ status: 'approved' }), {
      decision: 'rejected',
      reviewerId: 'u-2',
      note: 'late reject',
      decidedAt: '2026-01-02T00:00:00.000Z',
    })).toThrow('already decided');
  });

  it('summarizes approval queue by status and priority', () => {
    const snapshot = buildApprovalQueueSnapshot([
      approval({ id: 'ap-1', status: 'pending', priority: 'critical' }),
      approval({ id: 'ap-2', status: 'pending', priority: 'high', agent: 'tech-policy' }),
      approval({ id: 'ap-3', status: 'rejected', priority: 'high', agent: 'media-compliance' }),
    ]);

    expect(snapshot.pending).toHaveLength(2);
    expect(snapshot.byStatus).toEqual({ pending: 2, approved: 0, rejected: 1, edited: 0 });
    expect(snapshot.byPriority).toEqual({ high: 2, critical: 1 });
  });
});

describe('LLMOps alerting V44', () => {
  const policy: LlmOpsAlertPolicy = {
    maxCostUsd: 0.02,
    maxAverageLatencyMs: 800,
    maxFallbackRate: 0.2,
    maxErrorRate: 0.1,
  };

  it('raises cost, latency, fallback and error alerts against policy', () => {
    const alerts = buildLlmOpsAlerts([
      { agent: 'resume', provider: 'openai', tokens: 1000, costUsd: 0.03, latencyMs: 900, status: 'ok' },
      { agent: 'legal', provider: 'openai', tokens: 800, costUsd: 0.01, latencyMs: 1000, status: 'fallback' },
      { agent: 'score', provider: 'openai', tokens: 500, costUsd: 0.01, latencyMs: 1200, status: 'error' },
    ], policy);

    expect(alerts.map((alert) => alert.kind)).toEqual(['cost', 'latency', 'fallback', 'error']);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[3].severity).toBe('critical');
  });

  it('returns no alerts when usage is within thresholds', () => {
    const alerts = buildLlmOpsAlerts([
      { agent: 'resume', provider: 'mock', tokens: 100, costUsd: 0, latencyMs: 10, status: 'ok' },
    ], policy);

    expect(alerts).toEqual([]);
  });
});
