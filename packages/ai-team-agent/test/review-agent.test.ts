// ReviewAgent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewAgent } from '../src/review-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member } from '@ai-team/core';

describe('ReviewAgent', () => {
  let agent: ReviewAgent;
  const member: Member = {
    id: 'mb_test_1',
    name: 'Alice',
    role: 'Engineer',
    team: 'Platform',
    level: 'P5',
    joinedAt: '2025-01-01T00:00:00.000Z',
    skills: [{ skillId: 'sk_react', score: 80, assessedAt: '2025-01-01T00:00:00.000Z' }],
    trainings: [],
    reviews: [],
    status: 'active',
  };

  beforeEach(() => {
    agent = new ReviewAgent(new MockClient());
  });

  it('generates a review draft', async () => {
    const draft = await agent.generateDraft({
      member,
      period: '2026-Q1',
      trainings: [],
      interviews: [],
      recentReviews: [],
      reviewer: 'Manager',
    });
    expect(draft.rating).toBeGreaterThanOrEqual(1);
    expect(draft.rating).toBeLessThanOrEqual(5);
    expect(draft.summary).toBeTruthy();
    expect(draft.achievements).toBeInstanceOf(Array);
    expect(draft.growthAreas).toBeInstanceOf(Array);
    expect(draft.nextGoals).toBeInstanceOf(Array);
  });

  it('handles member with skills for accurate rating', async () => {
    const draft = await agent.generateDraft({
      member,
      period: '2026-Q1',
      trainings: [],
      interviews: [],
      recentReviews: [],
    });
    expect(draft.rating).toBeDefined();
  });
});
