// V139: Hero landing — 4-module matrix with orbs background + status dots
// Reference: memory.hunyuan.tencent.com (dark-first, glass surface, glow accent)

// ReactNode reserved for future hero modules
import { Card, Badge } from '../design-system/index.js';

// ---------- Types ----------
export type ModuleStatus = 'healthy' | 'degraded' | 'blocked' | 'idle';

export interface HeroModule {
  key: string;
  title: string;
  description: string;
  route: string;
  status: ModuleStatus;
  count?: number;
  unit?: string;
  icon: string;
  testId: string;
}

export interface HeroLandingProps {
  modules: HeroModule[];
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  cta?: { label: string; route: string; testId: string };
  background?: 'orbs' | 'grid' | 'plain';
}

// ---------- Status helpers ----------
const STATUS_TONE: Record<ModuleStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  healthy: 'success',
  degraded: 'warning',
  blocked: 'danger',
  idle: 'neutral',
};

const STATUS_LABEL: Record<ModuleStatus, string> = {
  healthy: '健康',
  degraded: '降级',
  blocked: '阻塞',
  idle: '空闲',
};

export function statusTone(status: ModuleStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  return STATUS_TONE[status];
}

export function statusLabel(status: ModuleStatus): string {
  return STATUS_LABEL[status];
}

// ---------- Status dot ----------
export function StatusDot({ status, label }: { status: ModuleStatus; label?: string }) {
  const colors: Record<ModuleStatus, string> = {
    healthy: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    blocked: 'bg-rose-500',
    idle: 'bg-slate-400',
  };
  return (
    <span data-testid="status-dot" data-status={status} className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      {label && <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>}
    </span>
  );
}

// ---------- Background (orbs + grid) ----------
export function HeroBackground({ variant = 'orbs' }: { variant?: 'orbs' | 'grid' | 'plain' }) {
  if (variant === 'plain') return null;
  return (
    <div data-testid="hero-background" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {variant === 'orbs' ? (
        <>
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute right-0 top-40 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      )}
    </div>
  );
}

// ---------- Hero module card ----------
export function HeroModuleCard({ mod }: { mod: HeroModule }) {
  return (
    <Card
      testId={`hero-module-${mod.key}`}
      title={mod.title}
      subtitle={mod.description}
    >
      <div className="flex items-center justify-between">
        <span className="text-3xl" aria-hidden="true">{mod.icon}</span>
        <Badge tone={statusTone(mod.status)}>{statusLabel(mod.status)}</Badge>
      </div>
      {mod.count !== undefined && (
        <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {mod.count}
          {mod.unit && <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">{mod.unit}</span>}
        </div>
      )}
      <a
        href={mod.route}
        data-testid={`hero-module-link-${mod.key}`}
        className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        前往 →
      </a>
    </Card>
  );
}

// ---------- Hero landing ----------
export function HeroLanding({
  modules,
  title = 'ai-team',
  subtitle = '招聘 · 编排 · 决策 一体化',
  eyebrow = 'AI 协作',
  cta,
  background = 'orbs',
}: HeroLandingProps) {
  return (
    <div data-testid="hero-landing" className="relative mx-auto max-w-6xl px-6 py-12">
      <HeroBackground variant={background} />

      <header className="mb-10 text-center">
        <p data-testid="hero-eyebrow" className="text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          {eyebrow}
        </p>
        <h1 data-testid="hero-title" className="mt-3 text-4xl font-bold text-slate-900 dark:text-slate-100 sm:text-5xl">
          {title}
        </h1>
        <p data-testid="hero-subtitle" className="mt-3 text-base text-slate-600 dark:text-slate-400">
          {subtitle}
        </p>
      </header>

      <section
        data-testid="hero-modules"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {modules.map((mod) => (
          <HeroModuleCard key={mod.key} mod={mod} />
        ))}
      </section>

      {cta && (
        <div className="mt-10 flex justify-center">
          <a
            href={cta.route}
            data-testid={cta.testId}
            className="rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            {cta.label}
          </a>
        </div>
      )}
    </div>
  );
}

// ---------- Default 4 modules ----------
export function buildDefaultHeroModules(): HeroModule[] {
  return [
    { key: 'recruitment', title: '招聘', description: '候选人 + 面试 + 漏斗', route: '/candidates', status: 'healthy', count: 12, unit: '人在流程', icon: '👥', testId: 'hero-module-recruitment' },
    { key: 'orchestration', title: '编排', description: '工作流 + 审批 + 决策', route: '/orchestration', status: 'healthy', count: 4, unit: '激活 Agent', icon: '🧠', testId: 'hero-module-orchestration' },
    { key: 'audit', title: '审计', description: '证据 + 回放 + 报告', route: '/audit', status: 'degraded', count: 3, unit: '待回放', icon: '🛡️', testId: 'hero-module-audit' },
    { key: 'data', title: '数据', description: '记忆 + 指标 + 导出', route: '/data', status: 'idle', count: 0, unit: '同步任务', icon: '📊', testId: 'hero-module-data' },
  ];
}
