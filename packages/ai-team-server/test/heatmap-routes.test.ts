// V23: Capability heatmap routes tests
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemberStore, JsonStore, nowIso } from '@ai-team/core';
import type { Member, Skill } from '@ai-team/core';
import { createHeatmapRouter } from '../src/routes/heatmap.js';

function makeApp() {
  const dir = mkdtempSync(join(tmpdir(), 'heatmap-rt-'));
  const memberStore = MemberStore.create(dir);
  const skillStore = new JsonStore<Skill>({ baseDir: dir, fileName: 'skills.json' });
  const app = express();
  app.use(express.json());
  app.use('/api/insights/capability-heatmap', createHeatmapRouter({ memberStore, skillStore }));
  return { app, memberStore, skillStore };
}

async function seedSkills(store: JsonStore<Skill>) {
  await store.add({ id: 'sk_ts', name: 'TypeScript', category: 'technical' });
  await store.add({ id: 'sk_react', name: 'React', category: 'technical' });
}

function mb(id: string, team: string, role: string, scored: Array<[string, number]>): Member {
  return {
    id, name: id, team, role, joinedAt: nowIso(),
    skills: scored.map(([skillId, score]) => ({ skillId, score, assessedAt: nowIso() })),
    trainings: [], reviews: [], status: 'active',
  };
}

