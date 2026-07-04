// V148: Candidates — multi-select checkbox + batch operations toolbar
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Candidate } from '@ai-team/core';
import { Candidates } from '../src/pages/Candidates.js';
import { api } from '../src/lib/api.js';

vi.mock('../src/lib/hooks.js', () => ({
  useTeamData: vi.fn(),
}));

const { useTeamData } = await import('../src/lib/hooks.js');

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: overrides.id ?? 'ct_a',
    name: overrides.name ?? 'A',
    position: overrides.position ?? 'Engineer',
    source: overrides.source ?? 'website',
    status: overrides.status ?? 'new',
    createdAt: overrides.createdAt ?? '2026-06-21T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-06-21T00:00:00Z',
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Candidates — multi-select + batch toolbar', () => {
  it('does not render checkboxes in static mode', () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'static',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [makeCandidate({ id: 'ct_a', name: 'A' })],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [],
      },
    });

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    expect(screen.queryByTestId('candidate-checkbox-ct_a')).toBeNull();
    expect(screen.queryByTestId('batch-action-toolbar')).toBeNull();
  });

  it('toggles a single candidate checkbox and reveals the batch toolbar', () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [
          makeCandidate({ id: 'ct_a', name: 'A' }),
          makeCandidate({ id: 'ct_b', name: 'B' }),
          makeCandidate({ id: 'ct_c', name: 'C' }),
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [],
      },
    });

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    // Initially no toolbar
    expect(screen.queryByTestId('batch-action-toolbar')).toBeNull();

    // Select B
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_b'));
    expect(screen.getByTestId('batch-selected-count').textContent).toContain('1');
    expect(screen.getByTestId('batch-delete').textContent).toContain('1');

    // Select A as well
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_a'));
    expect(screen.getByTestId('batch-selected-count').textContent).toContain('2');

    // Deselect A
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_a'));
    expect(screen.getByTestId('batch-selected-count').textContent).toContain('1');
  });

  it('"全选当前" selects all visible candidates', () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [
          makeCandidate({ id: 'ct_a', name: 'A' }),
          makeCandidate({ id: 'ct_b', name: 'B' }),
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [],
      },
    });

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('select-all-toggle'));
    expect(screen.getByTestId('batch-selected-count').textContent).toContain('2');
    // Toggle becomes "取消全选"
    expect(screen.getByTestId('select-all-toggle').textContent).toBe('取消全选');

    // Click again to clear
    fireEvent.click(screen.getByTestId('select-all-toggle'));
    expect(screen.queryByTestId('batch-action-toolbar')).toBeNull();
  });

  it('"取消选择" clears the current selection', () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [makeCandidate({ id: 'ct_a', name: 'A' })],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [],
      },
    });

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_a'));
    expect(screen.getByTestId('batch-selected-count').textContent).toContain('1');

    fireEvent.click(screen.getByTestId('batch-clear-selection'));
    expect(screen.queryByTestId('batch-action-toolbar')).toBeNull();
    const cb = screen.getByTestId('candidate-checkbox-ct_a') as HTMLInputElement;
    expect(cb.checked).toBe(false);
  });

  it('batch delete calls api.deleteCandidate for each selected id and refreshes', async () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [
          makeCandidate({ id: 'ct_a', name: 'A' }),
          makeCandidate({ id: 'ct_b', name: 'B' }),
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [],
      },
    });

    const deleteSpy = vi.spyOn(api, 'deleteCandidate').mockResolvedValue();
    // Auto-confirm (happy-dom does not expose window.confirm as a function)
    window.confirm = vi.fn(() => true);

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('select-all-toggle'));
    fireEvent.click(screen.getByTestId('batch-delete'));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(2));
    expect(deleteSpy).toHaveBeenCalledWith('ct_a');
    expect(deleteSpy).toHaveBeenCalledWith('ct_b');
    // Selection cleared after delete
    await waitFor(() => expect(screen.queryByTestId('batch-action-toolbar')).toBeNull());
  });

  it('does not call delete when confirm dialog is rejected', () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [makeCandidate({ id: 'ct_a', name: 'A' })],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [],
      },
    });

    const deleteSpy = vi.spyOn(api, 'deleteCandidate').mockResolvedValue();
    window.confirm = vi.fn(() => false);

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_a'));
    fireEvent.click(screen.getByTestId('batch-delete'));

    expect(deleteSpy).not.toHaveBeenCalled();
    // Selection persists
    expect(screen.getByTestId('batch-selected-count').textContent).toContain('1');
  });
});