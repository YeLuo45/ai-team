// V32: agent-config routes tests
import express from 'express';
import request from 'supertest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAgentConfigRouter } from '../src/routes/agent-config.js';
import { AgentConfigStore } from '@ai-team/core';

let dir = '';
let app: express.Express;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agent-config-routes-'));
  app = express();
  app.use(express.json());
  const store = new AgentConfigStore({ baseDir: dir });
  app.use('/api/agent-config', createAgentConfigRouter({ store }));
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
});

describe('Agent config routes', () => {
  it('GET /api/agent-config returns empty list when nothing configured', async () => {
    const r = await request(app).get('/api/agent-config');
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
  });

  it('PUT /api/agent-config/:kind stores soul/user/memory/llm independently', async () => {
    const r1 = await request(app)
      .put('/api/agent-config/interview')
      .send({
        soul: 'be strict',
        user: 'tech leads',
        memory: 'previous RAG discussion',
        llm: { model: 'gpt-5.5', temperature: 0.3, maxTokens: 256 },
      });
    expect(r1.status).toBe(200);
    expect(r1.body.config.soul).toBe('be strict');
    expect(r1.body.config.agent).toBe('interview');
    expect(r1.body.config.llm.model).toBe('gpt-5.5');

    const r2 = await request(app)
      .put('/api/agent-config/training')
      .send({ soul: 'training soul', user: '', memory: '', llm: { temperature: 0.7 } });
    expect(r2.status).toBe(200);

    const list = await request(app).get('/api/agent-config');
    expect(list.body.items).toHaveLength(2);
    const ivItem = list.body.items.find((it: { agent: string }) => it.agent === 'interview');
    const trItem = list.body.items.find((it: { agent: string }) => it.agent === 'training');
    expect(ivItem.llm.model).toBe('gpt-5.5');
    expect(ivItem.llm.temperature).toBe(0.3);
    expect(trItem.llm.model).toBeUndefined();
    expect(trItem.llm.temperature).toBe(0.7);
    expect(ivItem.soul).toBe('be strict');
    expect(trItem.soul).toBe('training soul');
  });

  it('PUT /api/agent-config/:kind rejects oversized prompt', async () => {
    const huge = 'a'.repeat(20_001);
    const r = await request(app)
      .put('/api/agent-config/interview')
      .send({ soul: huge, user: '', memory: '', llm: {} });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/soul too large/);
  });

  it('PUT /api/agent-config/:kind rejects out-of-range temperature', async () => {
    const r = await request(app)
      .put('/api/agent-config/interview')
      .send({ soul: '', user: '', memory: '', llm: { temperature: 3 } });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/temperature/);
  });

  it('PUT /api/agent-config/:kind rejects unknown agent kind', async () => {
    const r = await request(app)
      .put('/api/agent-config/bogus')
      .send({ soul: 'x', user: '', memory: '', llm: {} });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/unknown_agent_kind/);
  });

  it('GET /api/agent-config/:kind returns config or 404', async () => {
    const notFound = await request(app).get('/api/agent-config/review');
    expect(notFound.status).toBe(404);
    await request(app)
      .put('/api/agent-config/review')
      .send({ soul: 'review soul', user: '', memory: '', llm: { model: 'review-m' } });
    const ok = await request(app).get('/api/agent-config/review');
    expect(ok.status).toBe(200);
    expect(ok.body.config.llm.model).toBe('review-m');
  });

  it('DELETE /api/agent-config/:kind removes only that agent', async () => {
    await request(app)
      .put('/api/agent-config/interview')
      .send({ soul: 'iv', user: '', memory: '', llm: {} });
    await request(app)
      .put('/api/agent-config/training')
      .send({ soul: 'tr', user: '', memory: '', llm: {} });

    const del = await request(app).delete('/api/agent-config/interview');
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const ivGone = await request(app).get('/api/agent-config/interview');
    expect(ivGone.status).toBe(404);
    const trLeft = await request(app).get('/api/agent-config/training');
    expect(trLeft.status).toBe(200);
    expect(trLeft.body.config.soul).toBe('tr');
  });

  it('DELETE on non-existent kind returns deleted=false', async () => {
    const r = await request(app).delete('/api/agent-config/one-on-one');
    expect(r.status).toBe(200);
    expect(r.body.deleted).toBe(false);
  });

  it('POST /api/agent-config/:kind/reset-llm clears llm but keeps soul/user/memory', async () => {
    await request(app)
      .put('/api/agent-config/interview')
      .send({
        soul: 'keep me',
        user: 'and me',
        memory: 'and me',
        llm: { model: 'gpt-5.5', temperature: 0.4 },
      });
    const r = await request(app).post('/api/agent-config/interview/reset-llm');
    expect(r.status).toBe(200);
    expect(r.body.config.soul).toBe('keep me');
    expect(r.body.config.llm).toEqual({});
  });

  it('PUT on invalid kind returns 400', async () => {
    const r = await request(app).put('/api/agent-config/12345').send({});
    expect(r.status).toBe(400);
  });

  it('GET list returns 500 when store throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.list = async () => { throw new Error('disk down'); };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).get('/api/agent-config');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_config_list_failed');
  });

  it('GET /:kind returns 500 when store throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.get = async () => { throw new Error('boom'); };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).get('/api/agent-config/interview');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_config_get_failed');
  });

  it('PUT /:kind returns 500 when store.save throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.save = async () => { throw new Error('save-boom'); };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr)
      .put('/api/agent-config/interview')
      .send({ soul: 'x', user: '', memory: '', llm: {} });
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_config_save_failed');
  });

  it('PUT /:kind rejects invalid JSON body', async () => {
    const r = await request(app)
      .put('/api/agent-config/interview')
      .set('Content-Type', 'application/json')
      .send('not-json');
    expect(r.status).toBe(400);
  });

  it('DELETE /:kind returns 500 when store throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.delete = async () => { throw new Error('del-boom'); };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).delete('/api/agent-config/interview');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_config_delete_failed');
  });

  it('POST /:kind/reset-llm returns 500 when store throws', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.resetLlm = async () => { throw new Error('reset-boom'); };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).post('/api/agent-config/interview/reset-llm');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('agent_config_reset_llm_failed');
  });

  it('POST /:kind/reset-llm returns 404 when config does not exist', async () => {
    const r = await request(app).post('/api/agent-config/review/reset-llm');
    expect(r.status).toBe(404);
  });

  it('POST /:kind/reset-llm returns 400 for unknown kind', async () => {
    const r = await request(app).post('/api/agent-config/bogus/reset-llm');
    expect(r.status).toBe(400);
  });

  it('isAgentKind false branch: PUT /:kind with bogus kind returns 400', async () => {
    const r = await request(app).put('/api/agent-config/bogus').send({});
    expect(r.status).toBe(400);
  });

  it('isAgentKind false branch: GET /:kind with bogus kind returns 400', async () => {
    const r = await request(app).get('/api/agent-config/bogus');
    expect(r.status).toBe(400);
  });

  it('isAgentKind false branch: DELETE /:kind with bogus kind returns 400', async () => {
    const r = await request(app).delete('/api/agent-config/bogus');
    expect(r.status).toBe(400);
  });

  it('GET / uses "unknown" fallback when non-Error thrown', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.list = async () => { throw 'string-error'; };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).get('/api/agent-config');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('GET /:kind uses "unknown" fallback when non-Error thrown', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.get = async () => { throw { code: 'EFT' }; };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).get('/api/agent-config/interview');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('PUT /:kind uses "unknown" fallback when non-Error thrown', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.save = async () => { throw null; };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr)
      .put('/api/agent-config/interview')
      .send({ soul: 'x', user: '', memory: '', llm: {} });
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('DELETE /:kind uses "unknown" fallback when non-Error thrown', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.delete = async () => { throw 'string-error'; };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).delete('/api/agent-config/interview');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('POST /:kind/reset-llm uses "unknown" fallback when non-Error thrown', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.resetLlm = async () => { throw 42; };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).post('/api/agent-config/interview/reset-llm');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('GET /:kind catch returns 500 even for non-Error throw', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.get = async () => { throw 'plain-string'; };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).get('/api/agent-config/interview');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('DELETE /:kind catch returns 500 even for non-Error throw', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    store.delete = async () => { throw ['array', 'error']; };
    const appErr = express();
    appErr.use(express.json());
    appErr.use('/api/agent-config', createAgentConfigRouter({ store }));
    const r = await request(appErr).delete('/api/agent-config/interview');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });
});
