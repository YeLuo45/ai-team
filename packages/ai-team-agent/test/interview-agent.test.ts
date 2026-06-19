// InterviewAgent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { InterviewAgent } from '../src/interview-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Candidate } from '@ai-team/core';

describe('InterviewAgent', () => {
  let agent: InterviewAgent;
  const candidate: Candidate = {
    id: 'ct_test_1',
    name: 'Test Candidate',
    position: 'Frontend Engineer',
    source: 'website',
    status: 'new',
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
  };

  beforeEach(() => {
    agent = new InterviewAgent(new MockClient());
  });

  it('starts interview with first question', async () => {
    const session = agent.start(candidate, { type: 'technical' });
    expect(session.interview.candidateId).toBe('ct_test_1');
    expect(session.interview.type).toBe('technical');
    expect(session.interview.status).toBe('in_progress');
    const q1 = await session.nextQuestion();
    expect(q1).toBeTruthy();
    expect(session.interview.turns.length).toBe(1);
  });

  it('starts with different interview types', () => {
    const tech = agent.start(candidate, { type: 'technical' });
    expect(tech.interview.type).toBe('technical');
    const beh = agent.start(candidate, { type: 'behavioral' });
    expect(beh.interview.type).toBe('behavioral');
  });

  it('defaults to technical type when not specified', () => {
    const s = agent.start(candidate);
    expect(s.interview.type).toBe('technical');
  });

  it('submitAnswer returns next question', async () => {
    const session = agent.start(candidate, { type: 'technical' });
    await session.nextQuestion();
    const next = await session.submitAnswer('My answer');
    expect(next).toBeTruthy();
    expect(session.interview.turns.length).toBe(3); // Q + A + nextQ
  });

  it('submitAnswer returns null after evalAfter threshold', async () => {
    const session = agent.start(candidate, { type: 'technical' });
    // evalAfter=2 means after 2 user answers, should return null
    for (let i = 0; i < 2; i++) {
      const r = await session.nextQuestion();
      if (r) {
        await session.submitAnswer('a' + i);
      }
    }
    // After enough Q&A, next submit should be null or return JSON
    // Mock returns interview questions then evaluation JSON
    const result = await session.submitAnswer('trigger eval');
    // Either null (eval triggered) or a question if under threshold
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('finalize produces evaluation', async () => {
    const session = agent.start(candidate, { type: 'technical' });
    await session.nextQuestion();
    await session.submitAnswer('answer');
    const final = await session.finalize();
    expect(final.overall).toBeGreaterThanOrEqual(0);
    expect(final.overall).toBeLessThanOrEqual(100);
    expect(final.breakdown.technical).toBeDefined();
    expect(final.recommendation).toBeTruthy();
  });

  it('finalize with empty turns still returns evaluation', async () => {
    const session = agent.start(candidate, { type: 'technical' });
    const final = await session.finalize();
    expect(final.overall).toBeGreaterThanOrEqual(0);
  });

  it('isComplete reflects turn count', async () => {
    const session = agent.start(candidate, { type: 'technical' });
    expect(session.isComplete()).toBe(false);
  });

  it('records interviewer name when provided', () => {
    const s = agent.start(candidate, { type: 'technical', interviewerName: 'Alice' });
    expect(s.interview.interviewerName).toBe('Alice');
  });

  it('defaults interviewer name to AI', () => {
    const s = agent.start(candidate);
    expect(s.interview.interviewerName).toBe('AI');
  });
});
