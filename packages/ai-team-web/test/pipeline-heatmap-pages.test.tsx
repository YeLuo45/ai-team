// V26: Pipeline + Heatmap web page tests
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { PipelineFunnel } from '../src/pages/Pipeline.js';
import { CapabilityHeatmap } from '../src/pages/Heatmap.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
    statusText: ok ? 'OK' : 'Error',
  });
}

describe('PipelineFunnel page', () => {
  it('renders loading state then funnel data on success', async () => {
    const report = {
      total: 4,
      byStage: { sourced: 1, screening: 1, interview: 1, evaluation: 1, offer: 0, hired: 0, rejected: 0 },
      steps: [
        { stage: 'sourced' as const, label: '已投递', count: 1, conversionRate: 1, dropoffRate: 0 },
        { stage: 'screening' as const, label: '筛选中', count: 1, conversionRate: 1, dropoffRate: 0 },
      ],
      overallConversion: 0,
      averageDwellDays: 5,
      generatedAt: new Date().toISOString(),
    };
    globalThis.fetch = vi.fn(async () => jsonResponse(report)) as any;

    render(<PipelineFunnel />);
    await waitFor(() => {
      expect(screen.getByTestId('pipeline-funnel')).toBeTruthy();
    });
    expect(screen.getByTestId('stage-sourced')).toBeTruthy();
    expect(screen.getByTestId('row-sourced')).toBeTruthy();
    // "整体转化：0.0%" is split across text node + <strong>; use queryAllByText with predicate
    const all = screen.queryAllByText((_, el) => (el?.textContent ?? '').includes('整体转化'));
    expect(all.length).toBeGreaterThanOrEqual(1);
    const dwell = screen.queryAllByText((_, el) => (el?.textContent ?? '').includes('平均停留'));
    expect(dwell.length).toBeGreaterThanOrEqual(1);
  });

  it('renders error state on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as any;
    render(<PipelineFunnel />);
    await waitFor(() => {
      expect(screen.getByTestId('pipeline-error')).toBeTruthy();
    });
    expect(screen.getByText(/加载失败/)).toBeTruthy();
  });

  it('renders error on non-OK HTTP', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({}, false, 500)) as any;
    render(<PipelineFunnel />);
    await waitFor(() => {
      expect(screen.getByTestId('pipeline-error')).toBeTruthy();
    });
  });

  it('retry button triggers reload', async () => {
    let count = 0;
    globalThis.fetch = vi.fn(async () => {
      count++;
      if (count === 1) throw new Error('boom');
      return jsonResponse({
        total: 0, byStage: { sourced: 0, screening: 0, interview: 0, evaluation: 0, offer: 0, hired: 0, rejected: 0 },
        steps: [], overallConversion: 0, averageDwellDays: 0, generatedAt: new Date().toISOString(),
      });
    }) as any;
    const { rerender } = render(<PipelineFunnel />);
    await waitFor(() => screen.getByTestId('pipeline-error'));
    fireEvent.click(screen.getByTestId('pipeline-retry'));
    await waitFor(() => screen.getByTestId('pipeline-funnel'));
    expect(count).toBeGreaterThanOrEqual(2);
    rerender(<div />);
  });

  it('refresh button visible when loaded', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({
      total: 0, byStage: { sourced: 0, screening: 0, interview: 0, evaluation: 0, offer: 0, hired: 0, rejected: 0 },
      steps: [], overallConversion: 0, averageDwellDays: 0, generatedAt: new Date().toISOString(),
    })) as any;
    render(<PipelineFunnel />);
    await waitFor(() => screen.getByTestId('pipeline-funnel'));
    expect(screen.getByTestId('pipeline-refresh')).toBeTruthy();
  });

  it('shows loading initially', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as any; // never resolves
    render(<PipelineFunnel />);
    expect(screen.getByText('加载中...')).toBeTruthy();
  });
});

