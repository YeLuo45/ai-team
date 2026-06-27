// V125: ConsoleShell — tabs-based 4-panel orchestration shell (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ConsoleShell,
  useShellTab,
  useConsoleTab,
  CONSOLE_TAB_KEYS,
  DEFAULT_CONSOLE_TAB,
  selectInitialTab,
  isValidTabKey,
  nextTabKey,
  prevTabKey,
  tabIconFor,
  tabLabelFor,
  buildShellTabs,
  DEFAULT_SHELL_TABS,
  buildShellLayout,
  DEFAULT_SHELL_LAYOUT,
  type ShellTab,
  type ShellLayout,
} from '../src/components/orchestration/console-shell.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- Constants ----------
describe('V125 constants', () => {
  it('CONSOLE_TAB_KEYS has 4 entries', () => {
    expect(CONSOLE_TAB_KEYS.length).toBe(4);
    expect(CONSOLE_TAB_KEYS).toEqual(['workflow', 'approvals', 'delivery', 'operations']);
  });

  it('DEFAULT_CONSOLE_TAB is workflow', () => {
    expect(DEFAULT_CONSOLE_TAB).toBe('workflow');
  });
});

// ---------- isValidTabKey / selectInitialTab ----------
describe('V125 tab validation', () => {
  it('isValidTabKey accepts canonical keys', () => {
    expect(isValidTabKey('workflow')).toBe(true);
    expect(isValidTabKey('approvals')).toBe(true);
    expect(isValidTabKey('delivery')).toBe(true);
    expect(isValidTabKey('operations')).toBe(true);
  });

  it('isValidTabKey rejects unknown', () => {
    expect(isValidTabKey('foo')).toBe(false);
    expect(isValidTabKey('')).toBe(false);
    expect(isValidTabKey(null)).toBe(false);
  });

  it('selectInitialTab returns default for invalid', () => {
    expect(selectInitialTab('workflow')).toBe('workflow');
    expect(selectInitialTab('approvals')).toBe('approvals');
    expect(selectInitialTab('foo')).toBe('workflow');
    expect(selectInitialTab(null)).toBe('workflow');
  });
});

// ---------- nextTabKey / prevTabKey ----------
describe('V125 tab navigation', () => {
  it('nextTabKey advances', () => {
    expect(nextTabKey('workflow')).toBe('approvals');
    expect(nextTabKey('approvals')).toBe('delivery');
    expect(nextTabKey('delivery')).toBe('operations');
  });

  it('nextTabKey wraps to first from last', () => {
    expect(nextTabKey('operations')).toBe('workflow');
  });

  it('prevTabKey goes back', () => {
    expect(prevTabKey('approvals')).toBe('workflow');
    expect(prevTabKey('operations')).toBe('delivery');
  });

  it('prevTabKey wraps to last from first', () => {
    expect(prevTabKey('workflow')).toBe('operations');
  });
});

// ---------- tabIconFor / tabLabelFor ----------
describe('V125 tab metadata', () => {
  it('tabIconFor returns icon per key', () => {
    expect(tabIconFor('workflow')).toBeTruthy();
    expect(tabIconFor('approvals')).toBeTruthy();
    expect(tabIconFor('delivery')).toBeTruthy();
    expect(tabIconFor('operations')).toBeTruthy();
    expect(tabIconFor('unknown')).toBe('?');
  });

  it('tabLabelFor returns Chinese label per key', () => {
    expect(tabLabelFor('workflow')).toContain('工作流');
    expect(tabLabelFor('approvals')).toContain('审批');
    expect(tabLabelFor('delivery')).toContain('交付');
    expect(tabLabelFor('operations')).toContain('运维');
  });

  it('every CONSOLE_TAB_KEYS has icon + label', () => {
    for (const k of CONSOLE_TAB_KEYS) {
      expect(tabIconFor(k)).toBeTruthy();
      expect(tabLabelFor(k)).toBeTruthy();
    }
  });
});

// ---------- DEFAULT_SHELL_TABS / buildShellTabs ----------
describe('V125 shell tabs', () => {
  it('DEFAULT_SHELL_TABS has 4 entries', () => {
    expect(DEFAULT_SHELL_TABS.length).toBe(4);
  });

  it('every tab has key + label + icon + testId', () => {
    for (const t of DEFAULT_SHELL_TABS) {
      expect(t.key).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.testId).toMatch(/^shell-tab-/);
    }
  });

  it('buildShellTabs returns a copy', () => {
    const tabs = buildShellTabs();
    expect(tabs.length).toBe(4);
    tabs[0]!.label = 'modified';
    expect(DEFAULT_SHELL_TABS[0]!.label).not.toBe('modified');
  });

  it('buildShellTabs accepts overrides', () => {
    const tabs = buildShellTabs([{ key: 'custom', label: 'Custom', icon: '⚡', testId: 'shell-tab-custom' }]);
    expect(tabs.length).toBe(1);
    expect(tabs[0]?.key).toBe('custom');
  });
});

