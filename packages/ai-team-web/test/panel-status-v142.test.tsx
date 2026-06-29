// V142: StatusDot + Panel status indicators
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  PanelStatusIndicator,
  usePanelStatus,
  buildPanelStatus,
  statusToTone,
  statusToBadgeLabel,
  statusPriority,
  type PanelStatus,
  type PanelStatusInfo,
} from '../src/components/status/PanelStatus.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- statusToTone / statusToBadgeLabel / statusPriority ----------
describe('V142 status helpers', () => {
  it('statusToTone maps 4 status to Badge tone', () => {
    expect(statusToTone('healthy')).toBe('success');
    expect(statusToTone('degraded')).toBe('warning');
    expect(statusToTone('blocked')).toBe('danger');
    expect(statusToTone('idle')).toBe('neutral');
  });

  it('statusToBadgeLabel returns Chinese label', () => {
    expect(statusToBadgeLabel('healthy')).toBe('健康');
    expect(statusToBadgeLabel('degraded')).toBe('降级');
    expect(statusToBadgeLabel('blocked')).toBe('阻塞');
    expect(statusToBadgeLabel('idle')).toBe('空闲');
  });

  it('statusPriority is 0 for healthy + 3 for blocked', () => {
    expect(statusPriority('healthy')).toBe(0);
    expect(statusPriority('blocked')).toBe(3);
  });
});

// ---------- buildPanelStatus ----------
describe('V142 buildPanelStatus', () => {
  it('returns PanelStatusInfo from input parts', () => {
    const info = buildPanelStatus({ status: 'healthy', count: 12, unit: '人' });
    expect(info.status).toBe('healthy');
    expect(info.count).toBe(12);
    expect(info.unit).toBe('人');
  });

  it('handles missing optional fields', () => {
    const info = buildPanelStatus({ status: 'idle' });
    expect(info.status).toBe('idle');
    expect(info.count).toBeUndefined();
    expect(info.unit).toBeUndefined();
  });
});

// ---------- PanelStatusIndicator ----------
describe('V142 PanelStatusIndicator', () => {
  it('renders status dot + label', () => {
    const info: PanelStatusInfo = { status: 'healthy', count: 5, unit: '件' };
    render(<PanelStatusIndicator info={info} testId="panel-status" />);
    expect(screen.getByTestId('panel-status')).toBeTruthy();
    expect(screen.getByTestId('panel-status').textContent).toContain('5');
    expect(screen.getByTestId('panel-status').textContent).toContain('件');
  });

  it('shows healthy green dot for healthy status', () => {
    const { container } = render(<PanelStatusIndicator info={{ status: 'healthy' }} testId="p" />);
    expect(container.innerHTML).toContain('bg-emerald-500');
  });

  it('shows degraded amber dot for degraded status', () => {
    const { container } = render(<PanelStatusIndicator info={{ status: 'degraded' }} testId="p" />);
    expect(container.innerHTML).toContain('bg-amber-500');
  });

  it('shows blocked rose dot for blocked status', () => {
    const { container } = render(<PanelStatusIndicator info={{ status: 'blocked' }} testId="p" />);
    expect(container.innerHTML).toContain('bg-rose-500');
  });

  it('shows idle slate dot for idle status', () => {
    const { container } = render(<PanelStatusIndicator info={{ status: 'idle' }} testId="p" />);
    expect(container.innerHTML).toContain('bg-slate-400');
  });

  it('uses custom testId', () => {
    render(<PanelStatusIndicator info={{ status: 'healthy' }} testId="custom-status" />);
    expect(screen.getByTestId('custom-status')).toBeTruthy();
  });
});

// ---------- usePanelStatus ----------
describe('V142 usePanelStatus', () => {
  it('returns initial status from initialStatus', () => {
    function Probe() {
      const { status } = usePanelStatus({ initialStatus: 'blocked' });
      return <div data-testid="probe">{status}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('blocked');
  });

  it('setStatus updates state', () => {
    function Probe() {
      const { status, setStatus } = usePanelStatus({ initialStatus: 'idle' });
      return (
        <div>
          <span data-testid="flag">{status}</span>
          <button data-testid="set" onClick={() => setStatus('healthy')}>set</button>
        </div>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId('flag').textContent).toBe('idle');
    fireEvent.click(screen.getByTestId('set'));
    expect(screen.getByTestId('flag').textContent).toBe('healthy');
  });

  it('returns initial state with empty status', () => {
    function Probe() {
      const { status, info } = usePanelStatus();
      return <div data-testid="probe">{status + ':' + (info.count ?? 'none')}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('idle:none');
  });
});

// ---------- Types ----------
describe('V142 types', () => {
  it('PanelStatus accepts 4 values', () => {
    const statuses: PanelStatus[] = ['healthy', 'degraded', 'blocked', 'idle'];
    expect(statuses.length).toBe(4);
  });
});