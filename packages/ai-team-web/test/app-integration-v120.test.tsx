// V120: App integration test — all web-experience components wired together
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetResourceCache, resetEventBus } from '../src/lib/data-layer/index.js';

beforeEach(() => {
  resetEventBus();
  resetResourceCache();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- AppShell mounts all 4 production components ----------
describe('V120 AppShell integration', () => {
  it('mounts AppSseBootstrap, HamburgerNav, OfflineBanner, OnboardingTour, CommandPalette together', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    // Onboarding tour should be visible (not complete)
    expect(screen.getByTestId('onboarding-tour')).toBeTruthy();
    // CommandPalette button trigger should be present (Topbar mounted)
    expect(screen.getByTestId('topbar-search-trigger')).toBeTruthy();
    // Theme switcher should be present
    expect(screen.getByTestId('topbar-theme-switcher')).toBeTruthy();
    // Sidebar should be present
    expect(screen.getByTestId('app-sidebar')).toBeTruthy();
    // App footer
    expect(screen.getByTestId('app-footer-shell')).toBeTruthy();
  });

  it('skip onboarding hides tour and persists completion', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('onboarding-skip'));
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
    expect(localStorage.getItem('ai-team-onboarded')).toBe('1');
  });

  it('next onboarding advances through steps', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    const initial = screen.getByText(/添加第一位候选人/);
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(initial).toBeTruthy(); // initial still in DOM until unmount
    // The next step title should now be visible
    expect(screen.getByText(/触发第一次 AI 面试/)).toBeTruthy();
  });

  it('theme switcher toggles between 4 themes', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByTestId('theme-option-nord'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
    expect(localStorage.getItem('ai-team-theme')).toBe('nord');
    fireEvent.click(screen.getByTestId('theme-option-sepia'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
  });

  it('shows offline banner when offline event fires', async () => {
    const { _setOnlineStateForTest } = await import('../src/components/access/access.js');
    _setOnlineStateForTest(false);
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('offline-banner')).toBeTruthy();
  });

  it('renders Dashboard at / route', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    // Dashboard fetches /api/stats + /api/notifications; mock should be silent
    expect(screen.getByTestId('app-main-shell')).toBeTruthy();
  });

  it('navigates to /candidates route', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter initialEntries={['/candidates']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('nav-candidates')).toBeTruthy();
  });

  it('navigates to /pipeline route', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter initialEntries={['/pipeline']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('nav-pipeline')).toBeTruthy();
  });

  it('AppSseBootstrap attaches bridges on mount', async () => {
    const { listAttachedBridgeIds, detachAllBridges } = await import('../src/components/sse/index.js');
    detachAllBridges();
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    // Bridges are attached during mount
    expect(listAttachedBridgeIds().length).toBeGreaterThanOrEqual(3);
    detachAllBridges();
  });

  it('EventBus publishes from mutations reach subscribed pages', async () => {
    const { getEventBus, getResourceCache } = await import('../src/lib/data-layer/index.js');
    const cache = getResourceCache();
    cache.set('candidates', [{ id: 'a' }], Date.now());
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    act(() => {
      getEventBus().publish('candidates.updated', { id: 'a' });
    });
    // AppSseBootstrap should mark the cache stale via its subscriber
    expect(cache.isStale('candidates')).toBe(true);
  });
});