// V27: Agent audit SSE stream + auto-broadcast helper
// 把 AuditStore 写入事件实时广播到 SSE 订阅者。

import type { AgentAuditStore, AgentCallRecord } from '@ai-team/core';
import type { SSEManager } from '../sse.js';

export interface AuditStreamDeps {
  auditStore: AgentAuditStore;
  sseManager: SSEManager;
}

export interface AuditStreamFilter {
  /** 按 agent 类型过滤（不传 = 全部） */
  agent?: string;
  /** 初始回放最新 N 条 */
  recent?: number;
}

/**
 * 给 auditStore 装一个 wrapper：调用 record/trace 时自动广播 SSE。
 * 返回 wrappedStore 同时仍可在 store 上直接调用（不广播）。
 */
export function wrapAuditStoreWithBroadcast(deps: AuditStreamDeps): AgentAuditStore {
  const orig = deps.auditStore;
  const broadcastRecord = (rec: AgentCallRecord) => {
    try {
      deps.sseManager.broadcast('agent.audit', rec);
    } catch {
      // best-effort
    }
  };
  // Override record + trace
  const origRecord = orig.record.bind(orig);
  orig.record = async (input) => {
    const rec = await origRecord(input);
    broadcastRecord(rec);
    return rec;
  };
  const origTrace = orig.trace.bind(orig);
  orig.trace = async (meta, fn) => {
    const out = await origTrace(meta, fn);
    broadcastRecord(out.record);
    return out;
  };
  return orig;
}

/**
 * SSE 端点 handler：发送连接成功 + 回放最近 N 条 + 订阅新事件。
 * 由 server 入口挂到 GET /api/agent-audit/stream。
 */
export function createAuditStreamHandler(deps: AuditStreamDeps) {
  return async function auditStreamHandler(req: import('express').Request, res: import('express').Response): Promise<void> {
    const clientId = deps.sseManager.addClient(res);

    // Stream is open; send initial backlog (last 50 records)
    const recent = await deps.auditStore.recent(50);
    for (const rec of recent) {
      try {
        res.write(`event: agent.audit.history\ndata: ${JSON.stringify(rec)}\n\n`);
      } catch {
        break;
      }
    }

    // Auto-close on disconnect
    req.on('close', () => {
      deps.sseManager.removeClient(clientId);
    });
  };
}