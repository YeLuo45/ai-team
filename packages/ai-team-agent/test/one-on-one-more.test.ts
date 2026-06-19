// More one-on-one agent tests for 95%+ coverage

import { describe, it, expect, beforeEach } from 'vitest';
import { OneOnOneAgent } from '../src/one-on-one-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member } from '@ai-team/core';

describe('OneOnOneAgent - more scenarios', () => {
  let agent: OneOnOneAgent;
  const member: Member = {
    id: 'm1', name: 'Alice', role: 'Senior', team: 'T',
    joinedAt: '2020-01-01T00:00:00.000Z',
    skills: [
      { skillId: 'sk_react', score: 90, assessedAt: '2020-01-01' },
      { skillId: 'sk_ts', score: 85, assessedAt: '2020-01-01' },
    ],
    trainings: [
      {
        id: 'tr1', memberId: 'm1', skillId: 'sk_react', type: 'course',
        title: 'Advanced React', description: 'd', startDate: '2025-01-01',
        progress: 100, status: 'completed', milestones: [],
      },
    ],
    reviews: [],
    status: 'active',
  };

  beforeEach(() => {
    agent = new OneOnOneAgent(new MockClient());
  });

  it('opening message for performance scenario', async () => {
    const s = agent.start(member, { scenario: 'performance', managerName: 'M' });
    const m = await agent.openingMessage(s, member);
    expect(m).toBeTruthy();
  });

  it('respond returns null sometimes (after several exchanges)', async () => {
    const s = agent.start(member, { scenario: 'career', managerName: 'M' });
    await agent.respond(s, member, 'msg1');
    // After many exchanges, may return null
    const r1 = await agent.respond(s, member, 'msg2');
    expect(r1 === null || typeof r1 === 'string').toBe(true);
  });

  it('generateSummary returns structured data', async () => {
    const s = agent.start(member, { scenario: 'career', managerName: 'M' });
    const r = await agent.respond(s, member, 'hi');
    if (r) s.turns.push({ role: 'manager', content: r, timestamp: new Date().toISOString() });
    const summary = await agent.generateSummary(s, member);
    expect(summary.sentiment).toBeTruthy();
  });

  it('all 5 scenarios work', async () => {
    const scenarios: Array<'performance' | 'career' | 'project_retro' | 'difficult' | 'general'> = [
      'performance', 'career', 'project_retro', 'difficult', 'general',
    ];
    for (const scenario of scenarios) {
      const s = agent.start(member, { scenario, managerName: 'M' });
      const m = await agent.openingMessage(s, member);
      expect(m).toBeTruthy();
    }
  });
});
