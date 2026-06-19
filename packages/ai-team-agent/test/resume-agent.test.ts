// ResumeAgent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { ResumeAgent } from '../src/resume-agent.js';
import { MockClient } from '@ai-team/ai';
import type { ExtractedResume } from '../src/resume-agent.js';

describe('ResumeAgent', () => {
  let agent: ResumeAgent;

  beforeEach(() => {
    agent = new ResumeAgent(new MockClient());
  });

  it('extracts resume info from text', async () => {
    const resume: ExtractedResume = await agent.extract('Sample resume text');
    expect(resume.name).toBeTruthy();
    expect(resume.position).toBeTruthy();
    expect(resume.skills).toBeInstanceOf(Array);
  });

  it('scores resume against job description', async () => {
    const score = await agent.scoreMatch(
      {
        name: 'X',
        position: 'Frontend',
        skills: ['React', 'TS'],
        experience: [],
        education: [],
        rawTextLength: 0,
      },
      'Need 5y React',
      'Senior Frontend'
    );
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.matchLevel).toBeTruthy();
  });

  it('converts resume to Candidate', () => {
    const candidate = agent.toCandidate({
      name: 'Test',
      position: 'Engineer',
      email: 't@e.com',
      phone: '1234',
      skills: ['JS'],
      experience: [],
      education: [],
      rawTextLength: 0,
    });
    expect(candidate.id).toMatch(/^ct_/);
    expect(candidate.name).toBe('Test');
    expect(candidate.position).toBe('Engineer');
    expect(candidate.email).toBe('t@e.com');
    expect(candidate.status).toBe('new');
  });

  it('handles missing optional fields in toCandidate', () => {
    const candidate = agent.toCandidate({
      name: 'X',
      position: 'Y',
      skills: [],
      experience: [],
      education: [],
      rawTextLength: 0,
    });
    expect(candidate.email).toBeUndefined();
    expect(candidate.phone).toBeUndefined();
  });
});
