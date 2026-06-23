// V50: Org Memory injection into agent prompt builders
import { describe, it, expect } from 'vitest';
import {
  buildInterviewMessages,
  buildEvaluationMessages,
  buildTrainingPlanMessages,
  buildInsightsMessages,
  injectOrgMemory,
} from '../src/prompts/index.js';

describe('V50 injectOrgMemory', () => {
  it('returns unchanged messages when no org memory provided', () => {
    const base = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'u' },
    ];
    const out = injectOrgMemory(base);
    expect(out).toEqual(base);
  });

  it('appends org memory block to first system message', () => {
    const base = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'u' },
    ];
    const out = injectOrgMemory(base, 'Team: Growth\nFeedback: retention matters');
    expect(out[0].role).toBe('system');
    expect(out[0].content).toContain('sys');
    expect(out[0].content).toContain('Team: Growth');
    expect(out[0].content).toContain('Feedback: retention matters');
    expect(out[1].content).toBe('u');
  });

  it('prepends a system block when no system message exists', () => {
    const base = [{ role: 'user' as const, content: 'u' }];
    const out = injectOrgMemory(base, 'memory-text');
    expect(out[0].role).toBe('system');
    expect(out[0].content).toContain('memory-text');
    expect(out[1].content).toBe('u');
  });

  it('buildInterviewMessages accepts org memory and embeds it in system', () => {
    const messages = buildInterviewMessages('Frontend', 'Ada', 'resume text', [], 'org memory payload');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('org memory payload');
  });

  it('buildEvaluationMessages accepts org memory', () => {
    const messages = buildEvaluationMessages('Frontend', [], 'team memory');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('team memory');
  });

  it('buildTrainingPlanMessages accepts org memory', () => {
    const messages = buildTrainingPlanMessages('Ada', 'P5', 'P6', [], [], 'team memory');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('team memory');
  });

  it('buildInsightsMessages accepts org memory', () => {
    const messages = buildInsightsMessages(
      { members: [], candidates: 0, interviewsCompleted: 0, interviewsFailed: 0, averageScore: 0, requiredSkills: [] },
      'org memory insights',
    );
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('org memory insights');
  });
});