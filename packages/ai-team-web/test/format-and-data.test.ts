// Format component logic tests (logic-only, no DOM)
// Tests the helper functions used by components

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatDateTime, relativeTime, recommendationLabel, statusLabel } from '../src/lib/format';
import { loadTeamData, type TeamData } from '../src/lib/data';

describe('Component helper functions - format', () => {
  describe('formatDate', () => {
    it('formats valid ISO', () => {
      expect(formatDate('2026-06-19T10:30:00.000Z')).toBe('2026-06-19');
    });

    it('handles undefined', () => {
      expect(formatDate()).toBe('-');
    });

    it('handles empty string', () => {
      expect(formatDate('')).toBe('-');
    });
  });

  describe('formatDateTime', () => {
    it('formats with time', () => {
      expect(formatDateTime('2026-06-19T10:30:00.000Z')).toBe('2026-06-19 10:30:00');
    });

    it('handles undefined', () => {
      expect(formatDateTime()).toBe('-');
    });
  });

  describe('relativeTime', () => {
    it('recent time', () => {
      const r = relativeTime(new Date().toISOString());
      expect(r).toBeTruthy();
    });

    it('hours ago', () => {
      const past = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(relativeTime(past)).toMatch(/小时/);
    });

    it('days ago', () => {
      const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(relativeTime(past)).toMatch(/天/);
    });

    it('months ago', () => {
      const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const r = relativeTime(past);
      expect(r).toBeTruthy();
    });

    it('undefined', () => {
      expect(relativeTime()).toBe('-');
    });
  });

  describe('recommendationLabel', () => {
    it('maps all 5 categories', () => {
      expect(recommendationLabel('strong_hire').text).toBeTruthy();
      expect(recommendationLabel('hire').text).toBeTruthy();
      expect(recommendationLabel('maybe').text).toBeTruthy();
      expect(recommendationLabel('no_hire').text).toBeTruthy();
      expect(recommendationLabel('unknown').text).toBeTruthy();
    });

    it('returns class name', () => {
      const r = recommendationLabel('hire');
      expect(r.cls).toBeTruthy();
      expect(r.cls).toMatch(/^badge/);
    });

    it('undefined input', () => {
      expect(recommendationLabel().text).toBeTruthy();
    });
  });

  describe('statusLabel', () => {
    it('maps all candidate statuses', () => {
      expect(statusLabel('new').text).toBeTruthy();
      expect(statusLabel('interviewing').text).toBeTruthy();
      expect(statusLabel('hired').text).toBeTruthy();
      expect(statusLabel('rejected').text).toBeTruthy();
    });

    it('maps all member statuses', () => {
      expect(statusLabel('active').text).toBeTruthy();
      expect(statusLabel('inactive').text).toBeTruthy();
    });

    it('maps all training statuses', () => {
      expect(statusLabel('planned').text).toBeTruthy();
      expect(statusLabel('in_progress').text).toBeTruthy();
      expect(statusLabel('completed').text).toBeTruthy();
      expect(statusLabel('cancelled').text).toBeTruthy();
    });

    it('unknown status', () => {
      expect(statusLabel('xyz').text).toBeTruthy();
    });
  });
});

describe('Component data loading', () => {
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

  it('loadTeamData fetches data', async () => {
    const team: TeamData = {
      candidates: [], members: [], interviews: [], trainings: [], skills: [], reviews: [],
      generatedAt: '2026-06-19T00:00:00.000Z',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => team,
      text: async () => JSON.stringify(team),
    });
    const r = await loadTeamData();
    expect(r.generatedAt).toBeDefined();
  });

  it('loadTeamData falls back on error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => '',
    });
    const r = await loadTeamData();
    expect(r.candidates).toEqual([]);
  });

  it('loadTeamData handles network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const r = await loadTeamData();
    expect(r).toBeDefined();
  });
});
