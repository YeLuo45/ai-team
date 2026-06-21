// V24: Demo data factory tests
import { describe, it, expect } from 'vitest';
import {
  SEED_SIZE_SPECS, generateCandidates, generateMembers, generateSkills,
  generateInterviews, generateTrainings, generateReviews, generateSeed,
} from '../src/seed.js';

describe('SEED_SIZE_SPECS', () => {
  it('defines small/medium/large sizes', () => {
    expect(SEED_SIZE_SPECS.small.candidates).toBeLessThan(SEED_SIZE_SPECS.medium.candidates);
    expect(SEED_SIZE_SPECS.medium.candidates).toBeLessThan(SEED_SIZE_SPECS.large.candidates);
  });
});

describe('generateCandidates', () => {
  it('generates N candidates with required fields', () => {
    const cs = generateCandidates(5);
    expect(cs).toHaveLength(5);
    for (const c of cs) {
      expect(c.id).toMatch(/^ct_/);
      expect(c.name).toBeTruthy();
      expect(c.position).toBeTruthy();
      expect(c.source).toBeTruthy();
      expect(c.status).toBeTruthy();
      expect(c.createdAt).toBeTruthy();
      expect(c.updatedAt).toBeTruthy();
    }
  });

  it('alternates phone presence', () => {
    const cs = generateCandidates(4);
    expect(cs[0].phone).toBeDefined();
    expect(cs[1].phone).toBeUndefined();
  });

  it('cycles through sources', () => {
    const cs = generateCandidates(7);
    const sources = new Set(cs.map((c) => c.source));
    expect(sources.size).toBeGreaterThan(1);
  });
});

describe('generateSkills', () => {
  it('returns N skills from templates', () => {
    const ss = generateSkills(4);
    expect(ss).toHaveLength(4);
    expect(ss[0].id).toMatch(/^sk_/);
    expect(ss[0].category).toBeTruthy();
  });

  it('caps at template count', () => {
    const ss = generateSkills(100);
    expect(ss.length).toBeLessThanOrEqual(8);
  });
});

describe('generateMembers', () => {
  it('generates N members with skills subset', () => {
    const skills = generateSkills(4);
    const ms = generateMembers(3, skills);
    expect(ms).toHaveLength(3);
    for (const m of ms) {
      expect(m.team).toBeTruthy();
      expect(m.role).toBeTruthy();
      expect(m.status === 'active' || m.status === 'on_leave' || m.status === 'exited').toBe(true);
      expect(m.skills.length).toBeGreaterThan(0);
    }
  });

  it('marks every 7th member on_leave', () => {
    const skills = generateSkills(4);
    const ms = generateMembers(14, skills);
    const onLeaveCount = ms.filter((m) => m.status === 'on_leave').length;
    expect(onLeaveCount).toBeGreaterThanOrEqual(1);
  });
});

describe('generateInterviews', () => {
  it('generates up to N interviews from candidate pool', () => {
    const cs = generateCandidates(5);
    const ivs = generateInterviews(3, cs);
    expect(ivs).toHaveLength(3);
    for (const iv of ivs) {
      expect(iv.candidateId).toBeTruthy();
      expect(iv.status).toBeTruthy();
      expect(iv.aiConducted).toBe(true);
    }
  });

  it('caps at candidate count', () => {
    const cs = generateCandidates(2);
    const ivs = generateInterviews(10, cs);
    expect(ivs.length).toBeLessThanOrEqual(2);
  });
});

describe('generateTrainings', () => {
  it('generates up to N trainings from member pool', () => {
    const skills = generateSkills(3);
    const ms = generateMembers(5, skills);
    const ts = generateTrainings(4, ms);
    expect(ts).toHaveLength(4);
    for (const t of ts) {
      expect(t.progress).toBeGreaterThanOrEqual(0);
      expect(t.progress).toBeLessThanOrEqual(100);
    }
  });
});

describe('generateReviews', () => {
  it('generates N reviews with rating 1-5', () => {
    const skills = generateSkills(3);
    const ms = generateMembers(4, skills);
    const rs = generateReviews(3, ms);
    expect(rs).toHaveLength(3);
    for (const r of rs) {
      expect([1, 2, 3, 4, 5]).toContain(r.rating);
      expect(r.period).toMatch(/^2026-Q[1-4]$/);
    }
  });
});

describe('generateSeed', () => {
  it('produces a complete small dataset', () => {
    const data = generateSeed('small', 42);
    const spec = SEED_SIZE_SPECS.small;
    expect(data.candidates).toHaveLength(spec.candidates);
    expect(data.members).toHaveLength(spec.members);
    expect(data.skills).toHaveLength(spec.skills);
    expect(data.interviews).toHaveLength(spec.interviews);
    expect(data.trainings).toHaveLength(spec.trainings);
    expect(data.reviews).toHaveLength(spec.reviews);
  });

  it('is deterministic for the same seed', () => {
    const a = generateSeed('small', 42);
    const b = generateSeed('small', 42);
    expect(a.candidates[0].name).toBe(b.candidates[0].name);
    expect(a.candidates[0].position).toBe(b.candidates[0].position);
  });

  it('produces a complete medium dataset', () => {
    const data = generateSeed('medium');
    expect(data.candidates.length).toBeGreaterThanOrEqual(10);
    expect(data.members.length).toBeGreaterThanOrEqual(5);
  });

  it('produces a complete large dataset', () => {
    const data = generateSeed('large');
    expect(data.candidates.length).toBeGreaterThanOrEqual(20);
  });
});