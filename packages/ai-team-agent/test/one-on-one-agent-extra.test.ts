// More one-on-one agent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { OneOnOneAgent } from '../src/one-on-one-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member } from '@ai-team/core';

describe('OneOnOneAgent - all scenarios', () => {
  let agent: OneOnOneAgent;
  const member: Member = {
    id: 'm', name: 'A', role: 'R', team: 'T',
    joinedAt: '2025-01-01T00:00:00.000Z',
    skills: [{ skillId: 'a', score: 80, assessedAt: '2025-01-01' }],
    trainings: [], reviews: [], status: 'active',
  };

  beforeEach(() => {
    agent = new OneOnOneAgent(new MockClient());
  });

  it('handles performance scenario', async () => {
    const s = agent.start(member, { scenario: 'performance', managerName: 'M' });
    expect(s.scenario).toBe('performance');
    const opening = await agent.openingMessage(s, member);
    expect(opening).toBeTruthy();
  });

  it('handles project_retro scenario', async () => {
    const s = agent.start(member, { scenario: 'project_retro', managerName: 'M' });
    const opening = await agent.openingMessage(s, member);
    expect(opening).toBeTruthy();
  });

  it('handles difficult scenario', async () => {
    const s = agent.start(member, { scenario: 'difficult', managerName: 'M' });
    const opening = await agent.openingMessage(s, member);
    expect(opening).toBeTruthy();
  });

  it('handles general scenario', async () => {
    const s = agent.start(member, { scenario: 'general', managerName: 'M' });
    const opening = await agent.openingMessage(s, member);
    expect(opening).toBeTruthy();
  });

  it('full dialog flow', async () => {
    const s = agent.start(member, { scenario: 'career', managerName: 'M' });
    const r1 = await agent.respond(s, member, 'hi');
    if (r1) s.turns.push({ role: 'manager', content: r1, timestamp: new Date().toISOString() });
    const r2 = await agent.respond(s, member, 'how are you');
    if (r2) s.turns.push({ role: 'manager', content: r2, timestamp: new Date().toISOString() });
    const summary = await agent.generateSummary(s, member);
    expect(summary.topics).toBeInstanceOf(Array);
  });
});
