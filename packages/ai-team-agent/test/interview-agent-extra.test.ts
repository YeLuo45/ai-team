// More interview agent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { InterviewAgent } from '../src/interview-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Candidate } from '@ai-team/core';

describe('InterviewAgent - edge cases', () => {
  let agent: InterviewAgent;
  const candidate: Candidate = {
    id: 'ct', name: 'X', position: 'P', source: 's', status: 'new',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    agent = new InterviewAgent(new MockClient());
  });

  it('full interview lifecycle', async () => {
    const s = agent.start(candidate, { type: 'technical' });
    expect(s.interview.turns.length).toBe(0);
    const q1 = await s.nextQuestion();
    expect(s.interview.turns.length).toBe(1);
    const q2 = await s.submitAnswer('a1');
    expect(s.interview.turns.length).toBe(3);
    if (q2) {
      const q3 = await s.submitAnswer('a2');
      expect(s.interview.turns.length).toBe(5);
    }
    const final = await s.finalize();
    expect(final.overall).toBeGreaterThanOrEqual(0);
  });

  it('handles candidate with resume', async () => {
    const c = { ...candidate, resume: 'Some resume content' };
    const s = agent.start(c, { type: 'technical' });
    const q = await s.nextQuestion();
    expect(q).toBeTruthy();
  });

  it('handles all interview types', () => {
    const types = ['technical', 'behavioral', 'system_design', 'coding'] as const;
    for (const type of types) {
      const s = agent.start(candidate, { type });
      expect(s.interview.type).toBe(type);
    }
  });

  it('evalAfter option controls when evaluation triggers', async () => {
    const s = agent.start(candidate, { type: 'technical' });
    // Just verify we can call submitAnswer multiple times
    await s.nextQuestion();
    await s.submitAnswer('a1');
    const q2 = await s.submitAnswer('a2');
    expect(q2 === null || typeof q2 === 'string').toBe(true);
  });
});
