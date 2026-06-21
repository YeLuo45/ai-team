// V22: Agent audit store + stats
import { JsonStore } from './json-store.js';
import type { AgentCallRecord, AgentCallStats, AgentKind, AgentCallStatus } from '../types/agent-audit.js';

export const AGENT_KINDS: AgentKind[] = [
  'interview', 'training', 'one-on-one', 'review', 'resume', 'insights', 'score', 'search', 'legal', 'pipeline', 'unknown',
];
export const AGENT_STATUSES: AgentCallStatus[] = ['success', 'failed', 'cancelled'];

function emptyByKind(): Record<AgentKind, number> {
  return {
    interview: 0, training: 0, 'one-on-one': 0, review: 0, resume: 0,
    insights: 0, score: 0, search: 0, legal: 0, pipeline: 0, unknown: 0,
  };
}
function emptyByStatus(): Record<AgentCallStatus, number> {
  return { success: 0, failed: 0, cancelled: 0 };
}

export class AgentAuditStore extends JsonStore<AgentCallRecord> {
  static create(baseDir: string): AgentAuditStore {
    return new AgentAuditStore({ baseDir, fileName: 'agent-audit.json' });
  }

  /**
   * 记录一次 agent 调用。start() 返回 record id，调用方可补全结束信息。
   * 简单场景可直接调用 `record(...)` 一次性写完整记录。
   */
  async record(input: Omit<AgentCallRecord, 'id'> & { id?: string }): Promise<AgentCallRecord> {
    const rec: AgentCallRecord = { ...input, id: input.id ?? this.newId() };
    await this.add(rec);
    return rec;
  }

  /**
   * 简化的"开箱即用"封装：传入回调，统计耗时，捕获异常。
   */
  async trace<T>(
    meta: { agent: AgentKind; operation: string; entityId?: string; actorId: string; inputSummary: string },
    fn: () => Promise<T>
  ): Promise<{ record: AgentCallRecord; result?: T; error?: unknown }> {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    try {
      const result = await fn();
      const rec = await this.record({
        agent: meta.agent,
        operation: meta.operation,
        ...(meta.entityId ? { entityId: meta.entityId } : {}),
        actorId: meta.actorId,
        inputSummary: meta.inputSummary,
        outputSummary: summarize(typeof result),
        status: 'success',
        durationMs: Date.now() - t0,
        startedAt,
        endedAt: new Date().toISOString(),
      });
      return { record: rec, result };
    } catch (err) {
      const rec = await this.record({
        agent: meta.agent,
        operation: meta.operation,
        ...(meta.entityId ? { entityId: meta.entityId } : {}),
        actorId: meta.actorId,
        inputSummary: meta.inputSummary,
        outputSummary: '',
        status: 'failed',
        durationMs: Date.now() - t0,
        startedAt,
        endedAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return { record: rec, error: err };
    }
  }

  /**
   * 统计：按 agent / status 聚合 + 平均耗时 + 失败率。
   */
  stats(records: AgentCallRecord[] = []): AgentCallStats {
    const byAgent = emptyByKind();
    const byStatus = emptyByStatus();
    let durTotal = 0;
    for (const r of records) {
      byAgent[r.agent] += 1;
      byStatus[r.status] += 1;
      durTotal += r.durationMs;
    }
    const total = records.length;
    return {
      total,
      byAgent,
      byStatus,
      averageDurationMs: total > 0 ? Math.round(durTotal / total) : 0,
      failureRate: total > 0 ? +(byStatus.failed / total).toFixed(4) : 0,
      windowStart: total > 0 ? records[0].startedAt : new Date().toISOString(),
      windowEnd: total > 0 ? records[records.length - 1].startedAt : new Date().toISOString(),
    };
  }

  /** 过滤最近 N 条记录 */
  async recent(limit: number = 50): Promise<AgentCallRecord[]> {
    const all = await this.list();
    return all
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  private newId(): string {
    return `ac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
}

function summarize(t: string): string {
  // typeof always returns a short primitive name (e.g. 'string', 'undefined', 'number').
  // Normalize empty / undefined-ish to 'void' for log brevity.
  if (!t || t === 'undefined') return 'void';
  return t;
}