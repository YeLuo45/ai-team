// Mock client tests - context detection + response generation

import { describe, it, expect } from 'vitest';
import { MockClient } from '../src/providers/mock.js';

describe('MockClient context detection', () => {
  const c = new MockClient();

  it('isTrainingContext detects training', () => {
    expect(c['isTrainingContext']([{ role: 'user', content: '请生成培训计划' }])).toBe(true);
    expect(c['isTrainingContext']([{ role: 'user', content: 'make training plan' }])).toBe(true);
    expect(c['isTrainingContext']([{ role: 'user', content: 'unrelated' }])).toBe(false);
  });

  it('isReviewContext detects review', () => {
    expect(c['isReviewContext']([{ role: 'user', content: '请生成 Review' }])).toBe(true);
    expect(c['isReviewContext']([{ role: 'user', content: '绩效评估' }])).toBe(true);
    expect(c['isReviewContext']([{ role: 'user', content: 'unrelated' }])).toBe(false);
  });

  it('isOneOnOneContext detects 1:1', () => {
    expect(c['isOneOnOneContext']([{ role: 'user', content: '1:1 沟通' }])).toBe(true);
    expect(c['isOneOnOneContext']([{ role: 'user', content: '扮演员工' }])).toBe(true);
    expect(c['isOneOnOneContext']([{ role: 'user', content: 'unrelated' }])).toBe(false);
  });

  it('isResumeContext detects resume', () => {
    expect(c['isResumeContext']([{ role: 'user', content: '简历解析助手' }])).toBe(true);
    expect(c['isResumeContext']([{ role: 'user', content: '候选人简历' }])).toBe(true);
    expect(c['isResumeContext']([{ role: 'user', content: '岗位匹配' }])).toBe(true);
    expect(c['isResumeContext']([{ role: 'user', content: 'unrelated' }])).toBe(false);
  });
});

describe('MockClient.chat context routing', () => {
  const c = new MockClient();

  it('returns training plan for training context', async () => {
    const r = await c.chat({
      messages: [
        { role: 'system', content: '培训' },
        { role: 'user', content: '请生成培训计划' },
      ],
    });
    expect(r.content).toContain('goals');
    expect(r.content).toContain('trainings');
    expect(r.model).toBe('mock-1.0');
  });

  it('returns review JSON for review context', async () => {
    const r = await c.chat({
      messages: [
        { role: 'system', content: 'Review' },
        { role: 'user', content: '绩效评估' },
      ],
    });
    const parsed = JSON.parse(r.content);
    expect(parsed.rating).toBe(4);
    expect(parsed.achievements).toBeInstanceOf(Array);
  });

  it('returns resume extract for resume context', async () => {
    const r = await c.chat({
      messages: [
        { role: 'system', content: '简历解析助手' },
        { role: 'user', content: '候选人简历文本' },
      ],
    });
    const parsed = JSON.parse(r.content);
    expect(parsed.name).toBe('张三');
    expect(parsed.skills).toBeInstanceOf(Array);
  });

  it('returns score for resume+JD context', async () => {
    const r = await c.chat({
      messages: [
        { role: 'system', content: '简历解析助手' },
        { role: 'user', content: '岗位描述: 高级前端需要 5 年 React 经验' },
      ],
    });
    const parsed = JSON.parse(r.content);
    expect(parsed.overallScore).toBe(82);
  });

  it('returns 1:1 dialog for one-on-one context', async () => {
    const r1 = await c.chat({
      messages: [
        { role: 'system', content: '1:1 沟通' },
        { role: 'user', content: '扮演员工' },
      ],
    });
    expect(r1.content).toContain('工作');
  });

  it('returns interview question as fallback', async () => {
    const r = await c.chat({
      messages: [
        { role: 'system', content: '面试' },
        { role: 'user', content: '请开始' },
      ],
    });
    // Mock returns one of 5 questions
    expect(r.content.length).toBeGreaterThan(0);
    expect(r.content).toMatch(/你|您|我们/);
  });

  it('isTrainingContext is true when only training keyword present', () => {
    expect(c['isTrainingContext']([{ role: 'user', content: 'training plan please' }])).toBe(true);
  });

  it('isReviewContext catches both keywords', () => {
    expect(c['isReviewContext']([{ role: 'user', content: 'something 评估' }])).toBe(true);
  });

  it('isResumeContext with all 3 keywords', () => {
    expect(c['isResumeContext']([{ role: 'user', content: '简历解析助手 with 候选人简历 and 岗位匹配' }])).toBe(true);
  });

  it('cycles through interview questions', async () => {
    const responses: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await c.chat({
        messages: [
          { role: 'system', content: '面试' },
          { role: 'user', content: `Q${i}` },
        ],
      });
      responses.push(r.content);
    }
    // After 5 turns mock returns evaluation
    expect(responses[5]).toContain('overall');
  });
});

describe('MockClient.chatStream', () => {
  const c = new MockClient();

  it('streams response via callback', async () => {
    const chunks: string[] = [];
    const r = await c.chatStream(
      { messages: [{ role: 'user', content: 'hi' }] },
      (chunk) => chunks.push(chunk.delta)
    );
    expect(chunks.length).toBeGreaterThan(0);
    expect(r.content.length).toBeGreaterThan(0);
  });
});
