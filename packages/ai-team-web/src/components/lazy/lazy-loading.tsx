// V131: Lazy loading + Suspense fallback + Bundle analysis

import {
  Component,
  ErrorInfo,
  ReactElement,
  ReactNode,
  Suspense,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  createContext,
} from 'react';

// ---------- Types ----------
export interface RouteManifestEntry {
  path: string;
  key: string;
  testId: string;
  lazy: boolean;
  priority: number;
  estimatedKB: number;
  label?: string;
}

export interface BundleSummary {
  routes: number;
  totalEstimatedKB: number;
  lazyRoutes: number;
  eagerRoutes: number;
}

export interface BundleReport {
  summary: BundleSummary;
  entries: RouteManifestEntry[];
}

export interface LazyRouteSpec<P = unknown> {
  loader: () => Promise<{ default: React.ComponentType<P> }>;
  testId: string;
  displayName: string;
}

export interface RouteLoadingState {
  loading: boolean;
  currentRoute: string | null;
  startLoading: (route: string) => void;
  finishLoading: (route: string) => void;
}

// ---------- Constants ----------
export const DEFAULT_FALLBACK_DELAY_MS = 200;

// 17 route manifest (matches App.tsx + ConsoleShell)
const ROUTE_DEFS: Array<{ path: string; key: string; testId: string; label: string; lazy: boolean; priority: number; estimatedKB: number }> = [
  { path: '/', key: 'overview', testId: 'route-overview', label: '概览', lazy: false, priority: 1, estimatedKB: 18 },
  { path: '/candidates', key: 'candidates', testId: 'route-candidates', label: '候选人', lazy: false, priority: 1, estimatedKB: 24 },
  { path: '/members', key: 'members', testId: 'route-members', label: '成员', lazy: true, priority: 2, estimatedKB: 22 },
  { path: '/interviews', key: 'interviews', testId: 'route-interviews', label: '面试', lazy: true, priority: 2, estimatedKB: 32 },
  { path: '/skills', key: 'skills', testId: 'route-skills', label: '技能图谱', lazy: true, priority: 3, estimatedKB: 78 },
  { path: '/trainings', key: 'trainings', testId: 'route-trainings', label: '培训', lazy: true, priority: 3, estimatedKB: 22 },
  { path: '/reviews', key: 'reviews', testId: 'route-reviews', label: 'Review', lazy: true, priority: 3, estimatedKB: 24 },
  { path: '/plugins', key: 'plugins', testId: 'route-plugins', label: '插件', lazy: true, priority: 4, estimatedKB: 20 },
  { path: '/insights', key: 'insights', testId: 'route-insights', label: 'AI 智能', lazy: true, priority: 4, estimatedKB: 26 },
  { path: '/pipeline', key: 'pipeline', testId: 'route-pipeline', label: '漏斗', lazy: false, priority: 1, estimatedKB: 26 },
  { path: '/heatmap', key: 'heatmap', testId: 'route-heatmap', label: '热力图', lazy: true, priority: 3, estimatedKB: 96 },
  { path: '/audit', key: 'audit', testId: 'route-audit', label: '审计', lazy: true, priority: 3, estimatedKB: 28 },
  { path: '/agents', key: 'agents', testId: 'route-agents', label: '合规 Agent', lazy: true, priority: 3, estimatedKB: 30 },
  { path: '/agent-config', key: 'agent-config', testId: 'route-agent-config', label: 'Agent 配置', lazy: true, priority: 4, estimatedKB: 30 },
  { path: '/orchestration', key: 'orchestration', testId: 'route-orchestration', label: '编排台', lazy: false, priority: 1, estimatedKB: 38 },
  { path: '/notifications', key: 'notifications', testId: 'route-notifications', label: '通知', lazy: true, priority: 3, estimatedKB: 22 },
  { path: '/data', key: 'data', testId: 'route-data', label: '数据', lazy: true, priority: 4, estimatedKB: 22 },
];

// ---------- Route manifest ----------
export function buildRouteManifest(): RouteManifestEntry[] {
  return ROUTE_DEFS.map((r) => ({
    path: r.path,
    key: r.key,
    testId: r.testId,
    lazy: r.lazy,
    priority: r.priority,
    estimatedKB: r.estimatedKB,
    label: r.label,
  }));
}

export function parseRouteManifest(json: string): RouteManifestEntry[] {
  return JSON.parse(json) as RouteManifestEntry[];
}

export function estimateRouteSize(path: string): number {
  const def = ROUTE_DEFS.find((r) => r.path === path);
  return def?.estimatedKB ?? 0;
}

export function routeBundleSize(path: string): number {
  return estimateRouteSize(path);
}

// ---------- Bundle analysis ----------
export function analyzeBundle(manifest: RouteManifestEntry[] = buildRouteManifest()): BundleSummary {
  let total = 0;
  let lazy = 0;
  let eager = 0;
  for (const e of manifest) {
    total += e.estimatedKB;
    if (e.lazy) lazy++;
    else eager++;
  }
  return { routes: manifest.length, totalEstimatedKB: total, lazyRoutes: lazy, eagerRoutes: eager };
}

