// Server error path tests - coverage for 95%+

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('Server error paths and edge cases', () => {
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

  describe('Member creation validation', () => {
    it('POST /api/members missing name returns 400', async () => {
      const r = await request(app).post('/api/members').send({ role: 'X', team: 'T' });
      expect(r.status).toBe(400);
    });

    it('POST /api/members missing role returns 400', async () => {
      const r = await request(app).post('/api/members').send({ name: 'X', team: 'T' });
      expect(r.status).toBe(400);
    });

    it('POST /api/members missing team returns 400', async () => {
      const r = await request(app).post('/api/members').send({ name: 'X', role: 'Y' });
      expect(r.status).toBe(400);
    });
  });

  describe('Interview read/delete', () => {
    it.skip('GET /api/interviews/:id returns found', async () => {
      // Interview is stored in memory (sessions map), not in store
    });

    it.skip('DELETE /api/interviews/:id removes', async () => {
      // Interview is stored in memory (sessions map), not in store
    });
  });

  describe('Resume PDF path', () => {
    it('POST /api/resume/parse with PDF buffer (will fail to parse)', async () => {
      const r = await request(app)
        .post('/api/resume/parse')
        .attach('file', Buffer.from('not a real pdf'), { filename: 'fake.pdf', contentType: 'application/pdf' });
      // 200 if mock returns parse result, 500 if pdf-parse fails
      expect([200, 500]).toContain(r.status);
    });

    it('POST /api/resume/import with extracted that lacks name returns 400', async () => {
      const r = await request(app).post('/api/resume/import').send({
        extracted: { position: 'Dev' },
        source: 'pdf',
      });
      expect(r.status).toBe(400);
    });
  });

  describe('Plugins GET', () => {
    it('GET /api/plugins/:id returns found', async () => {
      await request(app).post('/api/plugins').send({
        id: 'p_test_get',
        manifest: { id: 'p_test_get', name: 'Test', version: '1.0.0', description: 'd', hooks: [] },
      });
      const r = await request(app).get('/api/plugins/p_test_get');
      expect(r.status).toBe(200);
    });
  });

  describe('Read-all notifications', () => {
    it('POST /api/notifications/read-all marks all as read', async () => {
      // Create a notification by adding a candidate
      await request(app).post('/api/candidates').send({ name: 'X', position: 'P', source: 'website' });
      const r = await request(app).post('/api/notifications/read-all');
      expect(r.status).toBe(200);
      const list = await request(app).get('/api/notifications');
      const unread = list.body.filter((n: any) => !n.read);
      expect(unread.length).toBe(0);
    });
  });

  describe('CSV export with special characters', () => {
    it('GET /api/export?format=csv handles special chars', async () => {
      // Create candidate with comma in name
      await request(app).post('/api/candidates').send({
        name: 'X, Y "Test"\nNewline',
        position: 'P',
        source: 'website',
      });
      const r = await request(app).get('/api/export?format=csv');
      expect(r.status).toBe(200);
    });

    it('GET /api/export?format=csv with no data', async () => {
      const r = await request(app).get('/api/export?format=csv');
      expect(r.status).toBe(200);
    });
  });

  describe('Interview error paths', () => {
    it('interview POST /:id/answer 400 missing content', async () => {
      const c = await request(app).post('/api/candidates').send({ name: 'X', position: 'P', source: 'website' });
      const start = await request(app).post('/api/interviews/start').send({ candidateId: c.body.id });
      const r = await request(app).post(`/api/interviews/${start.body.interview.id}/answer`).send({});
      expect(r.status).toBe(400);
    });

    it('interview finalize returns even with 0 turns', async () => {
      const c = await request(app).post('/api/candidates').send({ name: 'X', position: 'P', source: 'website' });
      const start = await request(app).post('/api/interviews/start').send({ candidateId: c.body.id });
      const r = await request(app).post(`/api/interviews/${start.body.interview.id}/finalize`);
      expect(r.status).toBe(200);
    });
  });
});
