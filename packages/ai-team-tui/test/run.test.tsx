// TUI run entry tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { App } from '../src/app.js';

describe('TUI run bootstrap', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('App renders with mocked client', () => {
    const mockClient = {
      getTeam: vi.fn().mockResolvedValue({ candidates: [], members: [], interviews: [], trainings: [], skills: [], reviews: [] }),
      getStats: vi.fn().mockResolvedValue({ activeMembers: 0, totalMembers: 0, candidates: 0, totalInterviews: 0, completedInterviews: 0, avgScore: 0, teamCounts: {} }),
      listCandidates: vi.fn().mockResolvedValue([]),
      listMembers: vi.fn().mockResolvedValue([]),
      listInterviews: vi.fn().mockResolvedValue([]),
      addCandidate: vi.fn(),
      deleteCandidate: vi.fn(),
    };
    const app = render(<App api={mockClient} />);
    const frame = app.lastFrame();
    expect(frame).toBeDefined();
    app.unmount();
  });

  it('App handles errors gracefully', async () => {
    const mockClient = {
      getTeam: vi.fn().mockRejectedValue(new Error('API down')),
      getStats: vi.fn().mockResolvedValue({ activeMembers: 0, totalMembers: 0, candidates: 0, totalInterviews: 0, completedInterviews: 0, avgScore: 0, teamCounts: {} }),
      listCandidates: vi.fn().mockResolvedValue([]),
      listMembers: vi.fn().mockResolvedValue([]),
      listInterviews: vi.fn().mockResolvedValue([]),
      addCandidate: vi.fn(),
      deleteCandidate: vi.fn(),
    };
    const app = render(<App api={mockClient} />);
    await new Promise((r) => setTimeout(r, 100));
    app.unmount();
  });
});
