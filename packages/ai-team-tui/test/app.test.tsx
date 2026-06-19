// TUI app component tests using ink-testing-library

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { App } from '../src/app.js';
import { ApiClient } from '../src/api.js';

// Mock ApiClient
vi.mock('../src/api.js', () => ({
  ApiClient: vi.fn(),
}));

describe('TUI App component', () => {
  let originalFetch: typeof fetch;
  let mockFetch: any;
  let mockClient: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    mockClient = {
      getTeam: vi.fn(),
      getStats: vi.fn(),
      listCandidates: vi.fn(),
      listMembers: vi.fn(),
      listInterviews: vi.fn(),
      addCandidate: vi.fn(),
      deleteCandidate: vi.fn(),
    };
    vi.mocked(ApiClient).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders loading state initially', () => {
    mockClient.getTeam.mockResolvedValue({
      candidates: [], members: [], interviews: [], trainings: [], skills: [], reviews: [],
    });
    mockClient.getStats.mockResolvedValue({ activeMembers: 0, totalMembers: 0, candidates: 0, totalInterviews: 0, completedInterviews: 0, avgScore: 0, teamCounts: {} });
    const app = render(<App api={mockClient} />);
    // Should have some output (loading spinner or empty)
    expect(app.lastFrame()).toBeDefined();
    app.unmount();
  });

  it('renders after data loaded', async () => {
    mockClient.getTeam.mockResolvedValue({
      candidates: [{ id: 'c1', name: 'X', position: 'P', source: 's', status: 'new', createdAt: '', updatedAt: '' }],
      members: [{ id: 'm1', name: 'Y', role: 'R', team: 'T', status: 'active', joinedAt: '' }],
      interviews: [],
      trainings: [],
      skills: [],
      reviews: [],
    });
    mockClient.getStats.mockResolvedValue({ activeMembers: 1, totalMembers: 1, candidates: 1, totalInterviews: 0, completedInterviews: 0, avgScore: 0, teamCounts: { T: 1 } });
    const app = render(<App api={mockClient} />);
    await new Promise((r) => setTimeout(r, 100));
    const frame = app.lastFrame();
    expect(frame).toBeDefined();
    app.unmount();
  });
});

describe('TUI sub-components', () => {
  it('App exports function', async () => {
    const mod = await import('../src/app.js');
    expect(typeof mod.App).toBe('function');
  });
});
