// Tests for specific stores - verify factory + entity-level CRUD
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  CandidateStore,
  MemberStore,
  InterviewStore,
  TrainingStore,
  ReviewStore,
  JsonStore,
} from '../src/store/index.js';
import type { Skill } from '../src/types/skill.js';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('store factory + entity stores', () => {
  let dir: string;
  beforeEach(async () => { dir = await createTempDir(); });
  afterEach(async () => { await cleanupTempDir(dir); });

  it('CandidateStore.create initializes empty file', async () => {
    const s = CandidateStore.create(dir);
    expect(await s.list()).toEqual([]);
    const exists = await fs.access(path.join(dir, 'candidates.json')).then(() => true).catch(() => false);
    // File may not exist until first write
    expect(exists).toBe(false);
  });

  it('CandidateStore.add + list round trip', async () => {
    const s = CandidateStore.create(dir);
    const c = await s.add({
      id: 'ct_test_1',
      name: 'Test',
      position: 'Engineer',
      source: 'website',
      status: 'new',
      createdAt: '2026-06-19T00:00:00.000Z',
      updatedAt: '2026-06-19T00:00:00.000Z',
    });
    expect(c.name).toBe('Test');
    expect(await s.list()).toHaveLength(1);
  });

  it('MemberStore round trip', async () => {
    const s = MemberStore.create(dir);
    const m = await s.add({
      id: 'mb_test_1',
      name: 'Alice',
      role: 'Dev',
      team: 'Team A',
      joinedAt: '2026-01-01T00:00:00.000Z',
      skills: [],
      trainings: [],
      reviews: [],
      status: 'active',
    });
    expect(await s.get('mb_test_1')).toBeDefined();
  });

  it('InterviewStore round trip', async () => {
    const s = InterviewStore.create(dir);
    const i = await s.add({
      id: 'iv_test_1',
      candidateId: 'ct_test_1',
      position: 'Engineer',
      type: 'technical',
      status: 'in_progress',
      turns: [],
      aiConducted: true,
    } as any);
    expect(i.id).toBe('iv_test_1');
  });

  it('TrainingStore round trip', async () => {
    const s = TrainingStore.create(dir);
    const t = await s.add({
      id: 'tr_test_1',
      memberId: 'mb_test_1',
      skillId: 'sk_react',
      type: 'course',
      title: 'Test',
      description: 'd',
      startDate: '2026-01-01',
      progress: 0,
      status: 'planned',
      milestones: [],
    });
    expect(t.title).toBe('Test');
  });

  it('ReviewStore round trip', async () => {
    const s = ReviewStore.create(dir);
    const r = await s.add({
      id: 'rv_test_1',
      memberId: 'mb_test_1',
      period: '2026-Q1',
      rating: 4,
      summary: 'good',
      achievements: ['a'],
      growthAreas: ['b'],
      nextGoals: ['c'],
      reviewedAt: '2026-01-01',
    });
    expect(r.rating).toBe(4);
  });

  it('Custom JsonStore for Skills', async () => {
    const s = new JsonStore<Skill>({ baseDir: dir, fileName: 'skills.json' });
    const sk = await s.add({ id: 'sk_test', name: 'React', category: 'technical' });
    expect(sk.name).toBe('React');
    expect(await s.list()).toHaveLength(1);
  });

  it('all stores coexist independently', async () => {
    const c = CandidateStore.create(dir);
    const m = MemberStore.create(dir);
    await c.add({ id: 'c1', name: 'X', position: 'P', source: 'website', status: 'new', createdAt: '', updatedAt: '' } as any);
    await m.add({ id: 'm1', name: 'Y', role: 'R', team: 'T', joinedAt: '', skills: [], trainings: [], reviews: [], status: 'active' } as any);
    expect(await c.list()).toHaveLength(1);
    expect(await m.list()).toHaveLength(1);
  });
});
