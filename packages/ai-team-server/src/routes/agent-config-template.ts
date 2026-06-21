// V35: Agent config template routes — bulk export/import across all agents
import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import {
  AgentConfigStore,
  BUILTIN_TEMPLATES,
  exportAgentConfigs,
  findTemplate,
  importAgentConfigs,
  validateTemplateEnvelope,
  type AgentConfigTemplateEnvelope,
} from '@ai-team/core';

export interface AgentConfigTemplateRouterDeps {
  store: AgentConfigStore;
}

export function createAgentConfigTemplateRouter(deps: AgentConfigTemplateRouterDeps): Router {
  const router = createRouter();

  router.get('/presets', (_req: Request, res: Response) => {
    res.json({ presets: BUILTIN_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, agentCount: t.agents.length })) });
  });

  router.get('/export', async (_req: Request, res: Response) => {
    try {
      const envelope = await exportAgentConfigs(deps.store);
      res.json(envelope);
    } catch (e: unknown) {
      res.status(500).json({ error: 'agent_config_export_failed', message: e instanceof Error ? e.message : 'unknown' });
    }
  });

  router.post('/import', async (req: Request, res: Response) => {
    const body = req.body as { templateId?: string; envelope?: unknown; dryRun?: boolean };
    let envelope: AgentConfigTemplateEnvelope | undefined;
    try {
      if (body.templateId) {
        const preset = findTemplate(body.templateId);
        if (!preset) {
          return res.status(404).json({ error: 'template_not_found', templateId: body.templateId });
        }
        envelope = {
          version: 'v1',
          exportedAt: new Date().toISOString(),
          agents: preset.agents,
        };
      } else if (body.envelope) {
        const validation = validateTemplateEnvelope(body.envelope);
        if (!validation.ok) {
          return res.status(400).json({ error: validation.error });
        }
        envelope = body.envelope as AgentConfigTemplateEnvelope;
      } else {
        return res.status(400).json({ error: 'either templateId or envelope is required' });
      }
      const result = await importAgentConfigs(deps.store, envelope, { dryRun: body.dryRun });
      res.json(result);
    } catch (e: unknown) {
      res.status(500).json({ error: 'agent_config_import_failed', message: e instanceof Error ? e.message : 'unknown' });
    }
  });

  return router;
}
