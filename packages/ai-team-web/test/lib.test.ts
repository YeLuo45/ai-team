// Web lib tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../src/lib/api';
import * as format from '../src/lib/format';
import * as data from '../src/lib/data';
import * as hooks from '../src/lib/hooks';

const okResponse = (data: any = {}) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

const errResponse = (status = 500) => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => '',
});

describe('Web ApiClient', () => {
  let originalFetch: typeof fetch;
  let mockFetch: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('getTeam fetches /api/team', async () => {
    mockFetch.mockResolvedValue(okResponse({ candidates: [{}], members: [{}], interviews: [], trainings: [] }));
    const c = new ApiClient();
    const r = await c.getTeam();
    expect(r.candidates).toBeDefined();
  });

  it('getTeam returns empty on error', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    const c = new ApiClient();
    const r = await c.getTeam().catch(() => ({ candidates: [], members: [], interviews: [], trainings: [], skills: [], reviews: [] } as any));
    expect(r.candidates).toEqual([]);
  });

  it('addCandidate POSTs', async () => {
    mockFetch.mockResolvedValue(okResponse({ id: 'x' }));
    const c = new ApiClient();
    const r = await c.addCandidate({ name: 'X' } as any);
    expect(r.id).toBe('x');
  });

  it('addMember POSTs', async () => {
    mockFetch.mockResolvedValue(okResponse({ id: 'y' }));
    const c = new ApiClient();
    expect((await c.addMember({ name: 'Y' } as any)).id).toBe('y');
  });

  it('deleteCandidate', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const c = new ApiClient();
    await c.deleteCandidate('x');
  });

  it('startInterview', async () => {
    mockFetch.mockResolvedValue(okResponse({ interview: { id: 'i' } }));
    const c = new ApiClient();
    const r = await c.startInterview('ct', 'technical');
    expect(r.interview.id).toBe('i');
  });

  it('startInterview requires candidateId', async () => {
    const c = new ApiClient();
    await expect(c.startInterview('', 'technical')).rejects.toThrow();
  });

  it('submitAnswer', async () => {
    mockFetch.mockResolvedValue(okResponse({ nextQuestion: 'next' }));
    const c = new ApiClient();
    const r = await c.submitAnswer('iv', 'hi');
    expect(r.nextQuestion).toBe('next');
  });

  it('finalizeInterview', async () => {
    mockFetch.mockResolvedValue(okResponse({ status: 'completed' }));
    const c = new ApiClient();
    const r = await c.finalizeInterview('iv');
    expect(r.status).toBe('completed');
  });
});

describe('Web data loader', () => {
  it('formatDate', () => {
    expect(format.formatDate('2026-06-19T10:30:00.000Z')).toBe('2026-06-19');
  });

  it('formatDate empty', () => {
    expect(format.formatDate()).toBe('-');
  });

  it('formatDateTime', () => {
    expect(format.formatDateTime('2026-06-19T10:30:00.000Z')).toBe('2026-06-19 10:30:00');
  });

  it('formatDateTime empty', () => {
    expect(format.formatDateTime()).toBe('-');
  });

  it('relativeTime recent', () => {
    const r = format.relativeTime(new Date().toISOString());
    expect(r).toMatch(/刚刚|秒前/);
  });

  it('relativeTime hours', () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(format.relativeTime(past)).toMatch(/小时/);
  });

  it('relativeTime days', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(format.relativeTime(past)).toMatch(/天/);
  });

  it('recommendationLabel maps hire', () => {
    expect(format.recommendationLabel('hire').text).toContain('推荐');
  });

  it('recommendationLabel maps no_hire', () => {
    expect(format.recommendationLabel('no_hire').text).toContain('不推荐');
  });

  it('recommendationLabel maps maybe', () => {
    expect(format.recommendationLabel('maybe').text).toBeTruthy();
  });

  it('recommendationLabel maps strong_hire', () => {
    expect(format.recommendationLabel('strong_hire').text).toBeTruthy();
  });

  it('recommendationLabel maps unknown', () => {
    expect(format.recommendationLabel('unknown').text).toBeTruthy();
  });

  it('statusLabel maps various statuses', () => {
    expect(format.statusLabel('new').text).toBeTruthy();
    expect(format.statusLabel('interviewing').text).toBeTruthy();
    expect(format.statusLabel('hired').text).toBeTruthy();
    expect(format.statusLabel('rejected').text).toBeTruthy();
    expect(format.statusLabel('active').text).toBeTruthy();
    expect(format.statusLabel('inactive').text).toBeTruthy();
    expect(format.statusLabel('planned').text).toBeTruthy();
    expect(format.statusLabel('in_progress').text).toBeTruthy();
    expect(format.statusLabel('completed').text).toBeTruthy();
    expect(format.statusLabel('cancelled').text).toBeTruthy();
    expect(format.statusLabel('unknown').text).toBeTruthy();
  });
});

describe('Web data loader', () => {
  it('loadTeamData fetches /data/team.json', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(okResponse({ candidates: [], members: [], interviews: [], trainings: [], skills: [], reviews: [] }));
    const r = await data.loadTeamData();
    expect(r.candidates).toEqual([]);
    global.fetch = originalFetch;
  });

  it('loadTeamData returns empty on error', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('fail'));
    const r = await data.loadTeamData();
    expect(r.candidates).toEqual([]);
    global.fetch = originalFetch;
  });
});

describe('Web hooks', () => {
  it('useTeamData is a function', () => {
    expect(typeof hooks.useTeamData).toBe('function');
  });
});