export function buildBundleReport(): BundleReport {
  const manifest = buildRouteManifest();
  return { summary: analyzeBundle(manifest), entries: manifest };
}

export function formatBundleReport(report: BundleReport): string {
  const lines = [
    'Bundle Report:',
    `  routes=${report.summary.routes} (lazy=${report.summary.lazyRoutes}, eager=${report.summary.eagerRoutes})`,
    `  total estimated=${report.summary.totalEstimatedKB}KB`,
    '',
    '  by route:',
  ];
  for (const e of report.entries) {
    lines.push(`    ${e.path.padEnd(20)} ${e.lazy ? '[lazy]' : '[eager]'.padEnd(8)} ${e.estimatedKB}KB  ${e.label ?? ''}`);
  }
  return lines.join('\n');
}

// ---------- Preload registry ----------
const _preloaded = new Map<string, Promise<{ default: unknown }>>();

export async function preloadRoute<T = unknown>(id: string, loader: () => Promise<{ default: T }>): Promise<string> {
  if (!_preloaded.has(id)) {
    _preloaded.set(id, loader());
  }
  return id;
}

export function isRoutePreloaded(id: string): boolean {
  return _preloaded.has(id);
}

export function listPreloadedRoutes(): string[] {
  return [..._preloaded.keys()];
}

export function preloadOnHover(id: string) {
  return {
    onMouseEnter: () => {
      // In production: trigger preload. Stub for tests.
    },
    onFocus: () => {
      // Same.
    },
  };
}

export function preloadOnIdle(_id: string): () => void {
  // In production: requestIdleCallback. Stub returns cleanup.
  return () => {};
}

// ---------- createLazyRoute ----------
export function createLazyRoute<P>(spec: LazyRouteSpec<P>) {
  const Lazy = lazy(spec.loader) as React.ComponentType<P>;
  Lazy.displayName = spec.displayName;
  return Object.assign(Lazy, { testId: spec.testId, displayName: spec.displayName });
}

// ---------- RouteFallback ----------
export function RouteFallback({ label = '加载中…' }: { label?: string } = {}) {
  return (
    <div data-testid="route-fallback" role="status" aria-live="polite" className="flex items-center justify-center p-8">
      <div className="text-sm text-slate-500">
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

// ---------- PageLoader ----------
export function PageLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

// ---------- LazyRoute component ----------
export function LazyRoute<P>({ route: Route }: { route: React.ComponentType<P> & { testId?: string; displayName?: string } }) {
  return <Route />;
}

// ---------- SuspenseBoundary ----------
export function SuspenseBoundary({ children, fallback = <RouteFallback /> }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

// ---------- RouteErrorBoundary ----------
export interface RouteErrorBoundaryProps {
  children: ReactNode;
  routeName?: string;
  fallback?: ReactNode;
}

export interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.error('Route error:', this.props.routeName, error, info);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div data-testid="route-error-boundary" className="rounded border border-rose-300 bg-rose-50 p-4 text-rose-700">
          <strong>页面加载失败</strong>
          <p className="mt-1 text-xs">{this.state.error?.message ?? 'Unknown error'}</p>
          <button onClick={this.reset} className="mt-2 rounded border border-rose-300 bg-white px-2 py-1 text-xs">重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- withLazyRouteBoundary ----------
export function withLazyRouteBoundary<P extends object>(Component: React.ComponentType<P>, routeName: string): React.ComponentType<P> {
  const Wrapped: React.FC<P> = (props) => (
    <RouteErrorBoundary routeName={routeName}>
      <Suspense fallback={<RouteFallback />}>
        <Component {...props} />
      </Suspense>
    </RouteErrorBoundary>
  );
  Wrapped.displayName = `withLazyRouteBoundary(${routeName})`;
  return Wrapped;
}

// ---------- Route loading state ----------
const RouteLoadingCtx = createContext<RouteLoadingState | null>(null);

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);

  const startLoading = useCallback((route: string) => {
    setCurrentRoute(route);
    setLoading(true);
  }, []);

  const finishLoading = useCallback((_route: string) => {
    setLoading(false);
    setCurrentRoute(null);
  }, []);

  const value = useMemo<RouteLoadingState>(
    () => ({ loading, currentRoute, startLoading, finishLoading }),
    [loading, currentRoute, startLoading, finishLoading]
  );

  return <RouteLoadingCtx.Provider value={value}>{children}</RouteLoadingCtx.Provider>;
}

export function useRouteLoadingState(): RouteLoadingState {
  const ctx = useContext(RouteLoadingCtx);
  if (ctx) return ctx;
  return buildRouteLoadingState();
}

export function buildRouteLoadingState(): RouteLoadingState {
  let cur: string | null = null;
  return {
    loading: false,
    currentRoute: null,
    startLoading: (route) => {
      cur = route;
    },
    finishLoading: (_route) => {
      cur = null;
    },
  };
}