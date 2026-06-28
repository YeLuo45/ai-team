// V137: ConsoleShell i18n — locale-aware tab labels + i18n keys
// Note: useShellTab / useConsoleTab live in console-shell.tsx (V125).

import { useMemo } from 'react';
import { useLocale, type WebLocale } from '../../i18n/web-i18n.js';

// ---------- Types ----------
export interface ConsoleTabI18nEntry {
  en: string;
  zhCN: string;
  ja: string;
  ko: string;
}

export type ConsoleTabI18n = Record<string, ConsoleTabI18nEntry>;

export interface ShellTab {
  key: string;
  label: string;
  icon: string;
  testId: string;
  i18nKey?: string;
}

export interface ShellLayout {
  columns: number;
  workflow: { visible: boolean };
  approvals: { visible: boolean };
  delivery: { visible: boolean };
  operations: { visible: boolean };
}

// ---------- Tab keys + defaults ----------
export const CONSOLE_TAB_KEYS = ['workflow', 'approvals', 'delivery', 'operations'] as const;
export type ConsoleTabKey = (typeof CONSOLE_TAB_KEYS)[number];

export const DEFAULT_CONSOLE_TAB: ConsoleTabKey = 'workflow';

// ---------- i18n data ----------
export function buildConsoleTabI18n(): ConsoleTabI18n {
  return {
    workflow: { en: 'Workflow', zhCN: '工作流', ja: 'ワークフロー', ko: '워크플로우' },
    approvals: { en: 'Approvals', zhCN: '审批', ja: '承認', ko: '승인' },
    delivery: { en: 'Delivery', zhCN: '交付', ja: '配信', ko: '전달' },
    operations: { en: 'Operations', zhCN: '运维', ja: 'オペレーション', ko: '운영' },
  };
}

const TAB_I18N: ConsoleTabI18n = buildConsoleTabI18n();

const TAB_ICONS: Record<string, string> = {
  workflow: '🔄',
  approvals: '⚖️',
  delivery: '🚚',
  operations: '🛰️',
};

const TAB_LABELS: Record<string, string> = {
  workflow: '工作流',
  approvals: '审批',
  delivery: '交付',
  operations: '运维',
};

function localeKey(locale: WebLocale): 'en' | 'zhCN' | 'ja' | 'ko' {
  return locale === 'zh-CN' ? 'zhCN' : (locale as 'en' | 'ja' | 'ko');
}

export function localizeConsoleTabLabel(key: string, locale: WebLocale): string {
  const entry = TAB_I18N[key];
  if (!entry) return key;
  return entry[localeKey(locale)];
}

export function ariaLabelFor(key: string, locale: WebLocale): string {
  const tab = localizeConsoleTabLabel(key, locale);
  const ariaMap: Record<WebLocale, string> = {
    en: 'Tab',
    'zh-CN': '标签页',
    ja: 'タブ',
    ko: '탭',
  };
  return `${tab} ${ariaMap[locale] ?? 'Tab'}`;
}

export function tabIconFor(key: string): string {
  return TAB_ICONS[key] ?? '?';
}

export function tabLabelFor(key: string): string {
  return TAB_LABELS[key] ?? key;
}

// ---------- Tab list ----------
export function buildI18nConsoleTabList(locale: WebLocale): ShellTab[] {
  return CONSOLE_TAB_KEYS.map((key) => ({
    key,
    label: localizeConsoleTabLabel(key, locale),
    icon: tabIconFor(key),
    testId: `shell-tab-${key}`,
    i18nKey: `console.tab.${key}`,
  }));
}

export function localizeShellTabs(tabs: ShellTab[], locale: WebLocale): ShellTab[] {
  return tabs.map((t) => ({ ...t, label: localizeConsoleTabLabel(t.key, locale) }));
}

// ---------- Shell tabs default + layout ----------
export const DEFAULT_SHELL_TABS: ShellTab[] = buildI18nConsoleTabList('zh-CN');

export const DEFAULT_SHELL_LAYOUT: ShellLayout = {
  columns: 2,
  workflow: { visible: true },
  approvals: { visible: true },
  delivery: { visible: true },
  operations: { visible: true },
};

export function buildShellTabs(overrides?: ShellTab[]): ShellTab[] {
  if (overrides && overrides.length > 0) return [...overrides];
  return DEFAULT_SHELL_TABS.map((t) => ({ ...t }));
}

export function buildShellLayout(overrides?: Partial<ShellLayout>): ShellLayout {
  return { ...DEFAULT_SHELL_LAYOUT, ...(overrides ?? {}) };
}

// ---------- Tab navigation helpers ----------
export function isValidTabKey(value: unknown): value is ConsoleTabKey {
  return typeof value === 'string' && (CONSOLE_TAB_KEYS as readonly string[]).includes(value);
}

export function selectTab(value: unknown): ConsoleTabKey {
  return isValidTabKey(value) ? value : DEFAULT_CONSOLE_TAB;
}

export function selectInitialTab(value: unknown): ConsoleTabKey {
  return selectTab(value);
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

// ---------- useConsoleTabI18n ----------
export function useConsoleTabI18n(): { tabs: ShellTab[]; labelFor: (key: string) => string; ariaLabelFor: (key: string) => string } {
  const locale = useLocale();
  const tabs = useMemo(() => buildI18nConsoleTabList(locale), [locale]);
  return {
    tabs,
    labelFor: (key) => localizeConsoleTabLabel(key, locale),
    ariaLabelFor: (key) => ariaLabelFor(key, locale),
  };
}