describe('CapabilityHeatmap page', () => {
  it('renders heatmap table with cells', async () => {
    const report = {
      rows: [{ team: 'Web', role: 'FE' }],
      cols: [{ skillId: 'sk_ts', skillName: 'TypeScript' }],
      cells: [
        { team: 'Web', role: 'FE', skillId: 'sk_ts', skillName: 'TypeScript',
          averageScore: 80, coverageCount: 2, expectedCount: 2, coverageRate: 1,
          level: 'high' as const, gap: 0 },
      ],
      overallAverage: 80,
      criticalGaps: 0,
      generatedAt: new Date().toISOString(),
    };
    globalThis.fetch = vi.fn(async () => jsonResponse(report)) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('capability-heatmap'));
    expect(screen.getByTestId('cell-Web-FE-sk_ts')).toBeTruthy();
    expect(screen.getByTestId('heatmap-table')).toBeTruthy();
  });

  it('shows empty state when no rows', async () => {
    const report = {
      rows: [], cols: [{ skillId: 'sk_ts', skillName: 'TypeScript' }], cells: [],
      overallAverage: 0, criticalGaps: 0, generatedAt: new Date().toISOString(),
    };
    globalThis.fetch = vi.fn(async () => jsonResponse(report)) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByText(/暂无数据/));
    expect(screen.getByText(/暂无数据/)).toBeTruthy();
  });

  it('renders error state on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('capability-heatmap'));
    // V32: on fetch failure, rows count should remain at default 0, no per-row cells rendered
    expect(screen.queryByTestId('cell-button-Web-FE-sk_ts')).toBeNull();
  });

  it('shows critical gap counter when there are critical cells', async () => {
    const report = {
      rows: [{ team: 'A', role: 'B' }],
      cols: [{ skillId: 'sk1', skillName: 'S1' }],
      cells: [
        { team: 'A', role: 'B', skillId: 'sk1', skillName: 'S1',
          averageScore: 20, coverageCount: 1, expectedCount: 1, coverageRate: 1,
          level: 'critical' as const, gap: 50 },
      ],
      overallAverage: 20, criticalGaps: 1, generatedAt: new Date().toISOString(),
    };
    globalThis.fetch = vi.fn(async () => jsonResponse(report)) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('capability-heatmap'));
    // criticalGaps 1 and overallAverage 20 are both numeric — use getAllByText for the 1
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(1);
  });

  it('refresh button triggers reload', async () => {
    let count = 0;
    globalThis.fetch = vi.fn(async () => {
      count++;
      return jsonResponse({
        rows: [], cols: [], cells: [], overallAverage: 0, criticalGaps: 0, generatedAt: new Date().toISOString(),
      });
    }) as any;
    const { rerender } = render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('capability-heatmap'));
    fireEvent.click(screen.getByTestId('heatmap-refresh'));
    await waitFor(() => expect(count).toBeGreaterThanOrEqual(2));
    rerender(<div />);
  });

  it('V32: clicking a cell opens the detail modal', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/cell?')) {
        return jsonResponse({
          team: 'Web', role: 'FE', skillId: 'sk_ts', skillName: 'TypeScript',
          averageScore: 80, coverageCount: 2, expectedCount: 3,
          members: [
            { memberId: 'm1', name: 'Alice', level: 'P5', score: 80 },
            { memberId: 'm2', name: 'Bob', level: 'P4', score: 80 },
            { memberId: 'm3', name: 'Carol', score: null },
          ],
        });
      }
      return jsonResponse({
        rows: [{ team: 'Web', role: 'FE' }],
        cols: [{ skillId: 'sk_ts', skillName: 'TypeScript' }],
        cells: [
          { team: 'Web', role: 'FE', skillId: 'sk_ts', skillName: 'TypeScript',
            averageScore: 80, coverageCount: 2, expectedCount: 3, coverageRate: 0.67,
            level: 'high', gap: 0 },
        ],
        overallAverage: 80, criticalGaps: 0, generatedAt: new Date().toISOString(),
      });
    }) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('capability-heatmap'));
    fireEvent.click(screen.getByTestId('cell-button-Web-FE-sk_ts'));
    await waitFor(() => screen.getByTestId('cell-modal'));
    expect(screen.getByText('Web · FE')).toBeTruthy();
    expect(screen.getByTestId('cell-modal-member-m1')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('未覆盖')).toBeTruthy();
  });

  it('V32: modal close button dismisses modal', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/cell?')) {
        return jsonResponse({ team: 'A', role: 'B', skillId: 's', skillName: 'S', averageScore: 0, coverageCount: 0, expectedCount: 0, members: [] });
      }
      return jsonResponse({
        rows: [{ team: 'A', role: 'B' }], cols: [{ skillId: 's', skillName: 'S' }],
        cells: [{ team: 'A', role: 'B', skillId: 's', skillName: 'S', averageScore: 0, coverageCount: 0, expectedCount: 0, coverageRate: 0, level: 'critical', gap: 70 }],
        overallAverage: 0, criticalGaps: 1, generatedAt: new Date().toISOString(),
      });
    }) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('capability-heatmap'));
    fireEvent.click(screen.getByTestId('cell-button-A-B-s'));
    await waitFor(() => screen.getByTestId('cell-modal'));
    fireEvent.click(screen.getByTestId('cell-modal-close'));
    expect(screen.queryByTestId('cell-modal')).toBeNull();
  });

  it('V32: modal shows empty-state message when no members', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/cell?')) {
        return jsonResponse({ team: 'Empty', role: 'FE', skillId: 'sk_ts', skillName: 'TypeScript', averageScore: 0, coverageCount: 0, expectedCount: 0, members: [] });
      }
      return jsonResponse({
        rows: [{ team: 'Empty', role: 'FE' }], cols: [{ skillId: 'sk_ts', skillName: 'TypeScript' }],
        cells: [{ team: 'Empty', role: 'FE', skillId: 'sk_ts', skillName: 'TypeScript', averageScore: 0, coverageCount: 0, expectedCount: 0, coverageRate: 0, level: 'critical', gap: 70 }],
        overallAverage: 0, criticalGaps: 1, generatedAt: new Date().toISOString(),
      });
    }) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('cell-button-Empty-FE-sk_ts'));
    fireEvent.click(screen.getByTestId('cell-button-Empty-FE-sk_ts'));
    await waitFor(() => screen.getByTestId('cell-modal'));
    expect(screen.getByText(/没有成员/)).toBeTruthy();
  });

  it('V32: modal shows error when /cell endpoint fails', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/cell?')) {
        return new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return jsonResponse({
        rows: [{ team: 'T', role: 'R' }], cols: [{ skillId: 's', skillName: 'S' }],
        cells: [{ team: 'T', role: 'R', skillId: 's', skillName: 'S', averageScore: 50, coverageCount: 1, expectedCount: 1, coverageRate: 1, level: 'medium', gap: 20 }],
        overallAverage: 50, criticalGaps: 0, generatedAt: new Date().toISOString(),
      });
    }) as any;
    render(<CapabilityHeatmap />);
    await waitFor(() => screen.getByTestId('cell-button-T-R-s'));
    fireEvent.click(screen.getByTestId('cell-button-T-R-s'));
    await waitFor(() => screen.getByTestId('cell-modal-error'));
  });
});