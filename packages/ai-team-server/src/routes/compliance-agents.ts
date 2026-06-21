// V32: Compliance agent routes — legal / tech-policy / media-compliance
// 三个 V30/V31 core agent 暴露为 REST 端点，并接入 AgentAuditStore 自动审计。

import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';
import type { AgentAuditStore, AgentKind } from '@ai-team/core';
import {
  assessLegalRisk,
  buildLegalReview,
  summarizeLegalReview,
  classifyTechPolicy,
  buildTechPolicyReport,
  summarizeTechPolicyReport,
  buildMediaComplianceCheck,
  summarizeMediaComplianceCheck,
  detectSiblingConflict,
  buildSiblingConflictReport,
  summarizeSiblingConflict,
  type MediaChannel,
} from '@ai-team/core';

export interface ComplianceAgentDeps {
  auditStore: AgentAuditStore;
}

const MEDIA_CHANNELS: ReadonlyArray<MediaChannel> = [
  'wechat', 'douyin', 'xiaohongshu', 'bilibili', 'feishu', 'other',
];

function isMediaChannel(s: unknown): s is MediaChannel {
  return typeof s === 'string' && (MEDIA_CHANNELS as readonly string[]).includes(s);
}

export function createComplianceAgentRouter(deps: ComplianceAgentDeps): Router {
  const router = createRouter();

  // POST /api/compliance/legal/classify { text }
  router.post('/legal/classify', async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!text) {
      return res.status(400).json({ error: 'validation_error', message: 'text is required' });
    }
    const assessment = assessLegalRisk(text);
    const summary = `classify · ${assessment.level} · ${text.slice(0, 60)}`;
    const record = await deps.auditStore.record({
      agent: 'legal' as AgentKind,
      operation: 'classify',
      actorId: req.auth?.sub ?? 'system',
      inputSummary: text.slice(0, 200),
      outputSummary: summary,
      status: 'success',
      durationMs: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    res.json({ assessment, summary, auditId: record.id });
  });

  // POST /api/compliance/legal/review { issueId, title, description, owner? }
  router.post('/legal/review', async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const { issueId, title, description, owner } = body;
    if (typeof issueId !== 'string' || !issueId
      || typeof title !== 'string' || !title
      || typeof description !== 'string' || !description) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'issueId, title and description are required',
      });
    }
    const review = buildLegalReview({
      issueId,
      title,
      description,
      ...(typeof owner === 'string' && owner ? { owner } : {}),
    });
    const summary = summarizeLegalReview(review);
    const record = await deps.auditStore.record({
      agent: 'legal' as AgentKind,
      operation: 'review',
      entityId: issueId,
      actorId: req.auth?.sub ?? 'system',
      inputSummary: `${title} :: ${description}`.slice(0, 200),
      outputSummary: summary,
      status: 'success',
      durationMs: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    res.status(201).json({ review, summary, auditId: record.id });
  });

  // POST /api/compliance/tech-policy/classify { text }
  router.post('/tech-policy/classify', async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!text) {
      return res.status(400).json({ error: 'validation_error', message: 'text is required' });
    }
    const assessment = classifyTechPolicy(text);
    const summary = `tech-policy · ${assessment.severity} · ${text.slice(0, 60)}`;
    const record = await deps.auditStore.record({
      agent: 'tech-policy' as AgentKind,
      operation: 'classify',
      actorId: req.auth?.sub ?? 'system',
      inputSummary: text.slice(0, 200),
      outputSummary: summary,
      status: 'success',
      durationMs: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    res.json({ assessment, matches: assessment.matches, summary, auditId: record.id });
  });

  // POST /api/compliance/tech-policy/report { incidentId, summary, context? }
  router.post('/tech-policy/report', async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const { incidentId, summary: inputSummary, context } = body;
    if (typeof incidentId !== 'string' || !incidentId
      || typeof inputSummary !== 'string' || !inputSummary) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'incidentId and summary are required',
      });
    }
    const report = buildTechPolicyReport({
      incidentId,
      summary: inputSummary,
      ...(typeof context === 'string' && context ? { context } : {}),
    });
    const auditSummary = summarizeTechPolicyReport(report);
    const record = await deps.auditStore.record({
      agent: 'tech-policy' as AgentKind,
      operation: 'report',
      entityId: incidentId,
      actorId: req.auth?.sub ?? 'system',
      inputSummary: `${inputSummary} :: ${context ?? ''}`.slice(0, 200),
      outputSummary: auditSummary,
      status: 'success',
      durationMs: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    res.status(201).json({ report, summary: auditSummary, auditId: record.id });
  });

  // POST /api/compliance/media/check { assetId, title, channel, excerpt? }
  router.post('/media/check', async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const { assetId, title, channel, excerpt } = body;
    if (typeof assetId !== 'string' || !assetId
      || typeof title !== 'string' || !title
      || !isMediaChannel(channel)) {
      return res.status(400).json({
        error: 'validation_error',
        message: `assetId, title and channel are required (channel one of: ${MEDIA_CHANNELS.join(', ')})`,
      });
    }
    const check = buildMediaComplianceCheck({
      assetId,
      title,
      channel,
      ...(typeof excerpt === 'string' && excerpt ? { excerpt } : {}),
    });
    const summary = summarizeMediaComplianceCheck(check);
    const record = await deps.auditStore.record({
      agent: 'media-compliance' as AgentKind,
      operation: 'check',
      entityId: assetId,
      actorId: req.auth?.sub ?? 'system',
      inputSummary: `${title} :: ${channel} :: ${excerpt ?? ''}`.slice(0, 200),
      outputSummary: summary,
      status: 'success',
      durationMs: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    res.status(201).json({ check, summary, auditId: record.id });
  });

  // POST /api/compliance/sibling-org-conflict/detect { text }
  router.post('/sibling-org-conflict/detect', async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!text) {
      return res.status(400).json({ error: 'validation_error', message: 'text is required' });
    }
    const conflict = detectSiblingConflict(text);
    const summary = `sibling-org-conflict · ${conflict.severity} · ${text.slice(0, 60)}`;
    const record = await deps.auditStore.record({
      agent: 'sibling-org-conflict' as AgentKind,
      operation: 'detect',
      actorId: req.auth?.sub ?? 'system',
      inputSummary: text.slice(0, 200),
      outputSummary: summary,
      status: 'success',
      durationMs: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    res.json({ conflict, matches: conflict.matches, summary, auditId: record.id });
  });

  // POST /api/compliance/sibling-org-conflict/report { incidentId, summary, context? }
  router.post('/sibling-org-conflict/report', async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const { incidentId, summary: inputSummary, context } = body;
    if (typeof incidentId !== 'string' || !incidentId
      || typeof inputSummary !== 'string' || !inputSummary) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'incidentId and summary are required',
      });
    }
    const report = buildSiblingConflictReport({
      incidentId,
      summary: inputSummary,
      ...(typeof context === 'string' && context ? { context } : {}),
    });
    const auditSummary = summarizeSiblingConflict(report);
    const record = await deps.auditStore.record({
      agent: 'sibling-org-conflict' as AgentKind,
      operation: 'report',
      entityId: incidentId,
      actorId: req.auth?.sub ?? 'system',
      inputSummary: `${inputSummary} :: ${context ?? ''}`.slice(0, 200),
      outputSummary: auditSummary,
      status: 'success',
      durationMs: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    res.status(201).json({ report, summary: auditSummary, auditId: record.id });
  });

  // Legacy async-error fallback so the route factory keeps the same signature
  void ((_next: NextFunction) => undefined);

  return router;
}
