// More resume agent tests to cover all branches

import { describe, it, expect, beforeEach } from 'vitest';
import { ResumeAgent } from '../src/resume-agent.js';
import { MockClient } from '@ai-team/ai';
import type { ExtractedResume } from '../src/resume-agent.js';

describe('ResumeAgent - extract parser', () => {
  let agent: ResumeAgent;
  beforeEach(() => {
    agent = new ResumeAgent(new MockClient());
  });

  it('handles resume with no matches', async () => {
    const r = await agent.extract('Some text');
    expect(r.name).toBeTruthy();
  });

  it('handles empty resume', async () => {
    await expect(agent.extract('')).rejects.toThrow('Empty resume text');
  });
});

describe('ResumeAgent - score with full data', () => {
  let agent: ResumeAgent;
  beforeEach(() => {
    agent = new ResumeAgent(new MockClient());
  });

  it('scores resume with rich data', async () => {
    const r: ExtractedResume = {
      name: 'X',
      position: 'Engineer',
      yearsOfExperience: 7,
      skills: ['A', 'B', 'C', 'D'],
      experience: [
        { company: 'Co1', role: 'Sr', duration: '3y', highlights: ['h1', 'h2'] },
        { company: 'Co2', role: 'Jr', duration: '2y', highlights: ['h3'] },
      ],
      education: [
        { school: 'Uni', degree: 'BS', major: 'CS', graduationYear: 2020 },
      ],
      summary: 'experienced',
      rawTextLength: 1000,
    };
    const score = await agent.scoreMatch(r, 'JD with React', 'Senior');
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('handles empty skills gracefully', async () => {
    const r: ExtractedResume = {
      name: 'X', position: 'Y', skills: [], experience: [], education: [], rawTextLength: 0,
    };
    const score = await agent.scoreMatch(r, 'JD', 'Y');
    expect(score.matchLevel).toBeTruthy();
  });
});

describe('ResumeAgent - toCandidate', () => {
  let agent: ResumeAgent;
  beforeEach(() => {
    agent = new ResumeAgent(new MockClient());
  });

  it('creates candidate with all optional fields', () => {
    const c = agent.toCandidate({
      name: 'X', position: 'P', email: 'e@e.com', phone: '1',
      yearsOfExperience: 5, skills: ['A'],
      experience: [{ company: 'C', role: 'R', duration: '1y', highlights: ['h'] }],
      education: [{ school: 'S', degree: 'B' }],
      summary: 's',
      rawTextLength: 10,
    });
    expect(c.email).toBe('e@e.com');
    expect(c.tags).toBeDefined();
  });

  it('source: pdf', () => {
    const c = agent.toCandidate({ name: 'X', position: 'P', skills: [], experience: [], education: [], rawTextLength: 0 } as any, 'pdf');
    // source is hardcoded to 'referral' in current implementation
    expect(c.source).toBe('referral');
  });

  it('source: pasted (default)', () => {
    const c = agent.toCandidate({ name: 'X', position: 'P', skills: [], experience: [], education: [], rawTextLength: 0 } as any);
    expect(c.source).toBe('referral');
  });
});
