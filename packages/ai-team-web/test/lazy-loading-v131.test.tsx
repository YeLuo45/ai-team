// V131: React.lazy route loading + Suspense fallback + Bundle analysis (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import {
  LazyRoute,
  RouteFallback,
  PageLoader,
  createLazyRoute,
  preloadRoute,
  isRoutePreloaded,
  listPreloadedRoutes,
  buildRouteManifest,
  parseRouteManifest,
  routeBundleSize,
  estimateRouteSize,
  analyzeBundle,
  buildBundleReport,
  formatBundleReport,
  BundleReport,
  RouteManifestEntry,
  DEFAULT_FALLBACK_DELAY_MS,
  SuspenseBoundary,
  preloadOnHover,
  preloadOnIdle,
  RouteErrorBoundary,
  withLazyRouteBoundary,
  useRouteLoadingState,
  RouteLoadingProvider,
  buildRouteLoadingState,
} from '../src/components/lazy/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- RouteFallback ----------
describe('V131 RouteFallback', () => {
  it('renders a spinner placeholder', () => {
    render(<RouteFallback />);
    expect(screen.getByTestId('route-fallback')).toBeTruthy();
  });

  it('accepts custom label', () => {
    render(<RouteFallback label="Loading candidates..." />);
    expect(screen.getByText('Loading candidates...')).toBeTruthy();
  });
});

// ---------- PageLoader ----------
describe('V131 PageLoader', () => {
  it('shows default fallback while loading', () => {
    render(
      <Suspense fallback={<RouteFallback />}>
        <PageLoader>
          <ThrowPromise />
        </PageLoader>
      </Suspense>
    );
    expect(screen.getByTestId('route-fallback')).toBeTruthy();
  });
});

// ---------- createLazyRoute ----------
describe('V131 createLazyRoute', () => {
  it('builds a lazy route with testId + displayName', () => {
    const Comp: React.FC = () => <div data-testid="my-lazy">Loaded</div>;
    const route = createLazyRoute({
      loader: () => Promise.resolve({ default: Comp }),
      testId: 'my-lazy',
      displayName: 'MyLazy',
    });
    expect(route.testId).toBe('my-lazy');
    expect(route.displayName).toBe('MyLazy');
  });
});

// ---------- preloadRoute / listPreloadedRoutes ----------
describe('V131 preloadRoute', () => {
  it('preloadRoute caches import result', async () => {
    const Comp = () => null;
    const promise = Promise.resolve({ default: Comp });
    const id = await preloadRoute('test-route', () => promise);
    expect(id).toBe('test-route');
    expect(isRoutePreloaded('test-route')).toBe(true);
  });

  it('listPreloadedRoutes returns all cached', async () => {
    await preloadRoute('a', () => Promise.resolve({ default: () => null }));
    await preloadRoute('b', () => Promise.resolve({ default: () => null }));
    const list = listPreloadedRoutes();
    expect(list).toContain('a');
    expect(list).toContain('b');
  });
});

