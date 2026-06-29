// V140: GlassCard (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  GlassCard,
  TopbarGlass,
  getGlassTokens,
  getCurrentTheme,
  buildGlassClassName,
  useGlassTheme,
  type GlassCardProps,
  type GlassTokens,
} from '../src/components/glass/index.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

// ---------- getGlassTokens ----------
describe('V140 getGlassTokens', () => {
  it('light theme returns light tokens', () => {
    const t = getGlassTokens('light');
    expect(t.background).toContain('white');
    expect(t.border).toContain('slate-200');
  });

  it('dark theme returns dark tokens', () => {
    const t = getGlassTokens('dark');
    expect(t.background).toContain('slate-900');
    expect(t.border).toContain('slate-700');
  });

  it('sepia theme returns warm tokens', () => {
    const t = getGlassTokens('sepia');
    expect(t.background).toContain('amber');
  });

  it('nord theme returns slate-200 tokens', () => {
    const t = getGlassTokens('nord');
    expect(t.background).toContain('slate-200');
  });

  it('default light returns valid tokens for any theme', () => {
    const t: GlassTokens = getGlassTokens('light');
    expect(t.backdrop).toBeTruthy();
    expect(t.shadow).toBeTruthy();
  });
});

// ---------- getCurrentTheme ----------
describe('V140 getCurrentTheme', () => {
  it('returns light when data-theme is light', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    expect(getCurrentTheme()).toBe('light');
  });

  it('returns dark when data-theme is dark', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(getCurrentTheme()).toBe('dark');
  });

  it('returns light when no data-theme set', () => {
    expect(getCurrentTheme()).toBe('light');
  });

  it('falls back to light for unknown theme', () => {
    document.documentElement.setAttribute('data-theme', 'foo');
    expect(getCurrentTheme()).toBe('light');
  });
});

// ---------- buildGlassClassName ----------
describe('V140 buildGlassClassName', () => {
  it('returns combined class string', () => {
    const cls = buildGlassClassName('dark', 'lg', 'strong');
    expect(cls).toContain('backdrop-blur-lg');
    expect(cls).toContain('slate-900');
    expect(cls).toContain('border');
    expect(cls).toContain('rounded-lg');
  });

  it('uses defaults when called with only theme', () => {
    const cls = buildGlassClassName('light');
    expect(cls).toContain('backdrop-blur');
  });
});

// ---------- useGlassTheme ----------
describe('V140 useGlassTheme', () => {
  it('returns current theme from data-theme attr', () => {
    function Probe() {
      const t = useGlassTheme();
      return <div data-testid="t">{t}</div>;
    }
    document.documentElement.setAttribute('data-theme', 'sepia');
    render(<Probe />);
    expect(screen.getByTestId('t').textContent).toBe('sepia');
  });

  it('updates when data-theme changes', () => {
    function Probe() {
      const t = useGlassTheme();
      return <div data-testid="t">{t}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('t').textContent).toBe('light');
    document.documentElement.setAttribute('data-theme', 'dark');
    // Trigger mutation observer
    fireEvent(document.documentElement, new Event('attributes'));
    return new Promise((resolve) => setTimeout(() => {
      expect(screen.getByTestId('t').textContent).toBe('dark');
      resolve(undefined);
    }, 50));
  });
});

// ---------- GlassCard ----------
describe('V140 GlassCard', () => {
  it('renders with default testId', () => {
    render(<GlassCard>content</GlassCard>);
    expect(screen.getByTestId('glass-card')).toBeTruthy();
  });

  it('uses custom testId', () => {
    render(<GlassCard testId="custom-glass">x</GlassCard>);
    expect(screen.getByTestId('custom-glass')).toBeTruthy();
  });

  it('applies blur class', () => {
    const { container } = render(<GlassCard blur="xl">x</GlassCard>);
    expect(container.innerHTML).toContain('backdrop-blur-2xl');
  });

  it('applies glass background based on theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { container } = render(<GlassCard>x</GlassCard>);
    expect(container.innerHTML).toContain('slate-900');
  });

  it('renders children inside', () => {
    render(<GlassCard>HELLO_CONTENT</GlassCard>);
    expect(screen.getByText('HELLO_CONTENT')).toBeTruthy();
  });
});

// ---------- TopbarGlass ----------
describe('V140 TopbarGlass', () => {
  it('renders title + subtitle', () => {
    render(<TopbarGlass title="My Title" subtitle="My Subtitle" />);
    const topbar = screen.getByTestId('topbar-glass');
    expect(topbar.textContent).toContain('My Title');
    expect(topbar.textContent).toContain('My Subtitle');
  });

  it('renders CTA when provided', () => {
    const onClick = vi.fn();
    render(<TopbarGlass title="T" cta={{ label: 'Go', onClick, testId: 'topbar-cta' }} />);
    const btn = screen.getByTestId('topbar-cta');
    expect(btn.textContent).toBe('Go');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders rightSlot', () => {
    render(<TopbarGlass title="T" rightSlot={<span data-testid="right">R</span>} />);
    expect(screen.getByTestId('right')).toBeTruthy();
  });
});

// ---------- Types ----------
describe('V140 types', () => {
  it('GlassCardProps accepts testId + blur + opacity', () => {
    const p: GlassCardProps = { testId: 'a', blur: 'lg', opacity: 'strong' };
    expect(p.testId).toBe('a');
  });

  it('GlassTokens has 4 required fields', () => {
    const t: GlassTokens = { background: 'a', backdrop: 'b', border: 'c', shadow: 'd' };
    expect(t.shadow).toBe('d');
  });
});