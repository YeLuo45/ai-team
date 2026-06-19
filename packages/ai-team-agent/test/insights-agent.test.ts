// Insights agent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { InsightsAgent, computeFunnel, computeSkillGaps, computeMemberGrowth, detectAnomalies } from '../src/insights-agent.js';
import { MockClient } from '@ai-team/ai';
import type { Member, Candidate, Interview, Review } from '@ai-team/core';

describe('computeFunnel', () => {
  it('computes stages from candidates', () => {
    const candidates: Candidate[] = [
      { id: '1', name: 'A', position: 'P', source: 'website', status: 'new', createdAt: '', updatedAt: '' },
      { id: '2', name: 'B', position: 'P', source: 'website', status: 'new', createdAt: '', updatedAt: '' },
      { id: '3', name: 'C', position: 'P', source: 'linkedin', status: 'hired', createdAt: '', updatedAt: '' },
    ];
    const r = computeFunnel(candidates, []);
    expect(r.stages.find((s) => s.stage === 'new')?.count).toBe(2);
    expect(r.stages.find((s) => s.stage === 'hired')?.count).toBe(1);
    expect(r.totalCandidates).toBe(3);
    expect(r.totalHired).toBe(1);
  });

  it('handles empty data', () => {
    const r = computeFunnel([], []);
    expect(r.totalCandidates).toBe(0);
    expect(r.overallRate).toBe(0);
  });

  it('groups by source', () => {
    const candidates: Candidate[] = [
      { id: '1', name: 'A', position: 'P', source: 'website', status: 'hired', createdAt: '', updatedAt: '' },
      { id: '2', name: 'B', position: 'P', source: 'website', status: 'new', createdAt: '', updatedAt: '' },
      { id: '3', name: 'C', position: 'P', source: 'linkedin', status: 'hired', createdAt: '', updatedAt: '' },
    ];
    const r = computeFunnel(candidates, []);
    const website = r.bySource.find((s) => s.source === 'website');
    expect(website?.total).toBe(2);
    expect(website?.hired).toBe(1);
    expect(website?.rate).toBe(0.5);
  });

  it('computes conversion rates', () => {
    const candidates: Candidate[] = [
      { id: '1', name: 'A', position: 'P', source: 's', status: 'new', createdAt: '', updatedAt: '' },
      { id: '2', name: 'B', position: 'P', source: 's', status: 'interviewing', createdAt: '', updatedAt: '' },
      { id: '3', name: 'C', position: 'P', source: 's', status: 'hired', createdAt: '', updatedAt: '' },
    ];
    const r = computeFunnel(candidates, []);
    expect(r.conversionRates.length).toBeGreaterThan(0);
  });
});

describe('computeSkillGaps', () => {
  const members: Member[] = [
    {
      id: '1', name: 'A', role: 'Dev', team: 'T',
      joinedAt: '2025-01-01T00:00:00.000Z',
      skills: [
        { skillId: 'sk_react', score: 90, assessedAt: '2025-01-01' },
        { skillId: 'sk_node', score: 60, assessedAt: '2025-01-01' },
      ],
      trainings: [], reviews: [], status: 'active',
    },
    {
      id: '2', name: 'B', role: 'Dev', team: 'T',
      joinedAt: '2025-01-01T00:00:00.000Z',
      skills: [
        { skillId: 'sk_react', score: 70, assessedAt: '2025-01-01' },
        { skillId: 'sk_k8s', score: 30, assessedAt: '2025-01-01' },
      ],
      trainings: [], reviews: [], status: 'active',
    },
  ];

  it('computes team average', () => {
    const gaps = computeSkillGaps(members);
    const react = gaps.find((g) => g.skill === 'sk_react');
    expect(react?.teamAvg).toBe(80);
    expect(react?.membersWithSkill).toBe(2);
  });

  it('marks required skills as high demand when low', () => {
    const gaps = computeSkillGaps(members, ['sk_k8s']);
    const k8s = gaps.find((g) => g.skill === 'sk_k8s');
    expect(k8s?.demandLevel).toBe('high');
  });

  it('sorts by demand level and gap', () => {
    const gaps = computeSkillGaps(members, ['sk_k8s']);
    // k8s should be first (high demand)
    expect(gaps[0].skill).toBe('sk_k8s');
  });

  it('handles empty members', () => {
    const gaps = computeSkillGaps([], []);
    expect(gaps).toEqual([]);
  });

  it('handles required skills not in any member', () => {
    const gaps = computeSkillGaps(members, ['sk_unknown']);
    const unknown = gaps.find((g) => g.skill === 'sk_unknown');
    expect(unknown?.teamAvg).toBe(0);
    expect(unknown?.demandLevel).toBe('high');
  });
});

