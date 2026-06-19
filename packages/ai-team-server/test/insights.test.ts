// Server insights endpoint tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('Server insights endpoints', () => {
  let dir: string;
  let app: any;

  beforeEach(async () => {
    dir = await createTempDir();
    process.env.AI_TEAM_DATA_DIR = dir;
    process.env.AI_TEAM_TEST = '1';
    vi.resetModules();
    const { app: importedApp } = await import('../src/index.js');
    app = importedApp;
  });

  afterEach(async () => {
    delete process.env.AI_TEAM_DATA_DIR;
    delete process.env.AI_TEAM_TEST;
    vi.resetModules();
    await new Promise((r) => setTimeout(r, 50));
    await cleanupTempDir(dir);
  });

  it('GET /api/insights/funnel', async () => {
    const r = await request(app).get('/api/insights/funnel');
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('stages');
    expect(r.body).toHaveProperty('bySource');
    expect(r.body).toHaveProperty('totalCandidates');
  });

  it('GET /api/insights/skill-gaps', async () => {
    const r = await request(app).get('/api/insights/skill-gaps');
    expect(r.status).toBe(200);
    expect(r.body).toBeInstanceOf(Array);
  });

  it('GET /api/insights/skill-gaps with required', async () => {
    const r = await request(app).get('/api/insights/skill-gaps?required=Kubernetes,React');
    expect(r.status).toBe(200);
  });

  it('GET /api/insights/recommendations', async () => {
    const r = await request(app).get('/api/insights/recommendations');
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('recommendations');
    expect(r.body).toHaveProperty('anomalies');
  });

  it('GET /api/insights/anomalies', async () => {
    const r = await request(app).get('/api/insights/anomalies');
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('anomalies');
  });

  it('GET /api/insights/member-growth/:id 404 for missing', async () => {
    const r = await request(app).get('/api/insights/member-growth/nope');
    expect(r.status).toBe(404);
  });

  it('GET /api/insights/member-growth/:id returns data', async () => {
    const m = await request(app).post('/api/members').send({
      name: 'X', role: 'Dev', team: 'T',
      skills: [{ skillId: 'a', score: 80, assessedAt: '2025-01-01' }],
    });
    const r = await request(app).get(`/api/insights/member-growth/${m.body.id}`);
    expect(r.status).toBe(200);
    expect(r.body.memberId).toBe(m.body.id);
  });
});

describe('Server SSE endpoint', () => {
  let dir: string;
  let app: any;

  beforeEach(async () => {
    dir = await createTempDir();
    process.env.AI_TEAM_DATA_DIR = dir;
    process.env.AI_TEAM_TEST = '1';
    vi.resetModules();
    const { app: importedApp, sseManager } = await import('../src/index.js');
    app = importedApp;
    (global as any).sseManager = sseManager;
  });

  afterEach(async () => {
    delete process.env.AI_TEAM_DATA_DIR;
    delete process.env.AI_TEAM_TEST;
    vi.resetModules();
    await new Promise((r) => setTimeout(r, 50));
    await cleanupTempDir(dir);
  });

  it('GET /api/events/stream returns SSE headers', (done) => {
    request(app)
      .get('/api/events/stream')
      .on('response', (res) => {
        expect(res.headers['content-type']).toContain('text/event-stream');
        res.destroy();
        done();
      });
  });

  it.skip('Broadcasts event when candidate created', async () => {
    // SSE testing with supertest is tricky - skipping for now
  });
});
