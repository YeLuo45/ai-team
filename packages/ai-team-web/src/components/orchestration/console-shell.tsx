// V125: ConsoleShell — tabs-based 4-panel orchestration shell
// V137: locale-aware tab labels via useConsoleTabI18n

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Card } from '../design-system/index.js';
import {
  WorkflowPanel,
  ApprovalPanel,
  DeliveryPanel,
  OperationsPanel,
} from './panels.js';
import { OrchestrationProvider } from './hooks.js';
import { useConsoleTabI18n, DEFAULT_CONSOLE_TAB, buildShellLayout, isValidTabKey, nextTabKey, prevTabKey, localizeConsoleTabLabel } from './console-i18n.js';
import type { ConsoleTabKey, ShellLayout } from './console-i18n.js';
// Re-exports for backward compat
export { CONSOLE_TAB_KEYS, DEFAULT_CONSOLE_TAB, DEFAULT_SHELL_TABS, DEFAULT_SHELL_LAYOUT, buildShellTabs, buildShellLayout, selectInitialTab, isValidTabKey, nextTabKey, prevTabKey, tabIconFor, tabLabelFor, localizeConsoleTabLabel, ariaLabelFor, localizeShellTabs, buildI18nConsoleTabList, buildConsoleTabI18n, useConsoleTabI18n } from './console-i18n.js';
export type { ShellTab, ShellLayout, ConsoleTabI18n, ConsoleTabI18nEntry } from './console-i18n.js';

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
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidTabKey(stored)) {
      tab.goto(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist on every change
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
  const { tabs: i18nTabs } = useConsoleTabI18n();
  const tabs = i18nTabs;
  const containerClass =
    layout.columns === 1
      ? 'grid grid-cols-1 gap-4'
      : layout.columns === 3
        ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
        : 'grid grid-cols-1 gap-4 md:grid-cols-2';

  return (
    <OrchestrationProvider>
      <div data-testid="console-shell" className="space-y-4">
        <Card testId="shell-toolbar" title="编排台" subtitle={`视图：${localizeConsoleTabLabel(active, 'zh-CN')}`}>
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                data-testid={t.testId}
                role="tab"
                aria-selected={active === t.key}
                onClick={() => tab.goto(t.key as ConsoleTabKey)}
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
