// More review agent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewAgent } from '../src/review-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member, Training, Review } from '@ai-team/core';

describe('ReviewAgent - full context', () => {
  let agent: ReviewAgent;
  beforeEach(() => {
    agent = new ReviewAgent(new MockClient());
  });

  const member: Member = {
    id: 'm1', name: 'A', role: 'Dev', team: 'T', level: 'P6',
    joinedAt: '2025-01-01T00:00:00.000Z',
    skills: [
      { skillId: 'a', score: 90, assessedAt: '2025-01-01' },
      { skillId: 'b', score: 80, assessedAt: '2025-01-01' },
    ],
    trainings: [],
    reviews: [],
    status: 'active',
  };

  it('includes recent reviews in summary', async () => {
    const reviews: Review[] = [
      {
        id: 'rv1', memberId: 'm1', period: '2025-Q4', rating: 4, summary: 'old',
        achievements: ['old a'], growthAreas: ['old b'], nextGoals: ['old c'],
        reviewedAt: '2025-12-01',
      },
    ];
    const draft = await agent.generateDraft({
      member, trainings: [], interviews: [],
      recentReviews: reviews,
      period: '2026-Q1', reviewer: 'M',
    });
    expect(draft.rating).toBeGreaterThanOrEqual(1);
  });

  it('handles empty trainings and interviews', async () => {
    const draft = await agent.generateDraft({
      member, trainings: [], interviews: [],
      recentReviews: [],
      period: '2026-Q1', reviewer: 'M',
    });
    expect(draft.growthAreas).toBeInstanceOf(Array);
  });

  it('handles trainings data', async () => {
    const trainings: Training[] = [
      {
        id: 't1', memberId: 'm1', skillId: 'a', type: 'course',
        title: 'Course', description: 'd', startDate: '2025-01-01',
        progress: 50, status: 'in_progress', milestones: [],
      },
    ];
    const draft = await agent.generateDraft({
      member, trainings, interviews: [],
      recentReviews: [],
      period: '2026-Q1', reviewer: 'M',
    });
    expect(draft.achievements).toBeInstanceOf(Array);
  });

  it('handles without reviewer name', async () => {
    const draft = await agent.generateDraft({
      member, trainings: [], interviews: [],
      recentReviews: [],
      period: '2026-Q1',
    });
    expect(draft.rating).toBeGreaterThanOrEqual(1);
  });
});
