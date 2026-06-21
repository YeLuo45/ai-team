// V21: Pipeline routes tests
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPipelineRouter } from '../src/routes/pipeline.js';
import { PipelineStore } from '@ai-team/core';

function makeApp(): express.Express {
  const dir = mkdtempSync(join(tmpdir(), 'pipeline-routes-'));
  const pipelineStore = PipelineStore.create(dir);
  const app = express();
  app.use(express.json());
  app.use('/api/pipeline', createPipelineRouter({ pipelineStore }));
  return app;
}

describe('Pipeline routes', () => {
  let app: express.Express;
  beforeEach(() => { app = makeApp(); });

  it('GET /api/pipeline returns empty list initially', async () => {
    const r = await request(app).get('/api/pipeline');
    expect(r.status).toBe(200);
    expect(r.body.entries).toEqual([]);
    expect(r.body.total).toBe(0);
  });

  it('POST /api/pipeline/advance with missing candidateId → 400', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({ toStage: 'sourced' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('validation_error');
  });

  it('POST /api/pipeline/advance with invalid toStage → 400', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'bogus' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/toStage must be one of/);
  });

  it('POST /api/pipeline/advance creates sourced entry → 201', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'sourced', actorId: 'u1' });
    expect(r.status).toBe(201);
    expect(r.body.candidateId).toBe('c1');
    expect(r.body.stage).toBe('sourced');
    expect(r.body.previousStage).toBeNull();
    expect(r.body.actorId).toBe('u1');
  });

  it('POST /api/pipeline/advance records previousStage and note', async () => {
    await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'sourced', actorId: 'u1' });
    const r = await request(app).post('/api/pipeline/advance').send({
      candidateId: 'c1', toStage: 'screening', actorId: 'u1', note: 'pass',
    });
    expect(r.status).toBe(201);
    expect(r.body.previousStage).toBe('sourced');
    expect(r.body.note).toBe('pass');
  });

  it('POST /api/pipeline/advance defaults actor to system', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'sourced' });
    expect(r.body.actorId).toBe('system');
  });

  it('GET /api/pipeline/funnel returns funnel report', async () => {
    await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'sourced' });
    await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'screening' });
    await request(app).post('/api/pipeline/advance').send({ candidateId: 'c2', toStage: 'sourced' });
    const r = await request(app).get('/api/pipeline/funnel');
    expect(r.status).toBe(200);
    expect(r.body.byStage.sourced).toBe(1);
    expect(r.body.byStage.screening).toBe(1);
    expect(r.body.total).toBe(2);
    expect(Array.isArray(r.body.steps)).toBe(true);
    expect(r.body.steps.length).toBeGreaterThanOrEqual(6);
    expect(r.body.generatedAt).toBeDefined();
  });

  it('GET /api/pipeline/candidate/:cid returns history and current', async () => {
    await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'sourced', actorId: 'u1' });
    await request(app).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'screening', actorId: 'u1' });
    const r = await request(app).get('/api/pipeline/candidate/c1');
    expect(r.status).toBe(200);
    expect(r.body.candidateId).toBe('c1');
    expect(r.body.history).toHaveLength(2);
    expect(r.body.current.stage).toBe('screening');
  });

  it('GET /api/pipeline/candidate/:cid for unknown candidate returns empty', async () => {
    const r = await request(app).get('/api/pipeline/candidate/c-unknown');
    expect(r.status).toBe(200);
    expect(r.body.history).toEqual([]);
    expect(r.body.current).toBeNull();
  });

  it('GET /api/pipeline returns 500 when store.list throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipeline-err-'));
    const store = PipelineStore.create(dir);
    const origList = store.list.bind(store);
    store.list = async () => { throw new Error('disk down'); };
    const app2 = express();
    app2.use(express.json());
    app2.use('/api/pipeline', createPipelineRouter({ pipelineStore: store }));
    const r = await request(app2).get('/api/pipeline');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('pipeline_list_failed');
    store.list = origList;
  });

  it('GET /api/pipeline/funnel returns 500 when store.list throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipeline-err-funnel-'));
    const store = PipelineStore.create(dir);
    store.list = async () => { throw new Error('disk down'); };
    const app2 = express();
    app2.use(express.json());
    app2.use('/api/pipeline', createPipelineRouter({ pipelineStore: store }));
    const r = await request(app2).get('/api/pipeline/funnel');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('pipeline_funnel_failed');
  });

  it('GET /api/pipeline/candidate/:cid returns 500 when store throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipeline-err-cand-'));
    const store = PipelineStore.create(dir);
    store.list = async () => { throw new Error('boom'); };
    const app2 = express();
    app2.use(express.json());
    app2.use('/api/pipeline', createPipelineRouter({ pipelineStore: store }));
    const r = await request(app2).get('/api/pipeline/candidate/c1');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('pipeline_candidate_failed');
  });

  it('POST /api/pipeline/advance returns 500 when store.advance throws', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipeline-err-adv-'));
    const store = PipelineStore.create(dir);
    store.advance = async () => { throw new Error('write fail'); };
    const app2 = express();
    app2.use(express.json());
    app2.use('/api/pipeline', createPipelineRouter({ pipelineStore: store }));
    const r = await request(app2).post('/api/pipeline/advance').send({ candidateId: 'c1', toStage: 'sourced' });
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('pipeline_advance_failed');
  });

  it('uses "unknown" fallback when thrown error has no message', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipeline-err-fb-'));
    const store = PipelineStore.create(dir);
    const bare: any = {};
    store.list = async () => { throw bare; };
    const app2 = express();
    app2.use(express.json());
    app2.use('/api/pipeline', createPipelineRouter({ pipelineStore: store }));
    const r = await request(app2).get('/api/pipeline');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('POST /api/pipeline/advance omits optional fields when not strings', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({
      candidateId: 'c1', toStage: 'screening',
      note: 123, linkedInterviewId: null, linkedReviewId: undefined,
    });
    expect(r.status).toBe(201);
    expect(r.body.note).toBeUndefined();
    expect(r.body.linkedInterviewId).toBeUndefined();
    expect(r.body.linkedReviewId).toBeUndefined();
  });

  it('POST /api/pipeline/advance falls back to system actor for empty string', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({
      candidateId: 'c1', toStage: 'screening', actorId: '',
    });
    expect(r.status).toBe(201);
    expect(r.body.actorId).toBe('system');
  });

  it('POST /api/pipeline/advance falls back to system actor for non-string', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({
      candidateId: 'c1', toStage: 'screening', actorId: 123,
    });
    expect(r.status).toBe(201);
    expect(r.body.actorId).toBe('system');
  });

  it('POST /api/pipeline/advance includes optional fields when all strings', async () => {
    const r = await request(app).post('/api/pipeline/advance').send({
      candidateId: 'c1', toStage: 'screening',
      note: 'phone OK', linkedInterviewId: 'iv_1', linkedReviewId: 'rv_1',
    });
    expect(r.status).toBe(201);
    expect(r.body.note).toBe('phone OK');
    expect(r.body.linkedInterviewId).toBe('iv_1');
    expect(r.body.linkedReviewId).toBe('rv_1');
  });
});