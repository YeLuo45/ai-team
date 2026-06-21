// V22: Agent audit routes — list recent calls, get stats, filter by agent
import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';
import type { AgentAuditStore, AgentKind } from '@ai-team/core';
import { AGENT_KINDS } from '@ai-team/core';

export interface AgentAuditDeps {
  auditStore: AgentAuditStore;
}

function isKind(s: unknown): s is AgentKind {
  return typeof s === 'string' && (AGENT_KINDS as string[]).includes(s);
}

export function createAgentAuditRouter(deps: AgentAuditDeps): Router {
  const router = createRouter();

  // GET /api/agent-audit — list recent records
  router.get('/', async (req: Request, res: Response) => {
    try {
      const limitRaw = req.query.limit;
      const limit = typeof limitRaw === 'string' ? parseInt(limitRaw, 10) : 50;
      const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 500 ? limit : 50;
      const agent = req.query.agent;
      const records = await deps.auditStore.recent(safeLimit);
      const filtered = typeof agent === 'string' && isKind(agent)
        ? records.filter((r) => r.agent === agent)
        : records;
      res.json({ records: filtered, total: filtered.length });
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_audit_list_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  // GET /api/agent-audit/stats — 聚合统计
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const all = await deps.auditStore.list();
      const stats = deps.auditStore.stats(all);
      res.json(stats);
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_audit_stats_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  // GET /api/agent-audit/:id — single record
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      if (id === 'stream') return next();
      const all = await deps.auditStore.list();
      const found = all.find((r) => r.id === id);
      if (!found) {
        return res.status(404).json({ error: 'not_found', message: `record ${id} not found` });
      }
      res.json(found);
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_audit_get_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  return router;
}