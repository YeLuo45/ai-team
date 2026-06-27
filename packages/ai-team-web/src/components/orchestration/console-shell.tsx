// V125: ConsoleShell — tabs-based 4-panel orchestration shell

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Card } from '../design-system/index.js';
import {
  OrchestrationProvider,
  WorkflowPanel,
  ApprovalPanel,
  DeliveryPanel,
  OperationsPanel,
  DEFAULT_PANEL_TABS,
} from './index.js';

// ---------- Constants ----------
export const CONSOLE_TAB_KEYS = ['workflow', 'approvals', 'delivery', 'operations'] as const;
export type ConsoleTabKey = (typeof CONSOLE_TAB_KEYS)[number];

export const DEFAULT_CONSOLE_TAB: ConsoleTabKey = 'workflow';

const TAB_ICONS: Record<ConsoleTabKey, string> = {
  workflow: '🔄',
  approvals: '⚖️',
  delivery: '🚚',
  operations: '🛰️',
};

const TAB_LABELS: Record<ConsoleTabKey, string> = {
  workflow: '工作流',
  approvals: '审批',
  delivery: '交付',
  operations: '运维',
};

export const DEFAULT_SHELL_TABS = CONSOLE_TAB_KEYS.map((key) => ({
  key,
  label: TAB_LABELS[key],
  icon: TAB_ICONS[key],
  testId: `shell-tab-${key}`,
}));

// ---------- Pure helpers ----------
export function isValidTabKey(value: unknown): value is ConsoleTabKey {
  return typeof value === 'string' && (CONSOLE_TAB_KEYS as readonly string[]).includes(value);
}

export function selectInitialTab(value: unknown): ConsoleTabKey {
  return isValidTabKey(value) ? value : DEFAULT_CONSOLE_TAB;
}

export function nextTabKey(current: ConsoleTabKey): ConsoleTabKey {
  const idx = CONSOLE_TAB_KEYS.indexOf(current);
  const next = (idx + 1) % CONSOLE_TAB_KEYS.length;
  return CONSOLE_TAB_KEYS[next]!;
}

export function prevTabKey(current: ConsoleTabKey): ConsoleTabKey {
  const idx = CONSOLE_TAB_KEYS.indexOf(current);
  const prev = (idx - 1 + CONSOLE_TAB_KEYS.length) % CONSOLE_TAB_KEYS.length;
  return CONSOLE_TAB_KEYS[prev]!;
}

export function tabIconFor(key: string): string {
  return (TAB_ICONS as Record<string, string>)[key] ?? '?';
}

export function tabLabelFor(key: string): string {
  return (TAB_LABELS as Record<string, string>)[key] ?? key;
}

export interface ShellTab {
  key: ConsoleTabKey;
  label: string;
  icon: string;
  testId: string;
}

export function buildShellTabs(overrides?: ShellTab[]): ShellTab[] {
  if (overrides && overrides.length > 0) return [...overrides];
  return DEFAULT_SHELL_TABS.map((t) => ({ ...t }));
}

// ---------- Shell layout ----------
export interface ShellLayout {
  columns: 1 | 2 | 3;
  workflow: { visible: boolean };
  approvals: { visible: boolean };
  delivery: { visible: boolean };
  operations: { visible: boolean };
}

export const DEFAULT_SHELL_LAYOUT: ShellLayout = {
  columns: 2,
  workflow: { visible: true },
  approvals: { visible: true },
  delivery: { visible: true },
  operations: { visible: true },
};

export function buildShellLayout(overrides?: Partial<ShellLayout>): ShellLayout {
  return { ...DEFAULT_SHELL_LAYOUT, ...(overrides ?? {}) };
}

// ---------- Hooks ----------
const STORAGE_KEY = 'ai-team-console-tab';

export function useShellTab() {
  const [active, setActive] = useState<ConsoleTabKey>(DEFAULT_CONSOLE_TAB);

  const goto = useCallback((key: ConsoleTabKey) => {
    if (isValidTabKey(key)) setActive(key);
  }, []);

  const next = useCallback(() => {
    setActive((prev) => nextTabKey(prev));
  }, []);

  const prev = useCallback(() => {
    setActive((prev) => prevTabKey(prev));
  }, []);

  const reset = useCallback(() => {
    setActive(DEFAULT_CONSOLE_TAB);
  }, []);

  return { active, goto, next, prev, reset };
}

export function useConsoleTab() {
  const tab = useShellTab();
  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidTabKey(stored)) {
      tab.goto(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist on every change (subscribe to active via wrapper)
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, tab.active);
    } catch {
      /* ignore quota */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.active]);
  return tab;
}

// ---------- ConsoleShell component ----------
export interface ConsoleShellProps {
  initialTab?: ConsoleTabKey;
  layout?: ShellLayout;
  toolbar?: ReactNode;
}

export function ConsoleShell({ initialTab, layout: layoutProp, toolbar }: ConsoleShellProps = {}) {
  const tab = useShellTab();
  // Apply initialTab override once on mount
  useEffect(() => {
    if (initialTab) tab.goto(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layout = buildShellLayout(layoutProp);
  const active = tab.active;
  const tabs = buildShellTabs();
  const containerClass =
    layout.columns === 1
      ? 'grid grid-cols-1 gap-4'
      : layout.columns === 3
        ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
        : 'grid grid-cols-1 gap-4 md:grid-cols-2';

  return (
    <OrchestrationProvider>
      <div data-testid="console-shell" className="space-y-4">
        <Card testId="shell-toolbar" title="编排台" subtitle={`视图：${tabLabelFor(active)}`}>
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                data-testid={t.testId}
                role="tab"
                aria-selected={active === t.key}
                onClick={() => tab.goto(t.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active === t.key
                    ? 'bg-brand-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
            {toolbar}
          </div>
        </Card>

        <div className={containerClass} data-testid={`shell-active-${active}`}>
          {active === 'workflow' && layout.workflow.visible && <WorkflowPanel />}
          {active === 'approvals' && layout.approvals.visible && <ApprovalPanel />}
          {active === 'delivery' && layout.delivery.visible && <DeliveryPanel />}
          {active === 'operations' && layout.operations.visible && <OperationsPanel />}
        </div>
      </div>
    </OrchestrationProvider>
  );
}