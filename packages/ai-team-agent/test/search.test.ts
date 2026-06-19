// Search engine tests

import { describe, it, expect } from 'vitest';
import { searchAll, highlight } from '../src/search.js';
import type { SearchDataInput } from '../src/search.js';

const baseData: SearchDataInput = {
  candidates: [
    { id: 'c1', name: '张三', position: '前端工程师', source: 'linkedin', status: 'new', createdAt: '2026-01-01', updatedAt: '2026-01-01', tags: ['React', 'TypeScript'] },
    { id: 'c2', name: '李四', position: '产品经理', source: 'website', status: 'interviewing', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ],
  members: [
    {
      id: 'm1', name: '王五', role: 'Tech Lead', team: 'Platform', level: 'P7', status: 'active',
      joinedAt: '2020-01-01T00:00:00.000Z',
      skills: [{ skillId: 'sk_react', score: 90, assessedAt: '2020-01-01' }],
      trainings: [], reviews: [],
    },
  ],
  interviews: [
    {
      id: 'i1', candidateId: 'c1', position: '前端工程师', type: 'technical',
      status: 'completed', turns: [{ role: 'interviewer', content: '解释一下 React hooks', timestamp: '2026-01-01' }],
      aiConducted: true, startedAt: '2026-01-01', completedAt: '2026-01-01',
    },
  ],
  skills: [
    { id: 'sk_react', name: 'React', category: 'technical' },
    { id: 'sk_node', name: 'Node.js', category: 'technical' },
  ],
  trainings: [
    { id: 't1', title: 'React 进阶', memberId: 'm1', type: 'course', status: 'in_progress' },
  ],
  reviews: [
    { id: 'r1', memberId: 'm1', period: '2025-Q4', rating: 4, summary: '表现优秀', achievements: ['完成 React 升级'], growthAreas: ['系统设计'], nextGoals: ['带新人'] },
  ],
};

describe('searchAll', () => {
  it('returns empty for empty query', () => {
    expect(searchAll('', baseData)).toEqual([]);
    expect(searchAll('   ', baseData)).toEqual([]);
  });

  it('finds candidates by name', () => {
    const r = searchAll('张三', baseData);
    expect(r.some((x) => x.type === 'candidate' && x.id === 'c1')).toBe(true);
  });

  it('finds candidates by tag', () => {
    const r = searchAll('TypeScript', baseData);
    expect(r.some((x) => x.type === 'candidate' && x.id === 'c1')).toBe(true);
  });

  it('finds members by skill', () => {
    const r = searchAll('sk_react', baseData);
    expect(r.some((x) => x.type === 'member' && x.id === 'm1')).toBe(true);
  });

  it('finds skills', () => {
    const r = searchAll('React', baseData);
    const skills = r.filter((x) => x.type === 'skill');
    expect(skills.length).toBeGreaterThan(0);
  });

  it('finds interview by turn content', () => {
    const r = searchAll('hooks', baseData);
    expect(r.some((x) => x.type === 'interview')).toBe(true);
  });

  it('finds reviews', () => {
    const r = searchAll('优秀', baseData);
    expect(r.some((x) => x.type === 'review')).toBe(true);
  });

  it('finds trainings', () => {
    const r = searchAll('进阶', baseData);
    expect(r.some((x) => x.type === 'training')).toBe(true);
  });

  it('filters by type', () => {
    const r = searchAll('react', baseData, { type: 'member' });
    expect(r.every((x) => x.type === 'member')).toBe(true);
  });

  it('sorts by score desc', () => {
    const r = searchAll('React', baseData);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    }
  });

  it('respects limit', () => {
    const r = searchAll('r', baseData, { limit: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it('returns snippet for matches', () => {
    const r = searchAll('张三', baseData);
    const c = r.find((x) => x.type === 'candidate');
    expect(c?.snippet).toBeTruthy();
  });

  it('case insensitive', () => {
    const r = searchAll('REACT', baseData);
    expect(r.length).toBeGreaterThan(0);
  });

  it('handles Chinese characters', () => {
    const r = searchAll('前端', baseData);
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('highlight', () => {
  it('wraps matches in <mark>', () => {
    const r = highlight('hello world hello', 'hello');
    expect(r).toContain('<mark>hello</mark>');
  });

  it('returns text unchanged for empty query', () => {
    expect(highlight('hello', '')).toBe('hello');
  });

  it('handles multiple matches', () => {
    const r = highlight('foo bar foo', 'foo');
    expect((r.match(/<mark>/g) || []).length).toBe(2);
  });

  it('case insensitive', () => {
    const r = highlight('Hello World', 'hello');
    expect(r.toLowerCase()).toContain('<mark>');
  });

  it('skips single-char tokens', () => {
    const r = highlight('abc', 'a');
    expect(r).not.toContain('<mark>');
  });
});
