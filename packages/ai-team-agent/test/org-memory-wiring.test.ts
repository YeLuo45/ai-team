// V50: InterviewAgent / TrainingAgent org memory wiring
import { describe, it, expect, vi } from 'vitest';
import { InterviewAgent, TrainingAgent } from '../src/index.js';
import { MockClient } from '@ai-team/ai';
import type { Candidate, Member } from '@ai-team/core';

const candidate: Candidate = {
  id: 'ct-1',
  name: 'Ada',
  position: 'Frontend',
  source: 'linkedin',
  status: 'new',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const member: Member = {
  id: 'm-1',
  name: 'Ada',
  role: 'P5',
  team: 'Platform',
  level: 'P5',
  status: 'active',
  joinedAt: '2026-01-01T00:00:00.000Z',
  skills: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('V50 agent org memory wiring', () => {
  it('InterviewAgent.setOrgMemory threads memory into chat messages', async () => {
    const llm = new MockClient();
    const chatSpy = vi.spyOn(llm, 'chat');
    const agent = new InterviewAgent(llm);
    agent.setOrgMemory('Team feedback: retention matters');

    const session = agent.start(candidate);
    await session.nextQuestion();

    expect(chatSpy).toHaveBeenCalled();
    const messages = chatSpy.mock.calls[0]?.[0].messages as Array<{ role: string; content: string }>;
    const system = messages.find((m) => m.role === 'system');
    expect(system?.content).toContain('Team feedback: retention matters');
    expect(system?.content).toContain('[ORG MEMORY]');
  });

  it('TrainingAgent.setOrgMemory threads memory into plan chat messages', async () => {
    const llm = new MockClient();
    const chatSpy = vi.spyOn(llm, 'chat');
    const agent = new TrainingAgent(llm);
    agent.setOrgMemory('Team preference: async reviews');

    await agent.generatePlan({ member, targetRole: 'P6', skills: [{ name: 'React', score: 70 }], weaknessAreas: ['Testing'] });

    expect(chatSpy).toHaveBeenCalled();
    const messages = chatSpy.mock.calls[0]?.[0].messages as Array<{ role: string; content: string }>;
    const system = messages.find((m) => m.role === 'system');
    expect(system?.content).toContain('Team preference: async reviews');
    expect(system?.content).toContain('[ORG MEMORY]');
  });
});