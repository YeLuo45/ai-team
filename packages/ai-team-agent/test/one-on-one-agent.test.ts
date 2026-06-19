// OneOnOneAgent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { OneOnOneAgent } from '../src/one-on-one-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member } from '@ai-team/core';

describe('OneOnOneAgent', () => {
  let agent: OneOnOneAgent;
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
    agent = new OneOnOneAgent(new MockClient());
  });

  it('starts session and returns opening', async () => {
    const session = agent.start(member, { managerName: '王经理', scenario: 'career' });
    expect(session.memberId).toBe('mb_test_1');
    expect(session.scenario).toBe('career');
    expect(session.managerName).toBe('王经理');
    const opening = await agent.openingMessage(session, member);
    expect(opening).toBeTruthy();
    session.turns.push({ role: 'manager', content: opening, timestamp: new Date().toISOString() });
  });

  it('handles different scenarios', async () => {
    const s1 = agent.start(member, { scenario: 'performance' });
    expect(s1.scenario).toBe('performance');
    const s2 = agent.start(member, { scenario: 'project_retro' });
    expect(s2.scenario).toBe('project_retro');
  });

  it('respond returns member reply', async () => {
    const session = agent.start(member, { managerName: '王经理', scenario: 'career' });
    const reply = await agent.respond(session, member, '最近工作如何？');
    expect(reply).toBeTruthy();
  });

  it('generateSummary produces a structured summary', async () => {
    const session = agent.start(member, { managerName: '王经理', scenario: 'career' });
    const r1 = await agent.respond(session, member, '最近工作如何？');
    if (r1) session.turns.push({ role: 'member', content: r1, timestamp: new Date().toISOString() });
    const summary = await agent.generateSummary(session, member);
    expect(summary).toBeDefined();
    expect(summary.topics).toBeInstanceOf(Array);
    expect(summary.sentiment).toBeTruthy();
  });
});