// ---------- buildRouteManifest / parseRouteManifest ----------
describe('V131 route manifest', () => {
  it('buildRouteManifest returns 17 route entries', () => {
    const manifest = buildRouteManifest();
    expect(manifest.length).toBe(17);
  });

  it('every entry has path + key + testId + lazy + priority', () => {
    const manifest = buildRouteManifest();
    for (const e of manifest) {
      expect(e.path).toMatch(/^\//);
      expect(e.key.length).toBeGreaterThan(0);
      expect(e.testId).toMatch(/^route-/);
      expect(typeof e.lazy).toBe('boolean');
      expect(typeof e.priority).toBe('number');
    }
  });

  it('parseRouteManifest roundtrips JSON', () => {
    const manifest = buildRouteManifest();
    const json = JSON.stringify(manifest);
    const parsed = parseRouteManifest(json);
    expect(parsed.length).toBe(manifest.length);
  });
});

// ---------- estimateRouteSize / routeBundleSize ----------
describe('V131 bundle size estimation', () => {
  it('estimateRouteSize returns positive number for known routes', () => {
    expect(estimateRouteSize('/candidates')).toBeGreaterThan(0);
    expect(estimateRouteSize('/heatmap')).toBeGreaterThan(0);
  });

  it('routeBundleSize returns size for known + 0 for unknown', () => {
    expect(routeBundleSize('/candidates')).toBeGreaterThan(0);
    expect(routeBundleSize('/totally-unknown')).toBe(0);
  });
});

// ---------- analyzeBundle / buildBundleReport ----------
describe('V131 bundle analysis', () => {
  it('analyzeBundle returns summary', () => {
    const summary = analyzeBundle();
    expect(summary.routes).toBeGreaterThan(0);
    expect(summary.totalEstimatedKB).toBeGreaterThan(0);
  });

  it('buildBundleReport produces structured report', () => {
    const report = buildBundleReport();
    expect(report.summary).toBeDefined();
    expect(report.entries.length).toBeGreaterThan(0);
  });

  it('formatBundleReport produces text', () => {
    const report = buildBundleReport();
    const text = formatBundleReport(report);
    expect(text).toContain('Bundle Report');
  });
});

// ---------- SuspenseBoundary ----------
describe('V131 SuspenseBoundary', () => {
  it('renders children when no fallback', () => {
    render(
      <SuspenseBoundary>
        <div data-testid="child">child</div>
      </SuspenseBoundary>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});

// ---------- preloadOnHover / preloadOnIdle ----------
describe('V131 preload helpers', () => {
  it('preloadOnHover returns event handlers', () => {
    const handlers = preloadOnHover('my-route');
    expect(typeof handlers.onMouseEnter).toBe('function');
    expect(typeof handlers.onFocus).toBe('function');
  });

  it('preloadOnIdle returns cleanup fn', () => {
    const cleanup = preloadOnIdle('my-route');
    expect(typeof cleanup).toBe('function');
  });
});

// ---------- RouteErrorBoundary ----------
describe('V131 RouteErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <RouteErrorBoundary routeName="test">
        <div data-testid="child">child</div>
      </RouteErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('catches render error and shows fallback', () => {
    function Boom(): React.ReactElement {
      throw new Error('boom');
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouteErrorBoundary routeName="test">
        <Boom />
      </RouteErrorBoundary>
    );
    expect(screen.getByTestId('route-error-boundary')).toBeTruthy();
    spy.mockRestore();
  });
});

// ---------- withLazyRouteBoundary ----------
describe('V131 withLazyRouteBoundary', () => {
  it('wraps component with error + suspense boundary', () => {
    const Wrapped = withLazyRouteBoundary(() => <div data-testid="wrapped">ok</div>, 'my-route');
    render(<Wrapped />);
    expect(screen.getByTestId('wrapped')).toBeTruthy();
  });
});

// ---------- useRouteLoadingState ----------
describe('V131 useRouteLoadingState', () => {
  it('returns loading state + actions', () => {
    function Probe() {
      const state = useRouteLoadingState();
      return (
        <div>
          <span data-testid="loading">{String(state.loading)}</span>
          <span data-testid="route">{state.currentRoute ?? 'none'}</span>
          <button data-testid="start" onClick={() => state.startLoading('r1')}>start</button>
          <button data-testid="finish" onClick={() => state.finishLoading('r1')}>finish</button>
        </div>
      );
    }
    render(
      <RouteLoadingProvider>
        <Probe />
      </RouteLoadingProvider>
    );
    expect(screen.getByTestId('loading').textContent).toBe('false');
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('route').textContent).toBe('r1');
    fireEvent.click(screen.getByTestId('finish'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('buildRouteLoadingState returns initial state', () => {
    const state = buildRouteLoadingState();
    expect(state.loading).toBe(false);
    expect(state.currentRoute).toBeNull();
  });
});

// ---------- LazyRoute component ----------
describe('V131 LazyRoute component', () => {
  it('renders fallback while loading', () => {
    const Lazy = createLazyRoute({
      loader: () => new Promise<{ default: React.FC }>(() => { /* never resolve */ }),
      testId: 'never',
      displayName: 'Never',
    });
    render(
      <Suspense fallback={<RouteFallback />}>
        <LazyRoute route={Lazy} />
      </Suspense>
    );
    expect(screen.getByTestId('route-fallback')).toBeTruthy();
  });
});

// ---------- DEFAULT_FALLBACK_DELAY_MS ----------
describe('V131 DEFAULT_FALLBACK_DELAY_MS', () => {
  it('is a positive number', () => {
    expect(DEFAULT_FALLBACK_DELAY_MS).toBeGreaterThan(0);
  });
});

// ---------- BundleReport / RouteManifestEntry types ----------
describe('V131 types', () => {
  it('BundleReport has summary + entries', () => {
    const report: BundleReport = {
      summary: { routes: 1, totalEstimatedKB: 100, lazyRoutes: 1, eagerRoutes: 0 },
      entries: [
        {
          path: '/test',
          key: 'test',
          testId: 'route-test',
          lazy: true,
          priority: 1,
          estimatedKB: 50,
        },
      ],
    };
    expect(report.entries.length).toBe(1);
  });

  it('RouteManifestEntry has all required fields', () => {
    const e: RouteManifestEntry = {
      path: '/x',
      key: 'x',
      testId: 'route-x',
      lazy: true,
      priority: 1,
      estimatedKB: 10,
    };
    expect(e.path).toBe('/x');
  });
});

// Helper component for PageLoader test
function ThrowPromise(): React.ReactElement {
  throw new Promise(() => { /* never resolve */ });
}