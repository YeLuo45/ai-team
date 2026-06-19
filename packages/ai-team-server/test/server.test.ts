// Server endpoint tests using supertest

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('Server endpoints', () => {
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
    // Give time for file handles to close
    await new Promise((r) => setTimeout(r, 50));
    await cleanupTempDir(dir);
  });

  describe('Health', () => {
    it('GET /api/health returns ok', async () => {
      const r = await request(app).get('/api/health');
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ok');
    });
  });

  describe('Skills', () => {
    it('GET /api/skills returns empty array', async () => {
      const r = await request(app).get('/api/skills');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it('GET /api/skills/graph returns graph structure', async () => {
      const r = await request(app).get('/api/skills/graph');
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty('skills');
      expect(r.body).toHaveProperty('members');
      expect(r.body).toHaveProperty('links');
    });

    it('POST /api/skills creates skill', async () => {
      const r = await request(app).post('/api/skills').send({ id: 'sk_test', name: 'Test', category: 'technical' });
      expect(r.status).toBe(201);
      expect(r.body.name).toBe('Test');
    });

    it('GET /api/skills/:id returns 404 for missing', async () => {
      const r = await request(app).get('/api/skills/nonexistent');
      expect(r.status).toBe(404);
    });
  });

  describe('Candidates', () => {
    it('GET returns array', async () => {
      const r = await request(app).get('/api/candidates');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it('POST creates candidate', async () => {
      const r = await request(app).post('/api/candidates').send({
        name: 'Test', position: 'Dev', source: 'website', status: 'new',
      });
      expect([200, 201]).toContain(r.status);
      expect(r.body.name).toBe('Test');
      expect(r.body.id).toMatch(/^ct_/);
    });

    it('POST returns 400 if missing name', async () => {
      const r = await request(app).post('/api/candidates').send({ position: 'Dev' });
      expect(r.status).toBe(400);
    });

    it('GET /:id returns the candidate', async () => {
      const created = await request(app).post('/api/candidates').send({ name: 'X', position: 'Y', source: 'website' });
      const r = await request(app).get(`/api/candidates/${created.body.id}`);
      expect(r.status).toBe(200);
      expect(r.body.name).toBe('X');
    });

    it('GET /:id returns 404 for missing', async () => {
      const r = await request(app).get('/api/candidates/nonexistent');
      expect(r.status).toBe(404);
    });

    it('PUT updates candidate', async () => {
      const created = await request(app).post('/api/candidates').send({ name: 'X', position: 'Y', source: 'website' });
      const r = await request(app).put(`/api/candidates/${created.body.id}`).send({ status: 'interviewing' });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('interviewing');
    });

    it('DELETE removes candidate', async () => {
      const created = await request(app).post('/api/candidates').send({ name: 'X', position: 'Y', source: 'website' });
      const r = await request(app).delete(`/api/candidates/${created.body.id}`);
      expect(r.status).toBe(204);
    });
  });

  describe('Members', () => {
    it('GET returns array', async () => {
      const r = await request(app).get('/api/members');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it('POST creates member', async () => {
      const r = await request(app).post('/api/members').send({
        name: 'Alice', role: 'Dev', team: 'T', status: 'active',
      });
      expect(r.status).toBe(201);
      expect(r.body.name).toBe('Alice');
    });

    it('GET /:id returns member', async () => {
      const c = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).get(`/api/members/${c.body.id}`);
      expect(r.status).toBe(200);
    });

    it('GET /:id 404', async () => {
      const r = await request(app).get('/api/members/nope');
      expect(r.status).toBe(404);
    });

    it('PUT updates', async () => {
      const c = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).put(`/api/members/${c.body.id}`).send({ level: 'P7' });
      expect(r.status).toBe(200);
    });

    it('DELETE removes', async () => {
      const c = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).delete(`/api/members/${c.body.id}`);
      expect(r.status).toBe(204);
    });
  });

  describe('Interviews', () => {
    it('GET returns array', async () => {
      const r = await request(app).get('/api/interviews');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it('POST /start requires candidateId', async () => {
      const r = await request(app).post('/api/interviews/start').send({});
      expect(r.status).toBe(400);
    });

    it('POST /start creates interview session', async () => {
      const c = await request(app).post('/api/candidates').send({ name: 'X', position: 'Y', source: 'website' });
      const r = await request(app).post('/api/interviews/start').send({ candidateId: c.body.id, type: 'technical' });
      expect(r.status).toBe(201);
      expect(r.body.nextQuestion).toBeTruthy();
    });

    it('POST /:id/answer submits and gets next', async () => {
      const c = await request(app).post('/api/candidates').send({ name: 'X', position: 'Y', source: 'website' });
      const start = await request(app).post('/api/interviews/start').send({ candidateId: c.body.id });
      const r = await request(app).post(`/api/interviews/${start.body.interview.id}/answer`).send({ content: 'My answer' });
      expect(r.status).toBe(200);
    });

    it('POST /:id/finalize completes interview', async () => {
      const c = await request(app).post('/api/candidates').send({ name: 'X', position: 'Y', source: 'website' });
      const start = await request(app).post('/api/interviews/start').send({ candidateId: c.body.id });
      // Submit enough answers to trigger evaluation
      for (let i = 0; i < 10; i++) {
        const r = await request(app).post(`/api/interviews/${start.body.interview.id}/answer`).send({ content: `a${i}` });
        if (r.body.nextQuestion === null) break;
      }
      const f = await request(app).post(`/api/interviews/${start.body.interview.id}/finalize`);
      expect(f.status).toBe(200);
    });

    it('POST /:id/answer returns 404 for missing interview', async () => {
      const r = await request(app).post('/api/interviews/nope/answer').send({ content: 'x' });
      expect(r.status).toBe(404);
    });

    it('POST /:id/finalize 404 for missing', async () => {
      const r = await request(app).post('/api/interviews/nope/finalize');
      expect(r.status).toBe(404);
    });
  });

  describe('Trainings', () => {
    it('GET returns array', async () => {
      const r = await request(app).get('/api/trainings');
      expect(r.status).toBe(200);
    });

    it('POST creates training', async () => {
      const r = await request(app).post('/api/trainings').send({
        memberId: 'mb_test', skillId: 'sk_test', type: 'course', title: 'T', description: 'D',
        startDate: '2026-01-01', progress: 0, status: 'planned', milestones: [],
      });
      expect(r.status).toBe(201);
    });

    it('PUT updates', async () => {
      const c = await request(app).post('/api/trainings').send({
        memberId: 'mb_test', skillId: 'sk_test', type: 'course', title: 'T', description: 'D',
        startDate: '2026-01-01', progress: 0, status: 'planned', milestones: [],
      });
      const r = await request(app).put(`/api/trainings/${c.body.id}`).send({ progress: 50 });
      expect(r.status).toBe(200);
    });

    it('PUT 404 for missing', async () => {
      const r = await request(app).put('/api/trainings/nope').send({ progress: 50 });
      expect(r.status).toBe(404);
    });

    it('POST /generate requires memberId+position', async () => {
      const r = await request(app).post('/api/training-plans/generate').send({});
      expect(r.status).toBe(400);
    });

    it('POST /generate creates plan', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).post('/api/training-plans/generate').send({ memberId: m.body.id, position: 'Senior', targetRole: 'Lead' });
      expect([200, 201]).toContain(r.status);
    });
  });

  describe('Reviews', () => {
    it('GET returns array', async () => {
      const r = await request(app).get('/api/reviews');
      expect(r.status).toBe(200);
    });

    it('GET /member/:memberId returns array', async () => {
      const r = await request(app).get('/api/reviews/member/mb_test');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it('POST creates review', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).post('/api/reviews').send({
        memberId: m.body.id, period: '2026-Q1', rating: 4, summary: 'good',
        achievements: ['a'], growthAreas: ['b'], nextGoals: ['c'],
      });
      expect(r.status).toBe(201);
    });

    it('POST /:id creates second review returns 201', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).post('/api/reviews').send({
        memberId: m.body.id, period: '2026-Q2', rating: 5, summary: 'great',
        achievements: [], growthAreas: [], nextGoals: [],
      });
      expect(r.status).toBe(201);
    });

    it('POST /performance-reviews/generate', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).post('/api/performance-reviews/generate').send({
        memberId: m.body.id, period: '2026-Q1', reviewer: 'Manager',
      });
      expect(r.status).toBe(200);
      expect(r.body.rating).toBeDefined();
    });

    it('POST /performance-reviews/generate 400 if missing', async () => {
      const r = await request(app).post('/api/performance-reviews/generate').send({});
      expect(r.status).toBe(400);
    });
  });

  describe('One-on-one', () => {
    it('POST /start creates session', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const r = await request(app).post('/api/one-on-one/start').send({ memberId: m.body.id, scenario: 'career' });
      expect(r.status).toBe(201);
    });

    it('POST /:id/respond 404 for missing', async () => {
      const r = await request(app).post('/api/one-on-one/nope/respond').send({ content: 'x' });
      expect(r.status).toBe(404);
    });

    it('POST /:id/finalize 404 for missing', async () => {
      const r = await request(app).post('/api/one-on-one/nope/finalize');
      expect(r.status).toBe(404);
    });

    it('POST /start + respond + finalize', async () => {
      const m = await request(app).post('/api/members').send({ name: 'X', role: 'Y', team: 'T' });
      const start = await request(app).post('/api/one-on-one/start').send({ memberId: m.body.id });
      const r = await request(app).post(`/api/one-on-one/${start.body.session.id}/respond`).send({ content: 'hi' });
      expect(r.status).toBe(200);
      const f = await request(app).post(`/api/one-on-one/${start.body.session.id}/finalize`);
      expect(f.status).toBe(200);
    });
  });

  describe('Resume', () => {
    it('POST /parse with text', async () => {
      const r = await request(app).post('/api/resume/parse').send({ text: 'My resume text' });
      expect(r.status).toBe(200);
      expect(r.body.extracted).toBeDefined();
    });

    it('POST /parse without input returns 400', async () => {
      const r = await request(app).post('/api/resume/parse').send({});
      expect(r.status).toBe(400);
    });

    it('POST /score requires fields', async () => {
      const r = await request(app).post('/api/resume/score').send({});
      expect(r.status).toBe(400);
    });

    it('POST /score returns match', async () => {
      const r = await request(app).post('/api/resume/score').send({
        extracted: { name: 'X', position: 'P', skills: [], experience: [], education: [], rawTextLength: 0 },
        position: 'Senior',
      });
      expect(r.status).toBe(200);
      expect(r.body.overallScore).toBeDefined();
    });

    it('POST /import creates candidate', async () => {
      const r = await request(app).post('/api/resume/import').send({
        extracted: { name: 'Imported', position: 'Dev', skills: [], experience: [], education: [], rawTextLength: 0 },
        source: 'pasted',
      });
      expect([200, 201]).toContain(r.status);
    });

    it('POST /import 400 if missing fields', async () => {
      const r = await request(app).post('/api/resume/import').send({});
      expect(r.status).toBe(400);
    });
  });

  describe('Plugins', () => {
    it('GET /api/plugins returns array', async () => {
      const r = await request(app).get('/api/plugins');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it('GET /api/plugins/hooks/events returns events', async () => {
      const r = await request(app).get('/api/plugins/hooks/events');
      expect(r.status).toBe(200);
      expect(r.body.length).toBeGreaterThan(0);
    });

    it('GET /api/plugins/:id 404', async () => {
      const r = await request(app).get('/api/plugins/nope');
      expect(r.status).toBe(404);
    });

    it('POST /api/plugins requires id+manifest', async () => {
      const r = await request(app).post('/api/plugins').send({});
      expect(r.status).toBe(400);
    });

    it('POST /api/plugins creates', async () => {
      const r = await request(app).post('/api/plugins').send({
        id: 'test-plug',
        manifest: { id: 'test-plug', name: 'Test', version: '1.0.0', description: 'd', hooks: [] },
      });
      expect(r.status).toBe(201);
    });

    it('PUT /api/plugins/:id updates', async () => {
      await request(app).post('/api/plugins').send({
        id: 'p1', manifest: { id: 'p1', name: 'X', version: '1.0', description: 'd', hooks: [] },
      });
      const r = await request(app).put('/api/plugins/p1').send({ enabled: false });
      expect(r.status).toBe(200);
    });

    it('PUT 404 for missing', async () => {
      const r = await request(app).put('/api/plugins/nope').send({});
      expect(r.status).toBe(404);
    });

    it('POST /:id/toggle toggles', async () => {
      await request(app).post('/api/plugins').send({
        id: 'p2', manifest: { id: 'p2', name: 'X', version: '1.0', description: 'd', hooks: [] },
      });
      const r = await request(app).post('/api/plugins/p2/toggle');
      expect(r.status).toBe(200);
    });

    it('POST /:id/toggle 404', async () => {
      const r = await request(app).post('/api/plugins/nope/toggle');
      expect(r.status).toBe(404);
    });

    it('POST /:id/config updates config', async () => {
      await request(app).post('/api/plugins').send({
        id: 'p3', manifest: { id: 'p3', name: 'X', version: '1.0', description: 'd', hooks: [] },
      });
      const r = await request(app).post('/api/plugins/p3/config').send({ config: { key: 'value' } });
      expect(r.status).toBe(200);
    });

    it('POST /:id/config 404', async () => {
      const r = await request(app).post('/api/plugins/nope/config').send({ config: {} });
      expect(r.status).toBe(404);
    });

    it('DELETE /:id removes', async () => {
      await request(app).post('/api/plugins').send({
        id: 'p4', manifest: { id: 'p4', name: 'X', version: '1.0', description: 'd', hooks: [] },
      });
      const r = await request(app).delete('/api/plugins/p4');
      expect(r.status).toBe(204);
    });

    it('DELETE 404', async () => {
      const r = await request(app).delete('/api/plugins/nope');
      expect(r.status).toBe(404);
    });
  });

  describe('Notifications', () => {
    it('GET returns array', async () => {
      const r = await request(app).get('/api/notifications');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body)).toBe(true);
    });

    it('GET /unread/count', async () => {
      const r = await request(app).get('/api/notifications/unread/count');
      expect(r.status).toBe(200);
      expect(r.body.count).toBeDefined();
    });

    it('POST /:id/read 404', async () => {
      const r = await request(app).post('/api/notifications/nope/read');
      expect(r.status).toBe(404);
    });

    it('POST /read-all', async () => {
      const r = await request(app).post('/api/notifications/read-all');
      expect(r.status).toBe(200);
    });

    it('DELETE /:id 404', async () => {
      const r = await request(app).delete('/api/notifications/nope');
      expect(r.status).toBe(404);
    });

    it('full notification lifecycle', async () => {
      // Create a candidate to trigger notification
      await request(app).post('/api/candidates').send({ name: 'X', position: 'Y', source: 'website' });
      const list = await request(app).get('/api/notifications');
      if (list.body.length > 0) {
        const id = list.body[0].id;
        const r = await request(app).post(`/api/notifications/${id}/read`);
        expect(r.status).toBe(200);
        const d = await request(app).delete(`/api/notifications/${id}`);
        expect(d.status).toBe(204);
      }
    });
  });

  describe('Export/Import', () => {
    it('GET /api/export?format=json', async () => {
      const r = await request(app).get('/api/export?format=json');
      expect(r.status).toBe(200);
      expect(JSON.parse(r.text).candidates).toBeDefined();
    });

    it('GET /api/export?format=csv', async () => {
      const r = await request(app).get('/api/export?format=csv');
      expect(r.status).toBe(200);
    });

    it('GET /api/export?format=md', async () => {
      const r = await request(app).get('/api/export?format=md');
      expect(r.status).toBe(200);
    });

    it('GET /api/export invalid format', async () => {
      const r = await request(app).get('/api/export?format=invalid');
      expect(r.status).toBe(400);
    });

    it('POST /api/import invalid mode', async () => {
      const r = await request(app).post('/api/import?mode=invalid').send({ data: '{}' });
      expect(r.status).toBe(400);
    });

    it('POST /api/import requires data', async () => {
      const r = await request(app).post('/api/import?mode=merge').send({});
      expect(r.status).toBe(400);
    });

    it('POST /api/import invalid JSON', async () => {
      const r = await request(app).post('/api/import?mode=merge').send({ data: 'not json' });
      expect(r.status).toBe(400);
    });

    it('POST /api/import merge', async () => {
      const r = await request(app).post('/api/import?mode=merge').send({ data: JSON.stringify({ candidates: [{ id: 'ct_x', name: 'X', position: 'P', source: 's', status: 'new', createdAt: '', updatedAt: '' }] }) });
      expect(r.status).toBe(200);
    });

    it('POST /api/import replace', async () => {
      const r = await request(app).post('/api/import?mode=replace').send({ data: JSON.stringify({ candidates: [] }) });
      expect(r.status).toBe(200);
    });
  });

  describe('Team', () => {
    it('GET /api/team returns aggregated', async () => {
      const r = await request(app).get('/api/team');
      expect(r.status).toBe(200);
      expect(r.body.candidates).toBeDefined();
      expect(r.body.members).toBeDefined();
      expect(r.body.interviews).toBeDefined();
      expect(r.body.trainings).toBeDefined();
      expect(r.body.skills).toBeDefined();
      expect(r.body.reviews).toBeDefined();
    });

    it('GET /api/stats', async () => {
      const r = await request(app).get('/api/stats');
      expect(r.status).toBe(200);
      expect(r.body.activeMembers).toBeDefined();
    });
  });
});
