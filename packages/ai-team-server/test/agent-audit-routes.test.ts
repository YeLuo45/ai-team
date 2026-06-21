// V22: Agent audit routes tests
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentAuditStore } from '@ai-team/core';
import { createAgentAuditRouter } from '../src/routes/agent-audit.js';
import type { AgentCallRecord } from '@ai-team/core';

function makeApp(): { app: express.Express; store: AgentAuditStore } {
  const dir = mkdtempSync(join(tmpdir(), 'agent-audit-rt-'));
  const store = AgentAuditStore.create(dir);
  const app = express();
  app.use(express.json());
  app.use('/api/agent-audit', createAgentAuditRouter({ auditStore: store }));
  return { app, store };
}

function makeRecord(over: Partial<AgentCallRecord>): AgentCallRecord {
  return {
    id: over.id ?? `ac_${Math.random().toString(36).slice(2)}`,
    agent: over.agent ?? 'interview',
    operation: over.operation ?? 'start',
    actorId: over.actorId ?? 'u1',
    inputSummary: over.inputSummary ?? '',
    outputSummary: over.outputSummary ?? '',
    status: over.status ?? 'success',
    durationMs: over.durationMs ?? 100,
    startedAt: over.startedAt ?? new Date().toISOString(),
    endedAt: over.endedAt ?? new Date().toISOString(),
  };
}

describe('Agent audit routes', () => {
  let app: express.Express;
  let store: AgentAuditStore;
  beforeEach(() => {
    const a = makeApp();
    app = a.app;
    store = a.store;
  });

  it('GET /api/agent-audit returns empty list', async () => {
    const r = await request(app).get('/api/agent-audit');
    expect(r.status).toBe(200);
    expect(r.body.records).toEqual([]);
    expect(r.body.total).toBe(0);
  });

  it('GET /api/agent-audit lists records (default limit 50)', async () => {
    for (let i = 0; i < 5; i++) await store.add(makeRecord({}));
    const r = await request(app).get('/api/agent-audit');
    expect(r.status).toBe(200);
    expect(r.body.records).toHaveLength(5);
  });

  it('GET /api/agent-audit?limit=N respects valid limit', async () => {
    for (let i = 0; i < 10; i++) await store.add(makeRecord({}));
    const r = await request(app).get('/api/agent-audit?limit=3');
    expect(r.body.records).toHaveLength(3);
  });

  it('GET /api/agent-audit?limit=999 caps to 500', async () => {
    for (let i = 0; i < 10; i++) await store.add(makeRecord({}));
    const r = await request(app).get('/api/agent-audit?limit=999');
    expect(r.body.records).toHaveLength(10);
  });

  it('GET /api/agent-audit?agent=X filters by agent kind', async () => {
    await store.add(makeRecord({ agent: 'interview' }));
    await store.add(makeRecord({ agent: 'training' }));
    await store.add(makeRecord({ agent: 'interview' }));
    const r = await request(app).get('/api/agent-audit?agent=interview');
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    expect(r.body.records.every((x: AgentCallRecord) => x.agent === 'interview')).toBe(true);
  });

  it('GET /api/agent-audit?agent=bogus ignored (no filter)', async () => {
    await store.add(makeRecord({ agent: 'interview' }));
    const r = await request(app).get('/api/agent-audit?agent=bogus');
    expect(r.body.total).toBe(1);
  });

  it('GET /api/agent-audit/stats returns aggregated stats', async () => {
    await store.add(makeRecord({ agent: 'interview', status: 'success', durationMs: 100 }));
    await store.add(makeRecord({ agent: 'interview', status: 'failed', durationMs: 200 }));
    await store.add(makeRecord({ agent: 'training', status: 'success', durationMs: 300 }));
    const r = await request(app).get('/api/agent-audit/stats');
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.byAgent.interview).toBe(2);
    expect(r.body.byAgent.training).toBe(1);
    expect(r.body.averageDurationMs).toBe(200);
    expect(r.body.failureRate).toBeCloseTo(1 / 3, 4);
  });

  it('GET /api/agent-audit/:id returns single record', async () => {
    const r0 = await store.add(makeRecord({}));
    const r = await request(app).get(`/api/agent-audit/${r0.id}`);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(r0.id);
  });

  it('GET /api/agent-audit/:id 404 for unknown', async () => {
    const r = await request(app).get('/api/agent-audit/missing-id');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('not_found');
  });

  it('GET /api/agent-audit/:id returns 500 on store error', async () => {
    store.list = async () => { throw new Error('boom'); };
    const r = await request(app).get('/api/agent-audit/any-id');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_audit_get_failed');
  });

  it('GET /api/agent-audit/:id uses "unknown" fallback for non-Error throws', async () => {
    store.list = async () => { throw 'string-error'; };
    const r = await request(app).get('/api/agent-audit/any-id');
    expect(r.body.message).toBe('unknown');
  });

  it('GET /api/agent-audit uses "unknown" fallback for non-Error throws', async () => {
    store.recent = async () => { throw { weird: 'object' }; };
    const r = await request(app).get('/api/agent-audit');
    expect(r.body.message).toBe('unknown');
  });

  it('GET /api/agent-audit/stats uses "unknown" fallback for non-Error throws', async () => {
    store.list = async () => { throw 'plain-string-error'; };
    const r = await request(app).get('/api/agent-audit/stats');
    expect(r.body.message).toBe('unknown');
  });

  it('GET /api/agent-audit returns 500 on store error', async () => {
    store.recent = async () => { throw new Error('disk down'); };
    const r = await request(app).get('/api/agent-audit');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_audit_list_failed');
  });

  it('GET /api/agent-audit/stats returns 500 on store error', async () => {
    store.list = async () => { throw new Error('boom'); };
    const r = await request(app).get('/api/agent-audit/stats');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_audit_stats_failed');
  });
});