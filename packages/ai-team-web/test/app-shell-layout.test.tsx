// V30 + V107: App shell centered responsive layout tests
// V107 evolution: 17-link horizontal nav → AppShell + 4-group Sidebar + Topbar
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.js';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })) as any;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('V30+V107 App shell layout', () => {
  it('uses AppShell with centered main and footer at consistent shell width', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    // V107 AppShell exposes sidebar + topbar + main + footer testIds
    expect(screen.getByTestId('app-sidebar')).toBeTruthy();
    expect(screen.getByTestId('app-topbar')).toBeTruthy();

    const main = screen.getByTestId('app-main-shell');
    const footer = screen.getByTestId('app-footer-shell');
    expect(main.className).toContain('mx-auto');
    expect(main.className).toContain('max-w-7xl');
    expect(footer.className).toContain('mx-auto');
  });

  it('collapses 17 routes into 4 sidebar groups instead of overflowing horizontally', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    // V107 nav structure: 4 groups (recruitment / members / intelligence / system)
    expect(screen.getByTestId('nav-group-recruitment')).toBeTruthy();
    expect(screen.getByTestId('nav-group-members')).toBeTruthy();
    expect(screen.getByTestId('nav-group-intelligence')).toBeTruthy();
    expect(screen.getByTestId('nav-group-system')).toBeTruthy();

    // All 17 nav items are exposed via the sidebar (no horizontal scroll)
    expect(screen.getByTestId('nav-candidates')).toBeTruthy();
    expect(screen.getByTestId('nav-pipeline')).toBeTruthy();
    expect(screen.getByTestId('nav-skills')).toBeTruthy();
    expect(screen.getByTestId('nav-orchestration')).toBeTruthy();
    expect(screen.getByTestId('nav-data')).toBeTruthy();

    // No overflow fallback markers from the old horizontal nav
    expect(screen.queryByTestId('app-primary-nav')).toBeNull();
  });

  it('Topbar mounts search trigger and theme switcher (4 themes)', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('topbar-search-trigger')).toBeTruthy();
    const switcher = screen.getByTestId('topbar-theme-switcher');
    expect(switcher).toBeTruthy();
    expect(screen.getByTestId('theme-option-light')).toBeTruthy();
    expect(screen.getByTestId('theme-option-dark')).toBeTruthy();
    expect(screen.getByTestId('theme-option-sepia')).toBeTruthy();
    expect(screen.getByTestId('theme-option-nord')).toBeTruthy();
  });
});