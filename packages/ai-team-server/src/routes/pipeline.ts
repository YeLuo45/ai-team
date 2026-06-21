// V21: Pipeline routes — 招聘漏斗推进 + 漏斗报告
import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import type { PipelineStore } from '@ai-team/core';
import { PIPELINE_STAGES, type PipelineStage } from '@ai-team/core';

export interface PipelineDeps {
  pipelineStore: PipelineStore;
}

function isStage(s: unknown): s is PipelineStage {
  return typeof s === 'string' && (PIPELINE_STAGES as string[]).includes(s);
}

function errPayload(code: string, e: unknown) {
  const msg = e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string'
    ? (e as { message: string }).message
    : 'unknown';
  return { error: code, message: msg };
}

const PIPELINE_STAGE_NAMES = PIPELINE_STAGES.join(', ');

export function createPipelineRouter(deps: PipelineDeps): Router {
  const router = createRouter();

  // GET /api/pipeline — 列出全部 entry
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const all = await deps.pipelineStore.list();
      res.json({ entries: all, total: all.length });
    } catch (e) {
      res.status(500).json(errPayload('pipeline_list_failed', e));
    }
  });

  // GET /api/pipeline/funnel — 漏斗报告
  router.get('/funnel', async (_req: Request, res: Response) => {
    try {
      const all = await deps.pipelineStore.list();
      res.json(deps.pipelineStore.funnelReport(all));
    } catch (e) {
      res.status(500).json(errPayload('pipeline_funnel_failed', e));
    }
  });

  // GET /api/pipeline/candidate/:candidateId — 单个候选人历史
  router.get('/candidate/:candidateId', async (req: Request, res: Response) => {
    const cid = String(req.params.candidateId);
    try {
      const all = await deps.pipelineStore.list();
      const mine = all
        .filter((e) => e.candidateId === cid)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const current = deps.pipelineStore.currentEntry(all, cid);
      res.json({ candidateId: cid, history: mine, current });
    } catch (e) {
      res.status(500).json(errPayload('pipeline_candidate_failed', e));
    }
  });

  // POST /api/pipeline/advance — 推进候选人阶段
  router.post('/advance', async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const { candidateId, toStage, actorId, note, linkedInterviewId, linkedReviewId } = body;
    if (typeof candidateId !== 'string' || !candidateId) {
      return res.status(400).json({ error: 'validation_error', message: 'candidateId required' });
    }
    if (!isStage(toStage)) {
      return res.status(400).json({
        error: 'validation_error',
        message: `toStage must be one of ${PIPELINE_STAGE_NAMES}`,
      });
    }
    const actor = typeof actorId === 'string' && actorId ? actorId : 'system';
    try {
      const entry = await deps.pipelineStore.advance({
        candidateId,
        toStage,
        actorId: actor,
        ...(typeof note === 'string' ? { note } : {}),
        ...(typeof linkedInterviewId === 'string' ? { linkedInterviewId } : {}),
        ...(typeof linkedReviewId === 'string' ? { linkedReviewId } : {}),
      });
      res.status(201).json(entry);
    } catch (e) {
      res.status(500).json(errPayload('pipeline_advance_failed', e));
    }
  });

  return router;
}