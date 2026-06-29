// V138: useShellTabPersist — localStorage persistence + storage event cross-tab sync
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  useShellTabPersist,
  parseShellTabStorage,
  serializeShellTabStorage,
  useShellTabStorage,
  dispatchShellTabChange,
  buildShellTabStorageKey,
  type ShellTabPersistConfig,
  type ShellTabStorageEvent,
} from '../src/components/orchestration/console-persist.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200 });
}

// ---------- parseShellTabStorage / serializeShellTabStorage ----------
describe('V138 parseShellTabStorage / serializeShellTabStorage', () => {
  it('parseShellTabStorage returns stored value when present', () => {
    localStorage.setItem('ai-team-shell-tab', 'delivery');
    expect(parseShellTabStorage('ai-team-shell-tab')).toBe('delivery');
  });

  it('parseShellTabStorage returns null when missing', () => {
    expect(parseShellTabStorage('ai-team-shell-tab')).toBeNull();
  });

  it('parseShellTabStorage returns null for unknown tab', () => {
    localStorage.setItem('ai-team-shell-tab', 'unknown-tab');
    expect(parseShellTabStorage('ai-team-shell-tab')).toBeNull();
  });

  it('serializeShellTabStorage writes value', () => {
    serializeShellTabStorage('ai-team-shell-tab', 'approvals');
    expect(localStorage.getItem('ai-team-shell-tab')).toBe('approvals');
  });
});

// ---------- buildShellTabStorageKey ----------
describe('V138 buildShellTabStorageKey', () => {
  it('returns ai-team-shell-tab as default', () => {
    expect(buildShellTabStorageKey()).toBe('ai-team-shell-tab');
  });

  it('returns custom prefix when provided', () => {
    expect(buildShellTabStorageKey('custom')).toBe('custom-shell-tab');
  });
});

// ---------- useShellTabStorage ----------
describe('V138 useShellTabStorage', () => {
  it('initializes from localStorage', () => {
    localStorage.setItem('ai-team-shell-tab', 'operations');
    function Probe() {
      const { tab } = useShellTabStorage();
      return <div data-testid="tab">{tab}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('tab').textContent).toBe('operations');
  });

  it('falls back to default when storage is empty', () => {
    function Probe() {
      const { tab } = useShellTabStorage();
      return <div data-testid="tab">{tab}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('tab').textContent).toBe('workflow');
  });

  it('set() persists + updates state', () => {
    function Probe() {
      const { tab, set } = useShellTabStorage();
      return (
        <div>
          <span data-testid="tab">{tab}</span>
          <button data-testid="set" onClick={() => set('delivery')}>set</button>
        </div>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId('tab').textContent).toBe('workflow');
    fireEvent.click(screen.getByTestId('set'));
    expect(screen.getByTestId('tab').textContent).toBe('delivery');
    expect(localStorage.getItem('ai-team-shell-tab')).toBe('delivery');
  });

  it('cross-tab sync via storage event', () => {
    function Probe() {
      const { tab } = useShellTabStorage();
      return <div data-testid="tab">{tab}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('tab').textContent).toBe('workflow');
    act(() => {
      const ev = new StorageEvent('storage', {
        key: 'ai-team-shell-tab',
        newValue: 'approvals',
      });
      window.dispatchEvent(ev);
    });
    expect(screen.getByTestId('tab').textContent).toBe('approvals');
  });
});

// ---------- useShellTabPersist ----------
describe('V138 useShellTabPersist', () => {
  it('exposes tab + set + reset + next + prev', () => {
    function Probe() {
      const { tab, set, reset, next, prev } = useShellTabPersist();
      return (
        <div>
          <span data-testid="tab">{tab}</span>
          <button data-testid="set" onClick={() => set('approvals')}>set</button>
          <button data-testid="reset" onClick={reset}>reset</button>
          <button data-testid="next" onClick={next}>next</button>
          <button data-testid="prev" onClick={prev}>prev</button>
        </div>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId('tab').textContent).toBe('workflow');
    fireEvent.click(screen.getByTestId('set'));
    expect(screen.getByTestId('tab').textContent).toBe('approvals');
    fireEvent.click(screen.getByTestId('next'));
    expect(screen.getByTestId('tab').textContent).toBe('delivery');
    fireEvent.click(screen.getByTestId('prev'));
    expect(screen.getByTestId('tab').textContent).toBe('approvals');
    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('tab').textContent).toBe('workflow');
  });

  it('uses custom storage key', () => {
    function Probe() {
      const { tab, set } = useShellTabPersist({ storageKey: 'custom' });
      return (
        <div>
          <span data-testid="tab">{tab}</span>
          <button data-testid="set" onClick={() => set('delivery')}>set</button>
        </div>
      );
    }
    render(<Probe />);
    fireEvent.click(screen.getByTestId('set'));
    expect(localStorage.getItem('custom-shell-tab')).toBe('delivery');
  });
});

// ---------- dispatchShellTabChange ----------
describe('V138 dispatchShellTabChange', () => {
  it('dispatches ai-team-shell-tab-change event', () => {
    const cb = vi.fn();
    window.addEventListener('ai-team-shell-tab-change', cb as EventListener);
    dispatchShellTabChange('delivery', 'tab1');
    expect(cb).toHaveBeenCalled();
    window.removeEventListener('ai-team-shell-tab-change', cb as EventListener);
  });

  it('ShellTabStorageEvent has correct shape', () => {
    const ev: ShellTabStorageEvent = { tab: 'delivery', source: 'tab1', ts: 12345 };
    expect(ev.tab).toBe('delivery');
    expect(ev.source).toBe('tab1');
    expect(ev.ts).toBe(12345);
  });
});

// ---------- ShellTabPersistConfig ----------
describe('V138 ShellTabPersistConfig types', () => {
  it('accepts storageKey + source', () => {
    const cfg: ShellTabPersistConfig = { storageKey: 'x', source: 'tab2' };
    expect(cfg.source).toBe('tab2');
  });
});