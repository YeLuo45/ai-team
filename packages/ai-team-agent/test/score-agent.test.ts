// Score Agent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreAgent } from '../src/score-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member, ExtractedResume } from '@ai-team/core';

describe('ScoreAgent', () => {
  let agent: ScoreAgent;
  const members: Member[] = [
    {
      id: '1', name: 'A', role: 'Dev', team: 'T', level: 'P6',
      joinedAt: '2020-01-01T00:00:00.000Z',
      skills: [
        { skillId: 'sk_react', score: 90, assessedAt: '2020-01-01' },
        { skillId: 'sk_kubernetes', score: 30, assessedAt: '2020-01-01' },
      ],
      trainings: [], reviews: [], status: 'active',
    },
  ];

  const resume: ExtractedResume = {
    name: 'Test',
    position: 'Senior Dev',
    yearsOfExperience: 5,
    skills: ['React', 'TypeScript', 'Docker'],
    experience: [],
    education: [],
    rawTextLength: 100,
  };

  beforeEach(() => {
    agent = new ScoreAgent(new MockClient());
  });

  it('scores with context', async () => {
    const r = await agent.scoreWithContext({
      resume,
      position: 'Senior',
      jobDescription: 'Looking for React + K8s',
      teamMembers: members,
      requiredSkills: ['React', 'Kubernetes', 'Docker'],
      skills: [],
    });
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.teamGaps.length).toBeGreaterThan(0);
  });

  it('identifies critical gaps', async () => {
    const r = await agent.scoreWithContext({
      resume,
      position: 'Senior',
      teamMembers: members,
      requiredSkills: ['Kubernetes'],
      skills: [],
    });
    const k8s = r.teamGaps.find((g) => g.skill === 'Kubernetes');
    expect(k8s?.importance).toBe('critical');
  });

  it('handles empty members', async () => {
    const r = await agent.scoreWithContext({
      resume,
      position: 'Dev',
      teamMembers: [],
      requiredSkills: ['React'],
      skills: [],
    });
    expect(r.teamGaps.length).toBe(1);
  });

  it('handles no required skills', async () => {
    const r = await agent.scoreWithContext({
      resume,
      position: 'Dev',
      teamMembers: members,
      requiredSkills: [],
      skills: [],
    });
    expect(r.teamGaps.length).toBe(0);
  });

  it('matches skills candidate has', async () => {
    const r = await agent.scoreWithContext({
      resume,
      position: 'Dev',
      teamMembers: members,
      requiredSkills: ['React', 'Kubernetes'],
      skills: [],
    });
    expect(r.consideredSkills).toEqual(['React', 'Kubernetes']);
  });
});