describe('Heatmap routes', () => {
  let app: express.Express;
  let memberStore: MemberStore;
  let skillStore: JsonStore<Skill>;
  beforeEach(() => {
    const a = makeApp();
    app = a.app;
    memberStore = a.memberStore;
    skillStore = a.skillStore;
  });

  it('GET /api/insights/capability-heatmap returns empty report for no members', async () => {
    await seedSkills(skillStore);
    const r = await request(app).get('/api/insights/capability-heatmap');
    expect(r.status).toBe(200);
    expect(r.body.rows).toEqual([]);
    expect(r.body.cols).toHaveLength(2);
    expect(r.body.cells).toEqual([]);
    expect(r.body.overallAverage).toBe(0);
  });

  it('aggregates scores by team+role × skill', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'Web', 'FE', [['sk_ts', 80], ['sk_react', 60]]));
    await memberStore.add(mb('m2', 'Web', 'FE', [['sk_ts', 60], ['sk_react', 40]]));
    await memberStore.add(mb('m3', 'Ops', 'SRE', [['sk_ts', 90]]));
    const r = await request(app).get('/api/insights/capability-heatmap');
    expect(r.status).toBe(200);
    expect(r.body.rows).toHaveLength(2);
    const webTs = r.body.cells.find((c: any) => c.team === 'Web' && c.skillId === 'sk_ts');
    expect(webTs.averageScore).toBe(70);
    expect(webTs.coverageCount).toBe(2);
    expect(webTs.level).toBe('medium');
    const opsReact = r.body.cells.find((c: any) => c.team === 'Ops' && c.skillId === 'sk_react');
    expect(opsReact.coverageCount).toBe(0);
    expect(opsReact.level).toBe('critical');
  });

  it('respects targetScore query parameter', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'A', 'B', [['sk_ts', 50]]));
    const r = await request(app).get('/api/insights/capability-heatmap?target=80');
    const cell = r.body.cells.find((c: any) => c.skillId === 'sk_ts')!;
    expect(cell.gap).toBe(30);
  });

  it('respects minTeamSize query parameter', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'Big', 'Dev', [['sk_ts', 80]]));
    await memberStore.add(mb('m2', 'Big', 'Dev', [['sk_ts', 70]]));
    await memberStore.add(mb('m3', 'Solo', 'Dev', [['sk_ts', 90]]));
    const r = await request(app).get('/api/insights/capability-heatmap?minTeamSize=2');
    expect(r.body.rows).toHaveLength(1);
    expect(r.body.rows[0].team).toBe('Big');
  });

  it('clamps invalid target to default 70', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'A', 'B', [['sk_ts', 50]]));
    const r = await request(app).get('/api/insights/capability-heatmap?target=abc');
    const cell = r.body.cells.find((c: any) => c.skillId === 'sk_ts')!;
    expect(cell.gap).toBe(20); // 70-50
  });

  it('clamps out-of-range target to default 70', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'A', 'B', [['sk_ts', 50]]));
    const r = await request(app).get('/api/insights/capability-heatmap?target=500');
    const cell = r.body.cells.find((c: any) => c.skillId === 'sk_ts')!;
    expect(cell.gap).toBe(20);
  });

  it('clamps minTeamSize out-of-range to default 1', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'A', 'B', [['sk_ts', 80]]));
    const r = await request(app).get('/api/insights/capability-heatmap?minTeamSize=999');
    // 999 is out of range, default to 1 → row included
    expect(r.body.rows).toHaveLength(1);
  });

  it('uses default 1 when minTeamSize is non-numeric', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'A', 'B', [['sk_ts', 80]]));
    const r = await request(app).get('/api/insights/capability-heatmap?minTeamSize=abc');
    expect(r.body.rows).toHaveLength(1);
  });

  it('returns 500 on store failure', async () => {
    await seedSkills(skillStore);
    memberStore.list = async () => { throw new Error('boom'); };
    const r = await request(app).get('/api/insights/capability-heatmap');
    expect(r.status).toBe(500);
    expect(r.body.error).toBe('capability_heatmap_failed');
  });

  it('GET /api/insights/capability-heatmap/cell returns member detail', async () => {
    await seedSkills(skillStore);
    await memberStore.add(mb('m1', 'Web', 'FE', [['sk_ts', 80]]));
    await memberStore.add(mb('m2', 'Web', 'FE', [['sk_ts', 60]]));
    await memberStore.add(mb('m3', 'Web', 'FE', []));
    const r = await request(app).get('/api/insights/capability-heatmap/cell?team=Web&role=FE&skill=sk_ts');
    expect(r.status).toBe(200);
    expect(r.body.team).toBe('Web');
    expect(r.body.role).toBe('FE');
    expect(r.body.skillName).toBe('TypeScript');
    expect(r.body.coverageCount).toBe(2);
    expect(r.body.expectedCount).toBe(3);
    expect(r.body.averageScore).toBe(70);
    expect(r.body.members).toHaveLength(3);
    const scored = r.body.members.filter((m: any) => m.score !== null);
    expect(scored).toHaveLength(2);
  });

  it('GET /cell with missing query params returns 400', async () => {
    await seedSkills(skillStore);
    const r = await request(app).get('/api/insights/capability-heatmap/cell?team=Web');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('validation_error');
  });

  it('GET /cell with unknown skill returns 404', async () => {
    await seedSkills(skillStore);
    const r = await request(app).get('/api/insights/capability-heatmap/cell?team=Web&role=FE&skill=sk_missing');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('skill_not_found');
  });

  it('GET /cell with no members returns empty array', async () => {
    await seedSkills(skillStore);
    const r = await request(app).get('/api/insights/capability-heatmap/cell?team=Empty&role=FE&skill=sk_ts');
    expect(r.status).toBe(200);
    expect(r.body.members).toEqual([]);
    expect(r.body.coverageCount).toBe(0);
  });

  it('returns "unknown" fallback when thrown value is not an Error', async () => {
    await seedSkills(skillStore);
    memberStore.list = async () => { throw 'string-error'; };
    const r = await request(app).get('/api/insights/capability-heatmap');
    expect(r.status).toBe(500);
    expect(r.body.message).toBe('unknown');
  });

  it('response has generatedAt ISO', async () => {
    await seedSkills(skillStore);
    const r = await request(app).get('/api/insights/capability-heatmap');
    expect(new Date(r.body.generatedAt).toString()).not.toBe('Invalid Date');
  });
});