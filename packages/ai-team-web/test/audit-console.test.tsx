// V27: AuditConsole web page tests
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import AuditConsole from '../src/pages/AuditConsole.js';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  readyState = 0;
  onerror: ((ev: Event) => void) | null = null;
  private listeners = new Map<string, ((ev: MessageEvent) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
    // Auto-emit connected after construction
    queueMicrotask(() => {
      const e = { data: JSON.stringify({ id: this.url }) } as MessageEvent;
      this.dispatch('connected', e);
    });
  }

  addEventListener(type: string, cb: (ev: MessageEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(cb);
  }

  dispatch(type: string, ev: MessageEvent) {
    const cbs = this.listeners.get(type) ?? [];
    for (const cb of cbs) cb(ev);
  }

  close() {
    FakeEventSource.instances = FakeEventSource.instances.filter((x) => x !== this);
  }

  // Test helper: simulate server pushing an event
  simulateEvent(type: 'agent.audit' | 'agent.audit.history', data: unknown) {
    this.dispatch(type, { data: JSON.stringify(data) } as MessageEvent);
  }
}

let originalES: any;

beforeEach(() => {
  originalES = (globalThis as any).EventSource;
  FakeEventSource.instances = [];
  (globalThis as any).EventSource = FakeEventSource as any;
});

afterEach(() => {
  cleanup();
  (globalThis as any).EventSource = originalES;
  vi.restoreAllMocks();
});

function makeRecord(over: any = {}) {
  return {
    id: 'ac_test_1',
    agent: 'interview',
    operation: 'start',
    actorId: 'u1',
    inputSummary: 'c1',
    outputSummary: 'object',
    status: 'success',
    durationMs: 42,
    startedAt: '2026-06-01T00:00:00Z',
    endedAt: '2026-06-01T00:00:01Z',
    ...over,
  };
}

describe('AuditConsole page', () => {
  it('renders empty state when no events', async () => {
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    expect(screen.getByTestId('audit-empty')).toBeTruthy();
  });

  it('shows connected status after connected event', async () => {
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    await waitFor(() => {
      const badge = screen.getByTestId('audit-status');
      expect(badge.textContent).toContain('已连接');
    });
  });

  it('appends history events and renders rows', async () => {
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.simulateEvent('agent.audit.history', makeRecord({ id: 'ac_h_1' }));
    });
    await waitFor(() => screen.getByTestId('audit-row-ac_h_1'));
    const row = screen.getByTestId('audit-row-ac_h_1');
    expect(row.textContent).toContain('面试');
    expect(row.textContent).toContain('start');
    expect(row.textContent).toContain('42');
  });

  it('appends live audit events', async () => {
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.simulateEvent('agent.audit', makeRecord({ id: 'ac_live_1', agent: 'training', operation: 'gen' }));
    });
    await waitFor(() => screen.getByTestId('audit-row-ac_live_1'));
    const row = screen.getByTestId('audit-row-ac_live_1');
    expect(row.textContent).toContain('培训');
    expect(row.textContent).toContain('gen');
  });

  it('shows error state when EventSource constructor throws', async () => {
    (globalThis as any).EventSource = vi.fn(() => { throw new Error('not supported'); }) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-error'));
    expect(screen.getByText(/not supported/)).toBeTruthy();
  });

  it('handles malformed JSON payload gracefully', async () => {
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.dispatch('agent.audit', { data: 'not-json{' } as MessageEvent);
    });
    // empty state remains (no rows added)
    expect(screen.getByTestId('audit-empty')).toBeTruthy();
  });

  it('shows error on EventSource error event', async () => {
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.onerror?.(new Event('error'));
    });
    await waitFor(() => screen.getByTestId('audit-error'));
  });

  it('cleans up EventSource on unmount', async () => {
    const { unmount } = render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    expect(FakeEventSource.instances.length).toBe(1);
    unmount();
    expect(FakeEventSource.instances.length).toBe(0);
  });
});

