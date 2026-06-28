// V137: ConsoleShell i18n + locale-aware labels (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ConsoleShell,
  buildShellTabs,
  buildShellLayout,
  DEFAULT_SHELL_TABS,
  DEFAULT_SHELL_LAYOUT,
  CONSOLE_TAB_KEYS,
  DEFAULT_CONSOLE_TAB,
  useShellTab,
  useConsoleTab,
  useConsoleTabI18n,
  buildConsoleTabI18n,
  localizeConsoleTabLabel,
  isValidTabKey,
  selectTab,
  nextTabKey,
  prevTabKey,
  buildI18nConsoleTabList,
  localizeShellTabs,
  type ShellTab,
  type ShellLayout,
  type ConsoleTabI18n,
} from '../src/components/orchestration/index.js';
import { LocaleProvider, useLocaleActions, useLocale } from '../src/i18n/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Constants ----------
describe('V137 ConsoleShell i18n constants', () => {
  it('CONSOLE_TAB_KEYS has 4 entries', () => {
    expect(CONSOLE_TAB_KEYS.length).toBe(4);
  });

  it('DEFAULT_CONSOLE_TAB is workflow', () => {
    expect(DEFAULT_CONSOLE_TAB).toBe('workflow');
  });

  it('buildConsoleTabI18n returns object keyed by tab + locale', () => {
    const i18n = buildConsoleTabI18n();
    expect(i18n.workflow).toBeDefined();
    expect(i18n.workflow.en).toBe('Workflow');
    expect(i18n.workflow.zhCN).toBe('工作流');
    expect(i18n.workflow.ja).toBe('ワークフロー');
    expect(i18n.workflow.ko).toBe('워크플로우');
  });
});

// ---------- Tab navigation ----------
describe('V137 tab navigation', () => {
  it('isValidTabKey accepts known keys', () => {
    expect(isValidTabKey('workflow')).toBe(true);
    expect(isValidTabKey('approvals')).toBe(true);
    expect(isValidTabKey('delivery')).toBe(true);
    expect(isValidTabKey('operations')).toBe(true);
  });

  it('isValidTabKey rejects unknown', () => {
    expect(isValidTabKey('foo')).toBe(false);
    expect(isValidTabKey(null)).toBe(false);
  });

  it('selectTab returns canonical or default', () => {
    expect(selectTab('delivery')).toBe('delivery');
    expect(selectTab('unknown')).toBe(DEFAULT_CONSOLE_TAB);
  });

  it('nextTabKey cycles forward', () => {
    expect(nextTabKey('workflow')).toBe('approvals');
    expect(nextTabKey('approvals')).toBe('delivery');
    expect(nextTabKey('delivery')).toBe('operations');
    expect(nextTabKey('operations')).toBe('workflow');
  });

  it('prevTabKey cycles backward', () => {
    expect(prevTabKey('workflow')).toBe('operations');
    expect(prevTabKey('operations')).toBe('delivery');
  });
});

// ---------- Localize ----------
describe('V137 localizeConsoleTabLabel', () => {
  it('returns label for each locale', () => {
    expect(localizeConsoleTabLabel('workflow', 'en')).toBe('Workflow');
    expect(localizeConsoleTabLabel('workflow', 'zh-CN')).toBe('工作流');
    expect(localizeConsoleTabLabel('workflow', 'ja')).toBe('ワークフロー');
    expect(localizeConsoleTabLabel('workflow', 'ko')).toBe('워크플로우');
  });

  it('returns key for unknown tab', () => {
    expect(localizeConsoleTabLabel('foo' as any, 'en')).toBe('foo');
  });
});

// ---------- buildI18nConsoleTabList ----------
describe('V137 buildI18nConsoleTabList', () => {
  it('returns 4 tab objects with localized label', () => {
    const list = buildI18nConsoleTabList('ja');
    expect(list.length).toBe(4);
    expect(list[0]?.label).toBe('ワークフロー');
  });
});

// ---------- localizeShellTabs ----------
describe('V137 localizeShellTabs', () => {
  it('replaces labels on existing tabs', () => {
    const tabs: ShellTab[] = buildShellTabs();
    const localized = localizeShellTabs(tabs, 'ko');
    expect(localized[0]?.label).toBe('워크플로우');
    expect(localized[1]?.label).toBe('승인');
  });
});