// ---------- DEFAULT_SHELL_LAYOUT / buildShellLayout ----------
describe('V125 shell layout', () => {
  it('DEFAULT_SHELL_LAYOUT has 2x2 grid', () => {
    expect(DEFAULT_SHELL_LAYOUT.columns).toBe(2);
    expect(DEFAULT_SHELL_LAYOUT.workflow.visible).toBe(true);
  });

  it('buildShellLayout returns defaults', () => {
    const layout = buildShellLayout();
    expect(layout.columns).toBe(DEFAULT_SHELL_LAYOUT.columns);
  });

  it('buildShellLayout accepts overrides', () => {
    const layout = buildShellLayout({ columns: 1 });
    expect(layout.columns).toBe(1);
  });
});

// ---------- useShellTab + useConsoleTab ----------
describe('V125 shell tab hooks', () => {
  it('useShellTab returns active tab + actions', async () => {
    function Probe() {
      const tab = useShellTab();
      return (
        <div>
          <span data-testid="active">{tab.active}</span>
          <button data-testid="next" onClick={tab.next}>next</button>
          <button data-testid="prev" onClick={tab.prev}>prev</button>
          <button data-testid="goto-approvals" onClick={() => tab.goto('approvals')}>go</button>
          <button data-testid="reset" onClick={tab.reset}>reset</button>
        </div>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId('active').textContent).toBe('workflow');
    fireEvent.click(screen.getByTestId('next'));
    expect(screen.getByTestId('active').textContent).toBe('approvals');
    fireEvent.click(screen.getByTestId('goto-approvals'));
    expect(screen.getByTestId('active').textContent).toBe('approvals');
    fireEvent.click(screen.getByTestId('prev'));
    expect(screen.getByTestId('active').textContent).toBe('workflow');
    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('active').textContent).toBe('workflow');
  });

  it('useConsoleTab persists to localStorage', () => {
    function Probe() {
      const tab = useConsoleTab();
      return (
        <div>
          <span data-testid="active">{tab.active}</span>
          <button data-testid="goto" onClick={() => tab.goto('delivery')}>delivery</button>
        </div>
      );
    }
    render(<Probe />);
    fireEvent.click(screen.getByTestId('goto'));
    expect(localStorage.getItem('ai-team-console-tab')).toBe('delivery');
  });
});

// ---------- ConsoleShell component ----------
describe('V125 ConsoleShell component', () => {
  it('renders all 4 tab buttons', () => {
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    expect(screen.getByTestId('shell-tab-workflow')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-approvals')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-delivery')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-operations')).toBeTruthy();
  });

  it('shows workflow tab content by default', () => {
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    expect(screen.getByTestId('workflow-panel')).toBeTruthy();
  });

  it('clicking approvals tab switches content', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/approvals')) return jsonResponse({ snapshot: { queue: [] } });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-approvals'));
    await waitFor(() => expect(screen.getByTestId('approval-panel')).toBeTruthy());
  });

  it('clicking delivery tab shows delivery panel', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/delivery-summary')) return jsonResponse({ summary: { headline: 'V125 ready', ready: true } });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-delivery'));
    await waitFor(() => expect(screen.getByTestId('delivery-panel')).toBeTruthy());
  });

  it('clicking operations tab shows operations panel', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/scenarios')) return jsonResponse([]);
      if (url.includes('/operations')) return jsonResponse({ history: [] });
      return jsonResponse({}, false, 404);
    }) as any;
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('shell-tab-operations'));
    await waitFor(() => expect(screen.getByTestId('operations-panel')).toBeTruthy());
  });

  it('active tab button has aria-selected=true', () => {
    render(
      <MemoryRouter>
        <ConsoleShell />
      </MemoryRouter>
    );
    expect(screen.getByTestId('shell-tab-workflow').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('shell-tab-delivery'));
    expect(screen.getByTestId('shell-tab-delivery').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('shell-tab-workflow').getAttribute('aria-selected')).toBe('false');
  });
});