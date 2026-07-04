// V151: Candidates — batch status update + batch resume export
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Candidate } from '@ai-team/core';
import { Candidates } from '../src/pages/Candidates.js';
import { api } from '../src/lib/api.js';
import {
  buildResumeJsonExport,
  buildResumeExportFilename,
  serializeResumeExport,
} from '../src/lib/resume-export.js';

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
    email: overrides.email,
    tags: overrides.tags,
    skills: overrides.skills,
    resume: overrides.resume,
    notes: overrides.notes,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------- helpers ----------------

describe('buildResumeJsonExport', () => {
  it('builds a payload with exportedAt, count, and the candidate list', () => {
    const candidates = [
      makeCandidate({ id: 'ct_a', name: 'A', resume: '## A\nfoo', interviewCount: 3 }),
    ];
    const payload = buildResumeJsonExport(candidates, new Map([['ct_a', 3]]));
    expect(payload.count).toBe(1);
    expect(payload.candidates[0].id).toBe('ct_a');
    expect(payload.candidates[0].interviewCount).toBe(3);
    expect(payload.candidates[0].resume).toBe('## A\nfoo');
  });

  it('defaults interviewCount to 0 when missing from the map', () => {
    const payload = buildResumeJsonExport([makeCandidate()], new Map());
    expect(payload.candidates[0].interviewCount).toBe(0);
  });

  it('serializes the payload as pretty-printed JSON', () => {
    const payload = buildResumeJsonExport([makeCandidate({ id: 'ct_x' })], new Map());
    const json = serializeResumeExport(payload);
    expect(json).toContain('"id": "ct_x"');
    expect(json).toContain('\n  ');
  });

  it('builds a filename like candidates-export-YYYY-MM-DD.json', () => {
    const fixed = new Date('2026-07-04T12:34:56.000Z');
    expect(buildResumeExportFilename(fixed)).toBe('candidates-export-2026-07-04.json');
  });
});

// ---------------- UI: batch status select ----------------

describe('Candidates — batch status update + export', () => {
  it('renders the batch status select + export button when items are selected', () => {
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

    expect(screen.getByTestId('batch-status-select')).toBeTruthy();
    expect(screen.getByTestId('batch-export')).toBeTruthy();

    // Status select exposes all 6 CandidateStatus values
    const options = screen.getByTestId('batch-status-select').querySelectorAll('option');
    const labels = Array.from(options).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(['选择...', '新录入', '筛选中', '面试中', '已发 Offer', '已入职', '已拒绝']));
  });

  it('calls api.updateCandidate for every selected id with the chosen status', async () => {
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

    const updateSpy = vi.spyOn(api, 'updateCandidate').mockResolvedValue(makeCandidate());
    window.confirm = vi.fn(() => true);

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('select-all-toggle'));

    const select = screen.getByTestId('batch-status-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'interviewing' } });

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(2));
    expect(updateSpy).toHaveBeenCalledWith('ct_a', { status: 'interviewing' });
    expect(updateSpy).toHaveBeenCalledWith('ct_b', { status: 'interviewing' });
  });

  it('does NOT call updateCandidate when confirm dialog is rejected', () => {
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

    const updateSpy = vi.spyOn(api, 'updateCandidate').mockResolvedValue(makeCandidate());
    window.confirm = vi.fn(() => false);

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_a'));
    const select = screen.getByTestId('batch-status-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'offer' } });

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('batch export builds a JSON blob and triggers a download for selected candidates', () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [
          makeCandidate({ id: 'ct_a', name: 'A', resume: '## A' }),
          makeCandidate({ id: 'ct_b', name: 'B', resume: '## B' }),
          makeCandidate({ id: 'ct_c', name: 'C' }),
        ],
        members: [],
        trainings: [],
        generatedAt: '',
        interviews: [
          // Synthesize interview counts via interviews array
          { id: 'iv_1', candidateId: 'ct_a', position: 'X', type: 'technical', status: 'completed', turns: [], aiConducted: true, interviewerName: 'AI' },
          { id: 'iv_2', candidateId: 'ct_a', position: 'X', type: 'technical', status: 'completed', turns: [], aiConducted: true, interviewerName: 'AI' },
        ],
      },
    });

    // Spy on anchor click + URL.createObjectURL
    const createUrlSpy = vi.fn(() => 'blob:mock-url');
    const revokeUrlSpy = vi.fn();
    const clickSpy = vi.fn();
    window.URL.createObjectURL = createUrlSpy;
    window.URL.revokeObjectURL = revokeUrlSpy;
    const realCreate = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    render(<MemoryRouter><Candidates /></MemoryRouter>);
    // Select A and B (not C)
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_a'));
    fireEvent.click(screen.getByTestId('candidate-checkbox-ct_b'));
    // Click export
    fireEvent.click(screen.getByTestId('batch-export'));

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createElementSpy).toHaveBeenCalledWith('a');

    // Verify the blob contained the expected JSON
    const blobArg = createUrlSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json');

    createElementSpy.mockRestore();
  });
});