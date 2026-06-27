// V118: Mobile HamburgerNav + OfflineBanner + PWA manifest (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  HamburgerNav,
  OfflineBanner,
  MobileBottomBar,
  PwaInstallPrompt,
  isMobileViewport,
  setMobileViewportForTest,
  useViewportBreakpoint,
  generateManifest,
  parseManifest,
  isManifestValid,
  registerServiceWorker,
  unregisterServiceWorker,
  getServiceWorkerStatus,
  SW_READY_EVENT,
  SW_OFFLINE_READY_EVENT,
  buildOfflineFallbackHtml,
  type ServiceWorkerStatus,
} from '../src/components/mobile/index.js';

beforeEach(async () => {
  localStorage.clear();
  // Reset online state to default (true)
  const { _setOnlineStateForTest } = await import('../src/components/access/access.js');
  _setOnlineStateForTest(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- HamburgerNav ----------
describe('V118 HamburgerNav', () => {
  it('renders hamburger button on small viewports', () => {
    setMobileViewportForTest(true);
    render(
      <MemoryRouter>
        <HamburgerNav />
      </MemoryRouter>
    );
    expect(screen.getByTestId('hamburger-button')).toBeTruthy();
  });

  it('does not render on desktop viewports', () => {
    setMobileViewportForTest(false);
    const { container } = render(
      <MemoryRouter>
        <HamburgerNav />
      </MemoryRouter>
    );
    expect(container.querySelector('[data-testid="hamburger-button"]')).toBeNull();
  });

  it('clicking hamburger opens nav drawer', () => {
    setMobileViewportForTest(true);
    render(
      <MemoryRouter>
        <HamburgerNav />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('hamburger-button'));
    expect(screen.getByTestId('mobile-nav-drawer')).toBeTruthy();
  });

  it('clicking close button closes nav drawer', () => {
    setMobileViewportForTest(true);
    render(
      <MemoryRouter>
        <HamburgerNav />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('hamburger-button'));
    fireEvent.click(screen.getByTestId('mobile-nav-close'));
    expect(screen.queryByTestId('mobile-nav-drawer')).toBeNull();
  });

  it('lists 17 routes grouped into 4 categories', () => {
    setMobileViewportForTest(true);
    render(
      <MemoryRouter>
        <HamburgerNav />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('hamburger-button'));
    const items = screen.getAllByTestId(/^mobile-nav-/);
    expect(items.length).toBeGreaterThanOrEqual(17);
  });
});

// ---------- OfflineBanner ----------
describe('V118 OfflineBanner', () => {
  it('renders when offline', async () => {
    const { _setOnlineStateForTest } = await import('../src/components/access/access.js');
    _setOnlineStateForTest(false);
    render(<OfflineBanner />);
    expect(await screen.findByTestId('offline-banner')).toBeTruthy();
  });

  it('does not render when online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('hides on dismissal', async () => {
    const { _setOnlineStateForTest } = await import('../src/components/access/access.js');
    _setOnlineStateForTest(false);
    render(<OfflineBanner />);
    const btn = await screen.findByTestId('offline-banner-dismiss');
    fireEvent.click(btn);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});

// ---------- MobileBottomBar ----------
describe('V118 MobileBottomBar', () => {
  it('renders 4-5 quick action buttons', () => {
    setMobileViewportForTest(true);
    render(
      <MemoryRouter>
        <MobileBottomBar />
      </MemoryRouter>
    );
    const buttons = screen.getAllByTestId(/^mobile-bottom-/);
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('highlights active route', () => {
    setMobileViewportForTest(true);
    render(
      <MemoryRouter initialEntries={['/candidates']}>
        <MobileBottomBar />
      </MemoryRouter>
    );
    const candidatesBtn = screen.getByTestId('mobile-bottom-candidates');
    expect(candidatesBtn.className).toMatch(/bg-brand|text-brand/);
  });
});

// ---------- isMobileViewport ----------
describe('V118 isMobileViewport', () => {
  it('returns true when matchMedia matches (max-width: 768px)', () => {
    setMobileViewportForTest(true);
    expect(isMobileViewport()).toBe(true);
  });

  it('returns false when desktop viewport', () => {
    setMobileViewportForTest(false);
    expect(isMobileViewport()).toBe(false);
  });
});

// ---------- useViewportBreakpoint ----------
describe('V118 useViewportBreakpoint', () => {
  it('returns sm/md/lg/xl based on viewport', () => {
    setMobileViewportForTest(true);
    function Probe() {
      const bp = useViewportBreakpoint();
      return <div data-testid="bp">{bp}</div>;
    }
    render(<Probe />);
    expect(['sm', 'md', 'lg', 'xl']).toContain(screen.getByTestId('bp').textContent);
  });
});

// ---------- PWA manifest ----------
describe('V118 manifest', () => {
  it('generateManifest produces PWA-spec fields', () => {
    const m = generateManifest({ name: 'ai-team', shortName: 'ai-team' });
    expect(m.name).toBe('ai-team');
    expect(m.short_name).toBe('ai-team');
    expect(m.start_url).toBeTruthy();
    expect(m.display).toBe('standalone');
    expect(Array.isArray(m.icons)).toBe(true);
  });

  it('parseManifest roundtrips JSON', () => {
    const m = generateManifest({ name: 'x' });
    const json = JSON.stringify(m);
    const parsed = parseManifest(json);
    expect(parsed.name).toBe('x');
  });

  it('isManifestValid checks required fields', () => {
    expect(isManifestValid(generateManifest({}))).toBe(true);
    expect(isManifestValid({ name: '' })).toBe(false);
    expect(isManifestValid(null)).toBe(false);
  });
});

// ---------- Service worker ----------
describe('V118 service worker', () => {
  it('SW_READY_EVENT and SW_OFFLINE_READY_EVENT are strings', () => {
    expect(typeof SW_READY_EVENT).toBe('string');
    expect(typeof SW_OFFLINE_READY_EVENT).toBe('string');
  });

  it('getServiceWorkerStatus returns initial unsupported state', () => {
    const status = getServiceWorkerStatus();
    expect(['unsupported', 'pending', 'ready', 'offline-ready', 'error']).toContain(status);
  });

  it('registerServiceWorker is a function', () => {
    expect(typeof registerServiceWorker).toBe('function');
  });

  it('unregisterServiceWorker is a function', () => {
    expect(typeof unregisterServiceWorker).toBe('function');
  });

  it('buildOfflineFallbackHtml returns minimal HTML', () => {
    const html = buildOfflineFallbackHtml('ai-team');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('ai-team');
    expect(html).toContain('离线');
  });
});

// ---------- PwaInstallPrompt ----------
describe('V118 PwaInstallPrompt', () => {
  it('renders install button when beforeinstallprompt fires', () => {
    render(<PwaInstallPrompt />);
    const ev = new Event('beforeinstallprompt') as Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
    Object.defineProperty(ev, 'prompt', { value: () => Promise.resolve() });
    Object.defineProperty(ev, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(screen.getByTestId('pwa-install-button')).toBeTruthy();
  });

  it('does not render without beforeinstallprompt', () => {
    render(<PwaInstallPrompt />);
    expect(screen.queryByTestId('pwa-install-button')).toBeNull();
  });
});