// V35: agent-config-template routes tests
import express from 'express';
import request from 'supertest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAgentConfigTemplateRouter } from '../src/routes/agent-config-template.js';
import { AgentConfigStore } from '@ai-team/core';

let dir = '';
let app: express.Express;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agent-template-routes-'));
  app = express();
  app.use(express.json());
  const store = new AgentConfigStore({ baseDir: dir });
  app.use('/api/agent-config-template', createAgentConfigTemplateRouter({ store }));
});

afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
});

describe('Agent config template routes', () => {
  it('GET /presets lists built-in templates', async () => {
    const r = await request(app).get('/api/agent-config-template/presets');
    expect(r.status).toBe(200);
    expect(r.body.presets.length).toBeGreaterThanOrEqual(3);
    expect(r.body.presets.find((p: { id: string }) => p.id === 'hr-friendly')).toBeTruthy();
  });

  it('GET /export returns envelope with version + empty agents', async () => {
    const r = await request(app).get('/api/agent-config-template/export');
    expect(r.status).toBe(200);
    expect(r.body.version).toBe('v1');
    expect(r.body.agents).toEqual([]);
  });

  it('GET /export returns configured agents', async () => {
    // seed directly via the store
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save('interview', { soul: 's', user: '', memory: '', llm: { model: 'm' } });
    const a2 = express();
    a2.use(express.json());
    a2.use('/api/agent-config-template', createAgentConfigTemplateRouter({ store }));
    const r = await request(a2).get('/api/agent-config-template/export');
    expect(r.status).toBe(200);
    expect(r.body.agents.find((a: { agent: string }) => a.agent === 'interview')).toBeTruthy();
  });

  it('POST /import with templateId applies preset', async () => {
    const r = await request(app)
      .post('/api/agent-config-template/import')
      .send({ templateId: 'hr-friendly' });
    expect(r.status).toBe(200);
    expect(r.body.dryRun).toBe(false);
    expect(r.body.imported).toBeGreaterThan(0);
  });

  it('POST /import with templateId and dryRun=true does not write', async () => {
    const r = await request(app)
      .post('/api/agent-config-template/import')
      .send({ templateId: 'hr-friendly', dryRun: true });
    expect(r.status).toBe(200);
    expect(r.body.dryRun).toBe(true);
    expect(r.body.imported).toBeGreaterThan(0);
    // store should still be empty
    const store = new AgentConfigStore({ baseDir: dir });
    expect(await store.list()).toEqual([]);
  });

  it('POST /import with templateId missing returns 404', async () => {
    const r = await request(app)
      .post('/api/agent-config-template/import')
      .send({ templateId: 'bogus' });
    expect(r.status).toBe(404);
    expect(r.body.error).toMatch(/template_not_found/);
  });

  it('POST /import with explicit envelope applies', async () => {
    const envelope = {
      version: 'v1',
      exportedAt: '2026-06-21T00:00:00Z',
      agents: [{ agent: 'review', soul: 'r', user: '', memory: '', llm: {} }],
    };
    const r = await request(app)
      .post('/api/agent-config-template/import')
      .send({ envelope });
    expect(r.status).toBe(200);
    expect(r.body.imported).toBe(1);
    const store = new AgentConfigStore({ baseDir: dir });
    const got = await store.get('review');
    expect(got?.soul).toBe('r');
  });

  it('POST /import rejects invalid envelope with 400', async () => {
    const r = await request(app)
      .post('/api/agent-config-template/import')
      .send({ envelope: { version: 'v99', exportedAt: '', agents: [] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/version/);
  });

  it('POST /import without templateId or envelope returns 400', async () => {
    const r = await request(app)
      .post('/api/agent-config-template/import')
      .send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/templateId or envelope/);
  });

  it('GET /export returns 500 when store throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.list = async () => { throw new Error('boom'); };
    const a2 = express();
    a2.use(express.json());
    a2.use('/api/agent-config-template', createAgentConfigTemplateRouter({ store }));
    const r = await request(a2).get('/api/agent-config-template/export');
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/export_failed/);
  });

  it('GET /export returns 500 with unknown fallback for non-Error throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.list = async () => { throw 'string-err'; };
    const a2 = express();
    a2.use(express.json());
    a2.use('/api/agent-config-template', createAgentConfigTemplateRouter({ store }));
    const r = await request(a2).get('/api/agent-config-template/export');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('POST /import returns 500 when store throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.save = async () => { throw new Error('save-fail'); };
    const a2 = express();
    a2.use(express.json());
    a2.use('/api/agent-config-template', createAgentConfigTemplateRouter({ store }));
    const r = await request(a2)
      .post('/api/agent-config-template/import')
      .send({ templateId: 'hr-friendly' });
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/import_failed/);
  });
});
