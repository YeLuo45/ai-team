// V32: Compliance agent routes — legal / tech-policy / media-compliance 三合一
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentAuditStore } from '@ai-team/core';
import { createComplianceAgentRouter } from '../src/routes/compliance-agents.js';

function makeApp() {
  const dir = mkdtempSync(join(tmpdir(), 'compliance-routes-'));
  const auditStore = AgentAuditStore.create(dir);
  const router = createComplianceAgentRouter({ auditStore });
  const app = express();
  app.use(express.json());
  app.use('/api/compliance', router);
  return { app, auditStore };
}

describe('V32 Compliance Agent Routes', () => {
  let ctx: ReturnType<typeof makeApp>;
  beforeEach(() => { ctx = makeApp(); });

  describe('Legal agent', () => {
    it('classifies a low-risk issue', async () => {
      const r = await request(ctx.app).post('/api/compliance/legal/classify')
        .send({ text: '普通劳动合同续签提醒' });
      expect(r.status).toBe(200);
      expect(r.body.assessment.level).toBe('low');
      expect(r.body.summary).toContain('普通劳动合同续签提醒');
    });

    it('builds a review from issue payload', async () => {
      const r = await request(ctx.app).post('/api/compliance/legal/review')
        .send({
          issueId: 'iss-1',
          title: '候选人投诉隐私泄露',
          description: '招聘系统疑似泄露候选人身份证和手机号',
          owner: 'hrbp',
        });
      expect(r.status).toBe(201);
      expect(r.body.review.issueId).toBe('iss-1');
      expect(r.body.review.risk.level).toBe('critical');
      expect(r.body.summary).toContain('iss-1');
    });

    it('returns 400 when review missing required fields', async () => {
      const r = await request(ctx.app).post('/api/compliance/legal/review')
        .send({ issueId: 'iss-x' });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('validation_error');
    });
  });

  describe('Tech policy agent', () => {
    it('classifies critical severity and returns audit evidence', async () => {
      const r = await request(ctx.app).post('/api/compliance/tech-policy/classify')
        .send({ text: '生产密钥硬编码并已提交到公开仓库' });
      expect(r.status).toBe(200);
      expect(r.body.assessment.severity).toBe('critical');
      expect(r.body.matches.length).toBeGreaterThanOrEqual(2);
    });

    it('builds a report with prioritized remediations', async () => {
      const r = await request(ctx.app).post('/api/compliance/tech-policy/report')
        .send({ incidentId: 'inc-1', summary: '员工绕过 IAM 直接连生产数据库' });
      expect(r.status).toBe(201);
      expect(r.body.report.policy.severity).toBe('high');
      expect(r.body.report.remediations[0].priority).toBe('urgent');
    });
  });

  describe('Media compliance agent', () => {
    it('classifies a critical channel asset', async () => {
      const r = await request(ctx.app).post('/api/compliance/media/check')
        .send({ assetId: 'a-1', title: '品牌代言视频', channel: 'douyin', excerpt: '代言人未获授权即定剪' });
      expect(r.status).toBe(201);
      expect(r.body.check.assessment.level).toBe('critical');
      expect(r.body.check.requiredActions[0].kind).toBe('block_publish');
    });

    it('rejects invalid channel values', async () => {
      const r = await request(ctx.app).post('/api/compliance/media/check')
        .send({ assetId: 'a-2', title: 'x', channel: 'unknown-channel' });
      expect(r.status).toBe(400);
    });

    it('rejects tech-policy report missing required fields', async () => {
      const r = await request(ctx.app).post('/api/compliance/tech-policy/report')
        .send({ incidentId: 'inc-x' });
      expect(r.status).toBe(400);
    });

    it('rejects sibling-org-conflict report missing required fields', async () => {
      const r = await request(ctx.app).post('/api/compliance/sibling-org-conflict/report')
        .send({ summary: 'no incident id' });
      expect(r.status).toBe(400);
    });

    it('rejects tech-policy classify without text', async () => {
      const r = await request(ctx.app).post('/api/compliance/tech-policy/classify').send({});
      expect(r.status).toBe(400);
    });

    it('rejects sibling-org-conflict detect without text', async () => {
      const r = await request(ctx.app).post('/api/compliance/sibling-org-conflict/detect').send({});
      expect(r.status).toBe(400);
    });

    it('rejects media check missing assetId', async () => {
      const r = await request(ctx.app).post('/api/compliance/media/check')
        .send({ title: 'x', channel: 'wechat' });
      expect(r.status).toBe(400);
    });

    it('rejects media check missing title', async () => {
      const r = await request(ctx.app).post('/api/compliance/media/check')
        .send({ assetId: 'a-1', channel: 'wechat' });
      expect(r.status).toBe(400);
    });

    it('rejects media check missing channel', async () => {
      const r = await request(ctx.app).post('/api/compliance/media/check')
        .send({ assetId: 'a-1', title: 'x' });
      expect(r.status).toBe(400);
    });

    it('rejects legal review missing description', async () => {
      const r = await request(ctx.app).post('/api/compliance/legal/review')
        .send({ issueId: 'i-1', title: 't' });
      expect(r.status).toBe(400);
    });

    it('rejects tech-policy report missing summary', async () => {
      const r = await request(ctx.app).post('/api/compliance/tech-policy/report')
        .send({ incidentId: 'inc-x' });
      expect(r.status).toBe(400);
    });

    it('rejects sibling-org-conflict report missing summary', async () => {
      const r = await request(ctx.app).post('/api/compliance/sibling-org-conflict/report')
        .send({ incidentId: 'so-x' });
      expect(r.status).toBe(400);
    });

    it('rejects sibling-org-conflict report missing incidentId', async () => {
      const r = await request(ctx.app).post('/api/compliance/sibling-org-conflict/report')
        .send({ summary: 'no id' });
      expect(r.status).toBe(400);
    });

    it('builds sibling-org-conflict report with context provided', async () => {
      const r = await request(ctx.app).post('/api/compliance/sibling-org-conflict/report')
        .send({ incidentId: 'so-ctx', summary: '两个团队抢同一名候选人', context: '前端/全栈都标了' });
      expect(r.status).toBe(201);
      expect(r.body.report.conflict.severity).toBe('medium');
      expect(r.body.summary).toContain('so-ctx');
    });

    it('builds tech-policy report with context provided', async () => {
      const r = await request(ctx.app).post('/api/compliance/tech-policy/report')
        .send({ incidentId: 'inc-ctx', summary: '员工绕过 IAM 直接连生产数据库', context: '临时调试后未关闭入口' });
      expect(r.status).toBe(201);
      expect(r.body.report.policy.severity).toBe('high');
      expect(r.body.summary).toContain('inc-ctx');
    });

    it('rejects legal classify without text', async () => {
      const r = await request(ctx.app).post('/api/compliance/legal/classify').send({});
      expect(r.status).toBe(400);
    });

    it('summarizes low-risk internal assets', async () => {
      const r = await request(ctx.app).post('/api/compliance/media/check')
        .send({ assetId: 'a-3', title: '内部 OKR 草稿', channel: 'feishu' });
      expect(r.status).toBe(201);
      expect(r.body.summary).toContain('a-3');
      expect(r.body.check.assessment.level).toBe('low');
    });
  });

  describe('audit logging', () => {
    it('records an agent call for each successful route', async () => {
      await request(ctx.app).post('/api/compliance/legal/classify').send({ text: 'ok' });
      await request(ctx.app).post('/api/compliance/tech-policy/classify').send({ text: 'ok' });
      await request(ctx.app).post('/api/compliance/media/check')
        .send({ assetId: 'a-x', title: 'x', channel: 'feishu' });
      await request(ctx.app).post('/api/compliance/sibling-org-conflict/detect').send({ text: 'ok' });
      const records = await ctx.auditStore.recent(50);
      const agents = new Set(records.map((r) => r.agent));
      expect(agents.has('legal')).toBe(true);
      expect(agents.has('tech-policy')).toBe(true);
      expect(agents.has('media-compliance')).toBe(true);
      expect(agents.has('sibling-org-conflict')).toBe(true);
    });

    it('does not record failures for validation errors', async () => {
      await request(ctx.app).post('/api/compliance/legal/review').send({});
      const records = await ctx.auditStore.recent(50);
      expect(records.some((r) => r.status === 'failed')).toBe(false);
    });
  });

  describe('Sibling org conflict agent', () => {
    it('detects critical severity and matches multiple categories', async () => {
      const r = await request(ctx.app).post('/api/compliance/sibling-org-conflict/detect')
        .send({ text: 'A 团队负责人要求删除 B 团队共享文档' });
      expect(r.status).toBe(200);
      expect(r.body.conflict.severity).toBe('high');
      expect(r.body.matches.length).toBeGreaterThanOrEqual(1);
    });

    it('builds a report for medium conflict', async () => {
      const r = await request(ctx.app).post('/api/compliance/sibling-org-conflict/report')
        .send({ incidentId: 'so-r1', summary: '两个团队抢同一名后端候选人' });
      expect(r.status).toBe(201);
      expect(r.body.report.conflict.severity).toBe('medium');
      expect(r.body.report.actions[0].priority).toBe('urgent');
    });
  });
});
