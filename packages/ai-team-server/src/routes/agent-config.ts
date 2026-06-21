// V32: HTTP API for per-agent configuration (soul/user/memory + LLM)
// Independent per-agent: each kind has its own file under agent-configs/<kind>.json
import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import {
  AGENT_KINDS,
  AgentConfigStore,
  validateAgentConfigPatch,
  type AgentConfigPatch,
  type AgentKind,
} from '@ai-team/core';

export interface AgentConfigRouterDeps {
  store: AgentConfigStore;
}

function isAgentKind(value: string): value is AgentKind {
  return (AGENT_KINDS as string[]).includes(value);
}

function pickKind(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

export function createAgentConfigRouter(deps: AgentConfigRouterDeps): Router {
  const router = createRouter();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const items = await deps.store.list();
      res.json({ items });
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_config_list_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  router.get('/:kind', async (req: Request, res: Response) => {
    const kind = pickKind(req.params.kind);
    if (!isAgentKind(kind)) {
      return res.status(400).json({ error: 'unknown_agent_kind', kind });
    }
    try {
      const config = await deps.store.get(kind);
      if (!config) {
        return res.status(404).json({ error: 'agent_config_not_found', kind });
      }
      res.json({ config });
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_config_get_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  router.put('/:kind', async (req: Request, res: Response) => {
    const kind = pickKind(req.params.kind);
    if (!isAgentKind(kind)) {
      return res.status(400).json({ error: 'unknown_agent_kind', kind });
    }
    const patch = req.body as AgentConfigPatch;
    const validation = validateAgentConfigPatch(patch);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    try {
      const config = await deps.store.save(kind, patch);
      res.json({ config });
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_config_save_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  router.delete('/:kind', async (req: Request, res: Response) => {
    const kind = pickKind(req.params.kind);
    if (!isAgentKind(kind)) {
      return res.status(400).json({ error: 'unknown_agent_kind', kind });
    }
    try {
      const deleted = await deps.store.delete(kind);
      res.json({ deleted });
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_config_delete_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  router.post('/:kind/reset-llm', async (req: Request, res: Response) => {
    const kind = pickKind(req.params.kind);
    if (!isAgentKind(kind)) {
      return res.status(400).json({ error: 'unknown_agent_kind', kind });
    }
    try {
      const config = await deps.store.resetLlm(kind);
      if (!config) {
        return res.status(404).json({ error: 'agent_config_not_found', kind });
      }
      res.json({ config });
    } catch (e: unknown) {
      res.status(500).json({
        error: 'agent_config_reset_llm_failed',
        message: e instanceof Error ? e.message : 'unknown',
      });
    }
  });

  return router;
}
