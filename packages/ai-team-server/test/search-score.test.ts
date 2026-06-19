// Server search + score-with-context tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('Server search + score endpoints', () => {
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

  describe('GET /api/search', () => {
    it('empty query returns empty', async () => {
      const r = await request(app).get('/api/search?q=');
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(0);
    });

    it('searches across all entities', async () => {
      await request(app).post('/api/candidates').send({ name: '张三', position: '前端', source: 'website' });
      await request(app).post('/api/members').send({ name: '李四', role: 'Dev', team: 'T' });
      const r = await request(app).get('/api/search?q=前');
      expect(r.status).toBe(200);
      expect(r.body.total).toBeGreaterThan(0);
    });

    it('filters by type', async () => {
      await request(app).post('/api/candidates').send({ name: 'Test', position: 'P', source: 'website' });
      const r = await request(app).get('/api/search?q=Test&type=candidate');
      expect(r.status).toBe(200);
      if (r.body.total > 0) {
        expect(r.body.results.every((x: any) => x.type === 'candidate')).toBe(true);
      }
    });

    it('includes duration', async () => {
      const r = await request(app).get('/api/search?q=any');
      expect(r.body).toHaveProperty('duration');
    });
  });

  describe('POST /api/resume/score-with-context', () => {
    it('requires resume and position', async () => {
      const r = await request(app).post('/api/resume/score-with-context').send({});
      expect(r.status).toBe(400);
    });

    it('returns structured score', async () => {
      const r = await request(app).post('/api/resume/score-with-context').send({
        resume: { name: 'X', position: 'Dev', skills: ['React'], yearsOfExperience: 5, experience: [], education: [], rawTextLength: 100 },
        position: 'Senior',
        requiredSkills: ['React', 'Kubernetes'],
      });
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty('overallScore');
      expect(r.body).toHaveProperty('teamGaps');
      expect(r.body).toHaveProperty('recommendation');
    });

    it('with job description', async () => {
      const r = await request(app).post('/api/resume/score-with-context').send({
        resume: { name: 'X', position: 'Dev', skills: ['React'] },
        position: 'Dev',
        jobDescription: 'Looking for React developer',
        requiredSkills: ['React'],
      });
      expect(r.status).toBe(200);
    });
  });
});