describe('AuditConsole filter + stats (V31)', () => {
  let origFetch: any;
  beforeEach(() => {
    origFetch = globalThis.fetch;
    FakeEventSource.instances = [];
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  function jsonResp(data: unknown, ok = true, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  }

  function push(es: any, type: 'agent.audit' | 'agent.audit.history', rec: any) {
    act(() => es.simulateEvent(type, rec));
  }

  it('renders 4 stat cards with computed values', async () => {
    globalThis.fetch = vi.fn(async () => jsonResp({}, true)) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_s1', status: 'success', durationMs: 100 }));
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_s2', status: 'success', durationMs: 200 }));
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_f1', status: 'failed', durationMs: 50 }));
    await waitFor(() => screen.getByTestId('audit-stat-total'));
    expect(screen.getByTestId('audit-stat-total').textContent).toContain('3');
    expect(screen.getByTestId('audit-stat-success').textContent).toContain('2');
    expect(screen.getByTestId('audit-stat-failed').textContent).toContain('1');
    // avg = round((100+200+50)/3) = round(116.67) = 117
    expect(screen.getByTestId('audit-stat-avg').textContent).toMatch(/1[12]\d/);
  });

  it('agent filter narrows visible rows and stats', async () => {
    globalThis.fetch = vi.fn(async () => jsonResp({}, true)) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_i1', agent: 'interview' }));
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_t1', agent: 'training' }));
    await waitFor(() => screen.getByTestId('audit-row-ac_i1'));
    fireEvent.change(screen.getByTestId('audit-filter-agent'), { target: { value: 'training' } });
    await waitFor(() => {
      expect(screen.queryByTestId('audit-row-ac_i1')).toBeNull();
      expect(screen.getByTestId('audit-row-ac_t1')).toBeTruthy();
    });
    expect(screen.getByTestId('audit-stat-total').textContent).toContain('1');
  });

  it('status filter narrows visible rows', async () => {
    globalThis.fetch = vi.fn(async () => jsonResp({}, true)) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_ok', status: 'success' }));
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_no', status: 'failed' }));
    await waitFor(() => screen.getByTestId('audit-row-ac_no'));
    fireEvent.change(screen.getByTestId('audit-filter-status'), { target: { value: 'failed' } });
    await waitFor(() => {
      expect(screen.queryByTestId('audit-row-ac_ok')).toBeNull();
      expect(screen.getByTestId('audit-row-ac_no')).toBeTruthy();
    });
  });

  it('shows clear button when any filter is active', async () => {
    globalThis.fetch = vi.fn(async () => jsonResp({}, true)) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    expect(screen.queryByTestId('audit-filter-clear')).toBeNull();
    const es = FakeEventSource.instances[0];
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_x' }));
    fireEvent.change(screen.getByTestId('audit-filter-agent'), { target: { value: 'training' } });
    expect(screen.getByTestId('audit-filter-clear')).toBeTruthy();
  });

  it('clear button resets both filters', async () => {
    globalThis.fetch = vi.fn(async () => jsonResp({}, true)) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    fireEvent.change(screen.getByTestId('audit-filter-agent'), { target: { value: 'training' } });
    fireEvent.change(screen.getByTestId('audit-filter-status'), { target: { value: 'failed' } });
    fireEvent.click(screen.getByTestId('audit-filter-clear'));
    expect((screen.getByTestId('audit-filter-agent') as HTMLSelectElement).value).toBe('');
    expect((screen.getByTestId('audit-filter-status') as HTMLSelectElement).value).toBe('');
  });

  it('shows "no match" message when filters hide all events', async () => {
    globalThis.fetch = vi.fn(async () => jsonResp({}, true)) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    const es = FakeEventSource.instances[0];
    push(es, 'agent.audit.history', makeRecord({ id: 'ac_iv', agent: 'interview' }));
    await waitFor(() => screen.getByTestId('audit-row-ac_iv'));
    fireEvent.change(screen.getByTestId('audit-filter-agent'), { target: { value: 'training' } });
    await waitFor(() => {
      expect(screen.queryByTestId('audit-row-ac_iv')).toBeNull();
    });
    expect(screen.getByText(/没有匹配筛选/)).toBeTruthy();
  });

  it('all-zero events yields zero stats', async () => {
    globalThis.fetch = vi.fn(async () => jsonResp({}, true)) as any;
    render(<AuditConsole />);
    await waitFor(() => screen.getByTestId('audit-console'));
    expect(screen.getByTestId('audit-stat-total').textContent).toContain('0');
    expect(screen.getByTestId('audit-stat-avg').textContent).toContain('0');
  });
});