describe('computeMemberGrowth', () => {
  const member: Member = {
    id: '1', name: 'A', role: 'Dev', team: 'T',
    joinedAt: '2024-01-01T00:00:00.000Z',
    skills: [
      { skillId: 'sk_react', score: 50, assessedAt: '2024-01-01' },
    ],
    trainings: [], reviews: [], status: 'active',
  };

  it('builds timeline from member joined date', () => {
    const reviews: Review[] = [
      {
        id: 'rv1', memberId: '1', period: '2024-Q2', rating: 4, summary: 'good',
        achievements: ['a'], growthAreas: [], nextGoals: [],
        reviewedAt: '2024-07-01',
      },
    ];
    const r = computeMemberGrowth(member, reviews);
    expect(r.timeline.length).toBeGreaterThan(1);
    expect(r.memberId).toBe('1');
  });

  it('computes growth between snapshots', () => {
    const reviews: Review[] = [
      {
        id: 'rv1', memberId: '1', period: '2025-Q1', rating: 4, summary: 'good',
        achievements: [], growthAreas: [], nextGoals: [],
        reviewedAt: '2025-04-01',
      },
    ];
    const r = computeMemberGrowth(member, reviews);
    expect(r.growth['sk_react']).toBeGreaterThan(0);
  });

  it('handles no reviews', () => {
    const r = computeMemberGrowth(member, []);
    expect(r.timeline.length).toBe(1);
  });
});

describe('detectAnomalies', () => {
  it('detects training stalled', () => {
    const member: Member = {
      id: '1', name: 'A', role: 'Dev', team: 'T',
      joinedAt: '2025-01-01T00:00:00.000Z',
      skills: [],
      trainings: [
        {
          id: 't1', memberId: '1', skillId: 'a', type: 'course',
          title: 'C', description: 'd', startDate: '2025-01-01',
          progress: 5, status: 'in_progress', milestones: [],
        },
      ],
      reviews: [], status: 'active',
    };
    const anomalies = detectAnomalies({ members: [member], candidates: [], interviews: [], reviews: [] });
    expect(anomalies.some((a) => a.type === 'training_stalled')).toBe(true);
  });

  it('detects review rating drop', () => {
    const member: Member = {
      id: '1', name: 'A', role: 'Dev', team: 'T',
      joinedAt: '2025-01-01T00:00:00.000Z',
      skills: [],
      trainings: [], reviews: [], status: 'active',
    };
    const reviews: Review[] = [
      { id: '1', memberId: '1', period: '2025-Q1', rating: 5, summary: 'a', achievements: [], growthAreas: [], nextGoals: [], reviewedAt: '2025-04-01' },
      { id: '2', memberId: '1', period: '2025-Q2', rating: 2, summary: 'b', achievements: [], growthAreas: [], nextGoals: [], reviewedAt: '2025-07-01' },
    ];
    const anomalies = detectAnomalies({ members: [member], candidates: [], interviews: [], reviews });
    const drop = anomalies.find((a) => a.type === 'review_drop');
    expect(drop).toBeDefined();
    expect(drop?.severity).toBe('critical');
  });

  it('detects skill stagnation (no skills)', () => {
    const member: Member = {
      id: '1', name: 'A', role: 'Dev', team: 'T',
      joinedAt: '2025-01-01T00:00:00.000Z',
      skills: [],
      trainings: [], reviews: [], status: 'active',
    };
    const anomalies = detectAnomalies({ members: [member], candidates: [], interviews: [], reviews: [] });
    expect(anomalies.some((a) => a.type === 'skill_stagnation')).toBe(true);
  });

  it('no anomalies for clean team', () => {
    const member: Member = {
      id: '1', name: 'A', role: 'Dev', team: 'T',
      joinedAt: '2025-01-01T00:00:00.000Z',
      skills: [{ skillId: 'a', score: 80, assessedAt: '2025-01-01' }],
      trainings: [], reviews: [], status: 'active',
    };
    const anomalies = detectAnomalies({ members: [member], candidates: [], interviews: [], reviews: [] });
    expect(anomalies).toEqual([]);
  });
});

describe('InsightsAgent', () => {
  let agent: InsightsAgent;

  beforeEach(() => {
    agent = new InsightsAgent(new MockClient());
  });

  it('analyzes context and returns recommendations', async () => {
    const members: Member[] = [
      {
        id: '1', name: 'A', role: 'Dev', team: 'T',
        joinedAt: '2025-01-01T00:00:00.000Z',
        skills: [{ skillId: 'a', score: 80, assessedAt: '2025-01-01' }],
        trainings: [], reviews: [], status: 'active',
      },
    ];
    const r = await agent.analyze({ members, candidates: [], interviews: [], reviews: [] });
    expect(r.recommendations).toBeInstanceOf(Array);
    expect(r.anomalies).toBeInstanceOf(Array);
  });

  it('with required skills', async () => {
    const r = await agent.analyze({
      members: [],
      candidates: [],
      interviews: [],
      reviews: [],
      requiredSkills: ['Kubernetes', 'React'],
    });
    expect(r).toBeDefined();
  });

  it('handles malformed LLM response', async () => {
    const r = await agent.analyze({ members: [], candidates: [], interviews: [], reviews: [] });
    // Should not throw, returns fallback
    expect(r).toBeDefined();
  });
});
