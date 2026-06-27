// V113: CandidateDrawer + MemberDrawer + InterviewCalendar (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetResourceCache, resetEventBus } from '../src/lib/data-layer/index.js';
import {
  CandidateDrawer,
  MemberDrawer,
  InterviewCalendar,
  buildCalendarMonth,
  buildHeatmapCalendar,
  groupInterviewsByDate,
  formatInterviewTime,
  calendarMonthLabel,
  calendarPrevMonth,
  calendarNextMonth,
  navigateCalendarMonth,
} from '../src/components/views/index.js';

beforeEach(() => {
  resetResourceCache();
  resetEventBus();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- CandidateDrawer ----------
describe('V113 CandidateDrawer', () => {
  it('renders candidate name, position, status badge', () => {
    render(
      <MemoryRouter>
        <CandidateDrawer
          candidate={{ id: 'c1', name: 'Alice', position: 'FE', status: 'sourced', source: 'linkedin' }}
          onClose={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FE/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sourced/).length).toBeGreaterThan(0);
  });

  it('renders pipeline timeline with current stage highlighted', () => {
    render(
      <MemoryRouter>
        <CandidateDrawer
          candidate={{ id: 'c1', name: 'Alice', position: 'FE', status: 'screening', source: 'linkedin' }}
          onClose={() => {}}
          pipelineStage="screening"
        />
      </MemoryRouter>
    );
    const timeline = screen.getByTestId('candidate-timeline');
    expect(timeline).toBeTruthy();
    expect(timeline.querySelectorAll('[data-stage-active]').length).toBe(1);
  });

  it('shows resume score badge when provided', () => {
    render(
      <MemoryRouter>
        <CandidateDrawer
          candidate={{ id: 'c1', name: 'Alice', position: 'FE', status: 'sourced', source: 'linkedin', resumeScore: 88 }}
          onClose={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/88/)).toBeTruthy();
  });

  it('renders interview history list', () => {
    render(
      <MemoryRouter>
        <CandidateDrawer
          candidate={{ id: 'c1', name: 'Alice', position: 'FE', status: 'sourced', source: 'linkedin' }}
          onClose={() => {}}
          interviews={[
            { id: 'i1', date: '2024-01-01', status: 'completed' },
            { id: 'i2', date: '2024-02-01', status: 'pending' },
          ]}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId('interview-history')).toBeTruthy();
    expect(screen.getByText(/2024-01-01/)).toBeTruthy();
  });

  it('closes when overlay clicked', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CandidateDrawer
          candidate={{ id: 'c1', name: 'Alice', position: 'FE', status: 'sourced', source: 'linkedin' }}
          onClose={onClose}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('candidate-drawer-overlay'));
    expect(onClose).toHaveBeenCalled();
  });
});

// ---------- MemberDrawer ----------
describe('V113 MemberDrawer', () => {
  it('renders member name, role, team', () => {
    render(
      <MemoryRouter>
        <MemberDrawer
          member={{ id: 'm1', name: 'Bob', role: 'Tech Lead', team: 'Platform' }}
          onClose={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Bob/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tech Lead/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Platform/).length).toBeGreaterThan(0);
  });

  it('renders skill profile with scores', () => {
    render(
      <MemoryRouter>
        <MemberDrawer
          member={{ id: 'm1', name: 'Bob', role: 'Tech Lead', team: 'Platform' }}
          onClose={() => {}}
          skills={[
            { name: 'TypeScript', score: 90 },
            { name: 'React', score: 85 },
          ]}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId('skill-radar')).toBeTruthy();
  });

  it('renders review history when provided', () => {
    render(
      <MemoryRouter>
        <MemberDrawer
          member={{ id: 'm1', name: 'Bob', role: 'Tech Lead', team: 'Platform' }}
          onClose={() => {}}
          reviews={[{ id: 'r1', date: '2024-Q1', rating: 4.5 }]}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId('review-history')).toBeTruthy();
  });
});