// ---------- useConsoleTabI18n hook ----------
describe('V137 useConsoleTabI18n', () => {
  it('returns localized tabs + labelFor + ariaLabelFor', () => {
    function Probe() {
      const tabs = useConsoleTabI18n();
      return (
        <div>
          <span data-testid="first-label">{tabs.tabs[0]?.label}</span>
          <span data-testid="label-for">{tabs.labelFor('delivery')}</span>
          <span data-testid="aria">{tabs.ariaLabelFor('operations')}</span>
        </div>
      );
    }
    render(
      <LocaleProvider initialLocale="ja">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('first-label').textContent).toBe('ワークフロー');
    expect(screen.getByTestId('label-for').textContent).toBe('配信');
    expect(screen.getByTestId('aria').textContent).toBe('オペレーション タブ');
  });
});

// ---------- ConsoleShell integrates i18n ----------
describe('V137 ConsoleShell with LocaleProvider', () => {
  it('renders 4 tabs with default (zh-CN) labels', () => {
    render(
      <MemoryRouter>
        <LocaleProvider initialLocale="zh-CN">
          <ConsoleShell />
        </LocaleProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('shell-tab-workflow').textContent).toContain('工作流');
    expect(screen.getByTestId('shell-tab-approvals').textContent).toContain('审批');
    expect(screen.getByTestId('shell-tab-delivery').textContent).toContain('交付');
    expect(screen.getByTestId('shell-tab-operations').textContent).toContain('运维');
  });

  it('re-renders with ja labels when locale changes to ja', () => {
    function App() {
      const { locale, setLocale } = useLocaleActions();
      return (
        <div>
          <button data-testid="set-ja" onClick={() => setLocale('ja')}>ja</button>
          <span data-testid="locale">{locale}</span>
          <ConsoleShell />
        </div>
      );
    }
    render(
      <MemoryRouter>
        <LocaleProvider initialLocale="zh-CN">
          <App />
        </LocaleProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('shell-tab-workflow').textContent).toContain('工作流');
    fireEvent.click(screen.getByTestId('set-ja'));
    expect(screen.getByTestId('locale').textContent).toBe('ja');
    // After locale change, ConsoleShell re-renders with new labels
    expect(screen.getByTestId('shell-tab-workflow').textContent).toContain('ワークフロー');
  });
});

// ---------- buildShellTabs + DEFAULT_SHELL_TABS ----------
describe('V137 buildShellTabs + DEFAULT_SHELL_LAYOUT', () => {
  it('buildShellTabs returns 4 by default', () => {
    expect(buildShellTabs().length).toBe(4);
  });

  it('DEFAULT_SHELL_TABS has 4 entries with i18n keys', () => {
    expect(DEFAULT_SHELL_TABS.length).toBe(4);
    expect(DEFAULT_SHELL_TABS[0]?.i18nKey).toBe('console.tab.workflow');
  });

  it('DEFAULT_SHELL_LAYOUT has 2 columns + visible flags', () => {
    expect(DEFAULT_SHELL_LAYOUT.columns).toBe(2);
    expect(DEFAULT_SHELL_LAYOUT.workflow.visible).toBe(true);
  });

  it('buildShellLayout returns layout from overrides', () => {
    const l = buildShellLayout({ columns: 1 });
    expect(l.columns).toBe(1);
  });
});

// ---------- Types ----------
describe('V137 types', () => {
  it('ShellTab has key + label + icon + testId + i18nKey', () => {
    const t: ShellTab = {
      key: 'a',
      label: 'A',
      icon: '⚡',
      testId: 'shell-tab-a',
      i18nKey: 'console.tab.a',
    };
    expect(t.i18nKey).toBe('console.tab.a');
  });

  it('ConsoleTabI18n has 4 locales', () => {
    const i: ConsoleTabI18n = { workflow: { en: 'W', zhCN: '工', ja: 'ワ', ko: '워' } };
    expect(i.workflow.ko).toBe('워');
  });
});