// V115: ErrorBoundary + ErrorState + Keyboard shortcuts (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ErrorBoundary,
  ErrorState,
  useKeyboardShortcuts,
  useGlobalShortcuts,
  KeyboardHelpOverlay,
  matchShortcut,
  SHORTCUT_PRESETS,
  navigateToRoute,
  type ShortcutBinding,
} from '../src/components/keyboard/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- ErrorBoundary ----------
describe('V115 ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">ok</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('catches render error and shows fallback', () => {
    function Boom(): React.ReactElement {
      throw new Error('render boom');
    }
    // Suppress console.error for the expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('error-boundary')).toBeTruthy();
    expect(screen.getByText(/出错了/)).toBeTruthy();
    spy.mockRestore();
  });

  it('reset button clears the error and re-renders children', () => {
    let shouldThrow = true;
    function MaybeBoom(): React.ReactElement {
      if (shouldThrow) throw new Error('boom');
      return <div data-testid="recovered">recovered</div>;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <MaybeBoom />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('error-boundary')).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByTestId('error-boundary-reset'));
    expect(screen.getByTestId('recovered')).toBeTruthy();
    spy.mockRestore();
  });
});

// ---------- ErrorState ----------
describe('V115 ErrorState', () => {
  it('renders error icon, title, description, retry', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="加载失败"
        description="网络错误"
        onRetry={onRetry}
        retryLabel="重新加载"
      />
    );
    expect(screen.getByText('加载失败')).toBeTruthy();
    expect(screen.getByText('网络错误')).toBeTruthy();
    fireEvent.click(screen.getByText('重新加载'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders without retry when onRetry omitted', () => {
    render(<ErrorState title="Forbidden" description="权限不足" />);
    expect(screen.getByText('Forbidden')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// ---------- matchShortcut ----------
describe('V115 matchShortcut', () => {
  it('matches Cmd+K with K key', () => {
    const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    expect(matchShortcut(e, { key: 'k', meta: true })).toBe(true);
  });

  it('matches Ctrl+/ with slash', () => {
    const e = new KeyboardEvent('keydown', { key: '/', ctrlKey: true });
    expect(matchShortcut(e, { key: '/', ctrl: true })).toBe(true);
  });

  it('does not match when modifier missing', () => {
    const e = new KeyboardEvent('keydown', { key: 'k' });
    expect(matchShortcut(e, { key: 'k', meta: true })).toBe(false);
  });

  it('handles "?" key with shift', () => {
    const e = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
    expect(matchShortcut(e, { key: '?', shift: true })).toBe(true);
  });

  it('treats key case-insensitively', () => {
    const e = new KeyboardEvent('keydown', { key: 'K', metaKey: true });
    expect(matchShortcut(e, { key: 'k', meta: true })).toBe(true);
  });
});

// ---------- SHORTCUT_PRESETS ----------
describe('V115 SHORTCUT_PRESETS', () => {
  it('exposes all 4 nav-group shortcuts', () => {
    expect(SHORTCUT_PRESETS.length).toBeGreaterThanOrEqual(10);
    const groups = SHORTCUT_PRESETS.map((s) => s.id);
    expect(groups).toContain('nav.recruitment');
    expect(groups).toContain('nav.members');
    expect(groups).toContain('nav.intelligence');
    expect(groups).toContain('nav.system');
  });

  it('includes search and help', () => {
    const ids = SHORTCUT_PRESETS.map((s) => s.id);
    expect(ids).toContain('palette.search');
    expect(ids).toContain('help.show');
  });

  it('every preset has id, label, key, optional meta/ctrl', () => {
    for (const p of SHORTCUT_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.key.length).toBe(1);
    }
  });
});

// ---------- navigateToRoute ----------
describe('V115 navigateToRoute', () => {
  it('maps group shortcut ids to route paths', () => {
    expect(navigateToRoute('nav.recruitment')).toBe('/candidates');
    expect(navigateToRoute('nav.members')).toBe('/members');
    expect(navigateToRoute('nav.intelligence')).toBe('/');
    expect(navigateToRoute('nav.system')).toBe('/audit');
  });

  it('returns null for unknown id', () => {
    expect(navigateToRoute('unknown.id')).toBeNull();
  });

  it('maps go-to shortcuts', () => {
    expect(navigateToRoute('go.candidate')).toBe('/candidates');
    expect(navigateToRoute('go.interview')).toBe('/interviews');
    expect(navigateToRoute('go.pipeline')).toBe('/pipeline');
  });
});

// ---------- useKeyboardShortcuts ----------
describe('V115 useKeyboardShortcuts', () => {
  it('triggers handler on matching keydown', () => {
    const handler = vi.fn();
    function Probe() {
      useKeyboardShortcuts([{ spec: { key: 'r', meta: true }, handler }]);
      return null;
    }
    render(<Probe />);
    fireEvent.keyDown(document, { key: 'r', metaKey: true });
    expect(handler).toHaveBeenCalled();
  });

  it('does not trigger for non-matching keys', () => {
    const handler = vi.fn();
    function Probe() {
      useKeyboardShortcuts([{ spec: { key: 'r', meta: true }, handler }]);
      return null;
    }
    render(<Probe />);
    fireEvent.keyDown(document, { key: 'x', metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------- useGlobalShortcuts ----------
describe('V115 useGlobalShortcuts', () => {
  it('binds all SHORTCUT_PRESETS and dispatches callbacks', () => {
    const onPalette = vi.fn();
    function Probe() {
      useGlobalShortcuts({ onPalette });
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(onPalette).toHaveBeenCalled();
  });
});

// ---------- KeyboardHelpOverlay ----------
describe('V115 KeyboardHelpOverlay', () => {
  it('lists all shortcuts when open', () => {
    render(<KeyboardHelpOverlay open onClose={() => {}} />);
    const items = screen.getAllByTestId('shortcut-row');
    expect(items.length).toBe(SHORTCUT_PRESETS.length);
  });

  it('clicking close calls onClose', () => {
    const onClose = vi.fn();
    render(<KeyboardHelpOverlay open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('keyboard-help-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(<KeyboardHelpOverlay open={false} onClose={() => {}} />);
    expect(screen.queryByTestId('keyboard-help')).toBeNull();
  });
});