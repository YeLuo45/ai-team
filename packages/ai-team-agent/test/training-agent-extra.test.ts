// More training agent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { TrainingAgent } from '../src/training-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member } from '@ai-team/core';

describe('TrainingAgent - edge cases', () => {
  let agent: TrainingAgent;
  const member: Member = {
    id: 'm', name: 'A', role: 'R', team: 'T',
    joinedAt: '2025-01-01T00:00:00.000Z',
    skills: [
      { skillId: 'a', score: 100, assessedAt: '2025-01-01' },
      { skillId: 'b', score: 20, assessedAt: '2025-01-01' },
    ],
    trainings: [], reviews: [], status: 'active',
  };

  beforeEach(() => {
    agent = new TrainingAgent(new MockClient());
  });

  it('handles member with strong skills', async () => {
    const plan = await agent.generatePlan({
      member, targetRole: 'Tech Lead', skills: [], weaknessAreas: [],
    });
    expect(plan).toBeDefined();
  });

  it('handles weakness areas', async () => {
    const plan = await agent.generatePlan({
      member, targetRole: 'Senior', skills: [], weaknessAreas: ['System Design', 'Cloud'],
    });
    expect(plan.trainings.length).toBeGreaterThan(0);
  });

  it('handles target role with different skills', async () => {
    const plan = await agent.generatePlan({
      member, targetRole: 'Architect', skills: [], weaknessAreas: [],
    });
    expect(plan.expectedGrowth).toBeTruthy();
  });
});
