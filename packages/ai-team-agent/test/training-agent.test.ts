// TrainingAgent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { TrainingAgent } from '../src/training-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member } from '@ai-team/core';

describe('TrainingAgent', () => {
  let agent: TrainingAgent;
  const member: Member = {
    id: 'mb_test_1',
    name: 'Alice',
    role: 'Senior Engineer',
    team: 'Platform',
    level: 'P6',
    joinedAt: '2026-01-01T00:00:00.000Z',
    skills: [
      { skillId: 'sk_js', score: 80, assessedAt: '2026-01-01T00:00:00.000Z' },
      { skillId: 'sk_react', score: 75, assessedAt: '2026-01-01T00:00:00.000Z' },
    ],
    trainings: [],
    reviews: [],
    status: 'active',
  };

  beforeEach(() => {
    agent = new TrainingAgent(new MockClient());
  });

  it('generates a training plan', async () => {
    const plan = await agent.generatePlan({
      member,
      targetRole: 'Tech Lead',
      skills: member.skills.map((s) => ({ name: s.skillId, score: s.score })),
      weaknessAreas: ['System Design'],
    });
    expect(plan.goals).toBeInstanceOf(Array);
    expect(plan.trainings).toBeInstanceOf(Array);
    expect(plan.expectedGrowth).toBeTruthy();
  });

  it('returns a valid plan structure', async () => {
    const plan = await agent.generatePlan({
      member,
      targetRole: 'Tech Lead',
      skills: [],
      weaknessAreas: [],
    });
    expect(plan.goals.length).toBeGreaterThan(0);
    expect(plan.trainings.length).toBeGreaterThan(0);
    for (const t of plan.trainings) {
      expect(t.title).toBeTruthy();
      expect(t.type).toBeTruthy();
      expect(t.durationWeeks).toBeGreaterThan(0);
    }
  });

  it('returns a valid plan with all training types', async () => {
    const plan = await agent.generatePlan({
      member,
      targetRole: 'Tech Lead',
      skills: [],
      weaknessAreas: [],
    });
    expect(plan.goals.length).toBeGreaterThan(0);
    expect(plan.trainings.length).toBeGreaterThan(0);
    for (const t of plan.trainings) {
      expect(t.title).toBeTruthy();
      expect(t.type).toBeTruthy();
      expect(t.durationWeeks).toBeGreaterThan(0);
      expect(t.resources).toBeInstanceOf(Array);
    }
  });
});
