// Server edge case tests - error paths, validation, etc.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('Server edge cases and error paths', () => {
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

  describe('Skills edge cases', () => {
    it('POST /api/skills creates', async () => {
      const r = await request(app).post('/api/skills').send({ id: 'sk_e1', name: 'X', category: 'technical' });
      expect([200, 201]).toContain(r.status);
    });
  });

  describe('Candidates edge cases', () => {
    it('PUT 404 for missing', async () => {
      const r = await request(app).put('/api/candidates/nope').send({ status: 'interviewing' });
      expect(r.status).toBe(404);
    });

    it('DELETE 404 for missing', async () => {
      const r = await request(app).delete('/api/candidates/nope');
      expect(r.status).toBe(404);
    });
  });

  describe('Members edge cases', () => {
    it('PUT 404 for missing', async () => {
      const r = await request(app).put('/api/members/nope').send({ level: 'P7' });
      expect(r.status).toBe(404);
    });

    it('DELETE 404 for missing', async () => {
      const r = await request(app).delete('/api/members/nope');
      expect(r.status).toBe(404);
    });
  });

  describe('Interviews edge cases', () => {
    it('POST /start 404 for missing candidate', async () => {
      const r = await request(app).post('/api/interviews/start').send({ candidateId: 'nope' });
      expect(r.status).toBe(404);
    });
  });

  describe('Trainings edge cases', () => {
    it('POST requires fields', async () => {
      const r = await request(app).post('/api/trainings').send({});
      expect(r.status).toBe(400);
    });
  });

  describe('Reviews edge cases', () => {
    it('PUT updates', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const created = await request(app).post('/api/reviews').send({
        memberId: m.body.id, period: '2026-Q1', rating: 4, summary: 'good',
        achievements: ['a'], growthAreas: ['b'], nextGoals: ['c'],
      });
      const r = await request(app).put(`/api/reviews/${created.body.id}`).send({ rating: 5 });
      expect(r.status).toBe(200);
    });

    it('PUT 404 for missing', async () => {
      const r = await request(app).put('/api/reviews/nope').send({ rating: 5 });
      expect(r.status).toBe(404);
    });

    it('DELETE removes', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const created = await request(app).post('/api/reviews').send({
        memberId: m.body.id, period: '2026-Q1', rating: 4, summary: 'good',
        achievements: [], growthAreas: [], nextGoals: [],
      });
      const r = await request(app).delete(`/api/reviews/${created.body.id}`);
      expect(r.status).toBe(204);
    });

    it('DELETE 404 for missing', async () => {
      const r = await request(app).delete('/api/reviews/nope');
      expect(r.status).toBe(404);
    });
  });

  describe('One-on-one edge cases', () => {
    it('start with manager name', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).post('/api/one-on-one/start').send({
        memberId: m.body.id, scenario: 'career', managerName: 'Boss',
      });
      expect(r.status).toBe(201);
      expect(r.body.session.managerName).toBe('Boss');
    });
  });

  describe('Resume edge cases', () => {
    it('POST /parse with PDF buffer', async () => {
      // Test with a fake buffer (will fail to parse but should not 400)
      const r = await request(app)
        .post('/api/resume/parse')
        .attach('file', Buffer.from('not a real pdf'), 'fake.pdf');
      // Either 200 (mock returns some parse result) or 500 (PDF parser fails)
      expect([200, 500]).toContain(r.status);
    });
  });

  describe('Notifications edge cases', () => {
    it('POST /:id/read 404 for missing', async () => {
      const r = await request(app).post('/api/notifications/nope/read');
      expect(r.status).toBe(404);
    });

    it('DELETE 404 for missing', async () => {
      const r = await request(app).delete('/api/notifications/nope');
      expect(r.status).toBe(404);
    });
  });
});