// ---------- InterviewCalendar ----------
describe('V113 InterviewCalendar', () => {
  const interviews = [
    { id: 'i1', candidateName: 'Alice', date: '2024-06-15', time: '10:00', status: 'scheduled' },
    { id: 'i2', candidateName: 'Bob', date: '2024-06-15', time: '14:00', status: 'scheduled' },
    { id: 'i3', candidateName: 'Carol', date: '2024-06-20', time: '11:00', status: 'completed' },
  ];

  it('renders month grid for the current view', () => {
    render(
      <MemoryRouter>
        <InterviewCalendar
          year={2024}
          month={5}
          interviews={interviews}
          onSelect={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId('calendar-grid')).toBeTruthy();
  });

  it('shows the month label', () => {
    render(
      <MemoryRouter>
        <InterviewCalendar
          year={2024}
          month={5}
          interviews={interviews}
          onSelect={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId('calendar-month-label').textContent).toMatch(/2024/);
  });

  it('clicking prev/next month dispatches onMonthChange', () => {
    const onMonthChange = vi.fn();
    render(
      <MemoryRouter>
        <InterviewCalendar
          year={2024}
          month={5}
          interviews={interviews}
          onSelect={() => {}}
          onMonthChange={onMonthChange}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('calendar-prev'));
    fireEvent.click(screen.getByTestId('calendar-next'));
    expect(onMonthChange).toHaveBeenCalledTimes(2);
  });

  it('clicking a day calls onSelect with date', () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <InterviewCalendar
          year={2024}
          month={5}
          interviews={interviews}
          onSelect={onSelect}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('calendar-day-2024-06-15'));
    expect(onSelect).toHaveBeenCalledWith('2024-06-15');
  });
});

// ---------- Calendar pure helpers ----------
describe('V113 Calendar helpers', () => {
  it('buildCalendarMonth returns 42 cells (6 weeks * 7 days)', () => {
    const cells = buildCalendarMonth(2024, 5);
    expect(cells.length).toBe(42);
  });

  it('cells have year/month/day fields', () => {
    const cells = buildCalendarMonth(2024, 5);
    for (const c of cells) {
      expect(c.year).toBeGreaterThan(2023);
      expect(c.month).toBeGreaterThanOrEqual(1);
      expect(c.day).toBeGreaterThan(0);
    }
  });

  it('buildHeatmapCalendar maps interview count per day', () => {
    const hm = buildHeatmapCalendar(2024, 5, [
      { id: 'a', date: '2024-06-15' },
      { id: 'b', date: '2024-06-15' },
      { id: 'c', date: '2024-06-20' },
    ]);
    expect(hm['2024-06-15']).toBe(2);
    expect(hm['2024-06-20']).toBe(1);
  });

  it('groupInterviewsByDate groups array by date string', () => {
    const grouped = groupInterviewsByDate([
      { id: 'a', date: '2024-06-15' },
      { id: 'b', date: '2024-06-15' },
      { id: 'c', date: '2024-06-20' },
    ]);
    expect(Object.keys(grouped).length).toBe(2);
    expect(grouped['2024-06-15'].length).toBe(2);
  });

  it('formatInterviewTime renders HH:mm', () => {
    expect(formatInterviewTime('10:30')).toBe('10:30');
  });

  it('calendarMonthLabel returns Chinese format', () => {
    const label = calendarMonthLabel(2024, 5);
    expect(label).toContain('2024');
    expect(label).toMatch(/6/);
  });

  it('calendarPrevMonth / calendarNextMonth wraps year', () => {
    expect(calendarPrevMonth(2024, 0)).toEqual({ year: 2023, month: 11 });
    expect(calendarNextMonth(2024, 11)).toEqual({ year: 2025, month: 0 });
    expect(calendarPrevMonth(2024, 5)).toEqual({ year: 2024, month: 4 });
  });

  it('navigateCalendarMonth handles +N / -N', () => {
    expect(navigateCalendarMonth(2024, 5, 3)).toEqual({ year: 2024, month: 8 });
    expect(navigateCalendarMonth(2024, 0, -1)).toEqual({ year: 2023, month: 11 });
  });
});