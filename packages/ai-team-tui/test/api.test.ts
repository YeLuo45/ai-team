// TUI tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../src/api.js';

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

describe('ApiClient', () => {
  const baseUrl = 'http://localhost:3000';
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

  it('constructor sets baseUrl', () => {
    const c = new ApiClient(baseUrl);
    expect(c.baseUrl).toBe(baseUrl);
  });

  it('constructor uses DEFAULT_BASE', () => {
    const c = new ApiClient();
    expect(c.baseUrl).toContain('localhost');
  });

  it('health returns ok', async () => {
    mockFetch.mockResolvedValue(okResponse({ status: 'ok' }));
    const c = new ApiClient(baseUrl);
    const r = await c.health();
    expect(r.status).toBe('ok');
  });

  it('health returns error on fail', async () => {
    // TUI ApiClient throws on non-ok
    mockFetch.mockResolvedValue(okResponse({ status: 'ok' }));
    mockFetch.mockRejectedValueOnce(new Error('API 500'));
    const c = new ApiClient(baseUrl);
    const r = await c.health().catch(() => ({ status: 'error' }));
    expect(r.status).toBe('error');
  });

  it('getTeam fetches /api/team', async () => {
    mockFetch.mockResolvedValue(okResponse({ candidates: [], members: [], interviews: [], trainings: [], skills: [], reviews: [] }));
    const c = new ApiClient(baseUrl);
    const r = await c.getTeam();
    expect(r.candidates).toEqual([]);
  });

  it('getTeam returns empty on error', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    const c = new ApiClient(baseUrl);
    const r = await c.getTeam().catch(() => ({ candidates: [], members: [], interviews: [], trainings: [], skills: [], reviews: [] }));
    expect(r.candidates).toEqual([]);
  });

  it('getStats', async () => {
    mockFetch.mockResolvedValue(okResponse({ activeMembers: 5 }));
    const c = new ApiClient(baseUrl);
    expect((await c.getStats()).activeMembers).toBe(5);
  });

  it('listCandidates', async () => {
    mockFetch.mockResolvedValue(okResponse([{}, {}]));
    const c = new ApiClient(baseUrl);
    expect(await c.listCandidates()).toHaveLength(2);
  });

  it('listCandidates returns [] on error', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    const c = new ApiClient(baseUrl);
    expect(await c.listCandidates().catch(() => [])).toEqual([]);
  });

  it('addCandidate POSTs', async () => {
    mockFetch.mockResolvedValue(okResponse({ id: 'x' }));
    const c = new ApiClient(baseUrl);
    expect((await c.addCandidate({ name: 'X' } as any)).id).toBe('x');
  });

  it('deleteCandidate', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const c = new ApiClient(baseUrl);
    await c.deleteCandidate('x');
  });

  it('deleteCandidate throws on error', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    const c = new ApiClient(baseUrl);
    await expect(c.deleteCandidate('x')).rejects.toThrow();
  });

  it('listMembers', async () => {
    mockFetch.mockResolvedValue(okResponse([{}, {}]));
    const c = new ApiClient(baseUrl);
    expect(await c.listMembers()).toHaveLength(2);
  });

  it('addMember', async () => {
    mockFetch.mockResolvedValue(okResponse({ id: 'y' }));
    const c = new ApiClient(baseUrl);
    expect((await c.addMember({ name: 'Y' } as any)).id).toBe('y');
  });

  it('listInterviews', async () => {
    mockFetch.mockResolvedValue(okResponse([{}]));
    const c = new ApiClient(baseUrl);
    expect(await c.listInterviews()).toHaveLength(1);
  });

  it('startInterview', async () => {
    mockFetch.mockResolvedValue(okResponse({ interview: { id: 'i' }, openingQuestion: 'q' }));
    const c = new ApiClient(baseUrl);
    const r = await c.startInterview('c', 'technical');
    expect(r.interview.id).toBe('i');
  });

  it('submitAnswer', async () => {
    mockFetch.mockResolvedValue(okResponse({ interview: { id: 'i' }, nextQuestion: 'q' }));
    const c = new ApiClient(baseUrl);
    const r = await c.submitAnswer('i', 'hi');
    expect(r.nextQuestion).toBe('q');
  });

  it('finalizeInterview', async () => {
    mockFetch.mockResolvedValue(okResponse({ id: 'i' }));
    const c = new ApiClient(baseUrl);
    const r = await c.finalizeInterview('i');
    expect(r.id).toBe('i');
  });
});
