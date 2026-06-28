// V129: Web i18n — locale switching + ja/ko language packs + useT hook

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ---------- Types ----------
export type WebLocale = 'en' | 'zh-CN' | 'ja' | 'ko';

export interface WebLocaleMeta {
  key: WebLocale;
  label: string;
  flag: string;
  bcp47: string;
}

// ---------- Constants ----------
export const SUPPORTED_WEB_LOCALES: WebLocale[] = ['en', 'zh-CN', 'ja', 'ko'];
export const DEFAULT_WEB_LOCALE: WebLocale = 'zh-CN';

export const WEB_LOCALE_META: Record<WebLocale, WebLocaleMeta> = {
  en: { key: 'en', label: 'English', flag: '🇺🇸', bcp47: 'en' },
  'zh-CN': { key: 'zh-CN', label: '简体中文', flag: '🇨🇳', bcp47: 'zh-CN' },
  ja: { key: 'ja', label: '日本語', flag: '🇯🇵', bcp47: 'ja' },
  ko: { key: 'ko', label: '한국어', flag: '🇰🇷', bcp47: 'ko' },
};

const STORAGE_KEY = 'ai-team-web-locale';

// ---------- Validation ----------
export function isValidWebLocale(value: unknown): value is WebLocale {
  return typeof value === 'string' && (SUPPORTED_WEB_LOCALES as string[]).includes(value);
}

export function parseWebLocale(value: unknown): WebLocale | null {
  return isValidWebLocale(value) ? value : null;
}

export function getWebLocaleMeta(locale: WebLocale): WebLocaleMeta {
  return WEB_LOCALE_META[locale];
}

export function selectWebLocale(value: unknown): WebLocale {
  return isValidWebLocale(value) ? value : DEFAULT_WEB_LOCALE;
}

// ---------- Browser detection ----------
export function detectBrowserLocale(navigatorLanguage?: string): WebLocale {
  const lang = (navigatorLanguage ?? (typeof navigator !== 'undefined' ? navigator.language : 'en')).toLowerCase();
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh-CN';
  return 'en';
}

// ---------- Storage ----------
export function getStoredWebLocale(): WebLocale {
  if (typeof localStorage === 'undefined') return DEFAULT_WEB_LOCALE;
  const raw = localStorage.getItem(STORAGE_KEY);
  return selectWebLocale(raw);
}

export function setStoredWebLocale(locale: WebLocale): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore quota */
  }
}

// ---------- Translation primitives ----------
export type TranslationDict = {
  [key: string]: string | TranslationDict | string[] | TranslationDict[];
};

export type WebTranslations = Record<WebLocale, TranslationDict>;

export function listKeys(dict: TranslationDict, prefix = ''): string[] {
  const out: string[] = [];
  for (const key of Object.keys(dict)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const value = dict[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...listKeys(value as TranslationDict, full));
    } else {
      out.push(full);
    }
  }
  return out;
}

export function getTranslation(dict: TranslationDict, key: string): string | null {
  const parts = key.split('.');
  let cur: string | TranslationDict | unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return typeof cur === 'string' ? cur : null;
}

export function translate(
  dict: TranslationDict,
  key: string,
  options?: { fallback?: string }
): string {
  const value = getTranslation(dict, key);
  if (value !== null) return value;
  return options?.fallback ?? key;
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    return key in vars ? String(vars[key]) : match;
  });
}

// ---------- Plural rules ----------
export type PluralForm = 'zero' | 'one' | 'other';

export interface PluralRules {
  zero?: number;
  one: number;
  other: number;
}

export const pluralRules: Record<WebLocale, PluralRules> = {
  en: { one: 1, other: 2 },
  'zh-CN': { one: 1, other: 2 },
  ja: { one: 1, other: 2 },
  ko: { one: 1, other: 2 },
};

export function pickPluralForm(count: number, rules: PluralRules): PluralForm {
  if (rules.zero !== undefined && count === rules.zero) return 'zero';
  if (count === rules.one) return 'one';
  return 'other';
}

export interface PluralDict {
  zero?: string;
  one?: string;
  other: string;
}

export function pluralize(dict: PluralDict, count: number, rules: PluralRules, vars?: Record<string, string | number>): string {
  const form = pickPluralForm(count, rules);
  const template = dict[form] ?? dict.other;
  return interpolate(template, { count, ...(vars ?? {}) });
}

// ---------- Translation helpers ----------
export function isMissingKey(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function countMissingKeys(reference: TranslationDict, target: TranslationDict): number {
  const refKeys = new Set(listKeys(reference));
  const targetKeys = new Set(listKeys(target));
  let missing = 0;
  for (const k of refKeys) if (!targetKeys.has(k)) missing++;
  return missing;
}

export function isTranslationEqual(a: string, b: string): boolean {
  return a === b;
}

export function validateTranslations(reference: TranslationDict, target: TranslationDict): string[] {
  const refKeys = new Set(listKeys(reference));
  const targetKeys = new Set(listKeys(target));
  return [...refKeys].filter((k) => !targetKeys.has(k));
}

export function mergeTranslations(...dicts: TranslationDict[]): TranslationDict {
  const out: TranslationDict = {};
  for (const d of dicts) {
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = { ...((out[k] as TranslationDict) ?? {}), ...v } as TranslationDict;
      } else {
        out[k] = v as string;
      }
    }
  }
  return out;
}

// ---------- Translation dictionaries ----------
export const WEB_EN_TRANSLATIONS: TranslationDict = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
  },
  design: {
    button: 'Button',
    badgeSuccess: 'Success',
    badgeWarning: 'Warning',
    badgeDanger: 'Error',
    badgeInfo: 'Info',
    badgeNeutral: 'Neutral',
    empty: 'No data',
    section: 'Section',
    card: 'Card',
    stat: 'Stat',
    tabs: 'Tabs',
    drawer: 'Drawer',
    sheet: 'Sheet',
    popover: 'Popover',
    tooltip: 'Tooltip',
  },
  nav: {
    dashboard: 'Dashboard',
    candidates: 'Candidates',
    members: 'Members',
    interviews: 'Interviews',
    skills: 'Skills',
    trainings: 'Trainings',
    reviews: 'Reviews',
    plugins: 'Plugins',
    insights: 'Insights',
    pipeline: 'Pipeline',
    heatmap: 'Heatmap',
    audit: 'Audit',
    agents: 'Agents',
    'agent-config': 'Agent config',
    orchestration: 'Orchestration',
    notifications: 'Notifications',
    data: 'Data',
  },
  auth: {
    welcome: 'Welcome, {{name}}!',
    login: 'Log in',
    logout: 'Log out',
  },
};

export const WEB_ZH_CN_TRANSLATIONS: TranslationDict = {
  common: {
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    search: '搜索',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    confirm: '确认',
    yes: '是',
    no: '否',
  },
  design: {
    button: '按钮',
    badgeSuccess: '成功',
    badgeWarning: '警告',
    badgeDanger: '错误',
    badgeInfo: '信息',
    badgeNeutral: '中性',
    empty: '暂无数据',
    section: '区域',
    card: '卡片',
    stat: '统计',
    tabs: '标签',
    drawer: '抽屉',
    sheet: '底部抽屉',
    popover: '气泡',
    tooltip: '提示',
  },
  nav: {
    dashboard: '概览',
    candidates: '候选人',
    members: '成员',
    interviews: '面试',
    skills: '技能',
    trainings: '培训',
    reviews: 'Review',
    plugins: '插件',
    insights: '智能',
    pipeline: '漏斗',
    heatmap: '热力图',
    audit: '审计',
    agents: '合规 Agent',
    'agent-config': 'Agent 配置',
    orchestration: '编排台',
    notifications: '通知',
    data: '数据',
  },
  auth: {
    welcome: '欢迎，{{name}}！',
    login: '登录',
    logout: '退出',
  },
};

export const WEB_JA_TRANSLATIONS: TranslationDict = {
  common: {
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    edit: '編集',
    create: '作成',
    search: '検索',
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
    confirm: '確認',
    yes: 'はい',
    no: 'いいえ',
  },
  design: {
    button: 'ボタン',
    badgeSuccess: '成功',
    badgeWarning: '警告',
    badgeDanger: 'エラー',
    badgeInfo: '情報',
    badgeNeutral: '中立',
    empty: 'データなし',
    section: 'セクション',
    card: 'カード',
    stat: '統計',
    tabs: 'タブ',
    drawer: 'ドロワー',
    sheet: 'シート',
    popover: 'ポップオーバー',
    tooltip: 'ツールチップ',
  },
  nav: {
    dashboard: 'ダッシュボード',
    candidates: '候補者',
    members: 'メンバー',
    interviews: '面接',
    skills: 'スキル',
    trainings: '研修',
    reviews: 'レビュー',
    plugins: 'プラグイン',
    insights: 'インサイト',
    pipeline: 'パイプライン',
    heatmap: 'ヒートマップ',
    audit: '監査',
    agents: 'エージェント',
    'agent-config': 'エージェント設定',
    orchestration: 'オーケストレーション',
    notifications: '通知',
    data: 'データ',
  },
  auth: {
    welcome: 'ようこそ、{{name}}さん！',
    login: 'ログイン',
    logout: 'ログアウト',
  },
};

export const WEB_KO_TRANSLATIONS: TranslationDict = {
  common: {
    save: '저장',
    cancel: '취소',
    delete: '삭제',
    edit: '편집',
    create: '생성',
    search: '검색',
    loading: '로드 중...',
    error: '오류',
    success: '성공',
    confirm: '확인',
    yes: '예',
    no: '아니오',
  },
  design: {
    button: '버튼',
    badgeSuccess: '성공',
    badgeWarning: '경고',
    badgeDanger: '오류',
    badgeInfo: '정보',
    badgeNeutral: '중립',
    empty: '데이터 없음',
    section: '섹션',
    card: '카드',
    stat: '통계',
    tabs: '탭',
    drawer: '드로어',
    sheet: '시트',
    popover: '팝오버',
    tooltip: '툴팁',
  },
  nav: {
    dashboard: '대시보드',
    candidates: '후보자',
    members: '구성원',
    interviews: '면접',
    skills: '스킬',
    trainings: '교육',
    reviews: '리뷰',
    plugins: '플러그인',
    insights: '인사이트',
    pipeline: '파이프라인',
    heatmap: '히트맵',
    audit: '감사',
    agents: '에이전트',
    'agent-config': '에이전트 설정',
    orchestration: '오케스트레이션',
    notifications: '알림',
    data: '데이터',
  },
  auth: {
    welcome: '환영합니다, {{name}}님!',
    login: '로그인',
    logout: '로그아웃',
  },
};

export function buildWebTranslations(): WebTranslations {
  return {
    en: WEB_EN_TRANSLATIONS,
    'zh-CN': WEB_ZH_CN_TRANSLATIONS,
    ja: WEB_JA_TRANSLATIONS,
    ko: WEB_KO_TRANSLATIONS,
  };
}

export const DEFAULT_WEB_TRANSLATIONS: WebTranslations = buildWebTranslations();

export function loadWebTranslations(locale: WebLocale): TranslationDict {
  const map = DEFAULT_WEB_TRANSLATIONS;
  return map[locale] ?? map[DEFAULT_WEB_LOCALE];
}

export function resolveWebTranslation(key: string, locale: WebLocale): string {
  return translate(loadWebTranslations(locale), key);
}

// ---------- Locale context ----------
export interface LocaleContextValue {
  locale: WebLocale;
  setLocale: (next: WebLocale) => void;
  t: (key: string, options?: { vars?: Record<string, string | number>; count?: number; fallback?: string }) => string;
  translations: TranslationDict;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function defaultT(translations: TranslationDict): LocaleContextValue['t'] {
  return (key, options) => {
    const value = translate(translations, key, { fallback: options?.fallback });
    if (options?.vars) return interpolate(value, options.vars);
    return value;
  };
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: WebLocale;
}) {
  const [locale, setLocaleState] = useState<WebLocale>(initialLocale ?? getStoredWebLocale());

  useEffect(() => {
    setStoredWebLocale(locale);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-team-web-locale-change', { detail: locale }));
    }
  }, [locale]);

  const translations = useMemo(() => loadWebTranslations(locale), [locale]);
  const t = useMemo(() => defaultT(translations), [translations]);

  const setLocale = useCallback((next: WebLocale) => {
    setLocaleState(selectWebLocale(next));
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, translations }),
    [locale, setLocale, t, translations]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  const translations = loadWebTranslations(DEFAULT_WEB_LOCALE);
  return {
    locale: DEFAULT_WEB_LOCALE,
    setLocale: () => {},
    t: defaultT(translations),
    translations,
  };
}

export function useLocale(): WebLocale {
  return useLocaleContext().locale;
}

export function useT(): LocaleContextValue['t'] {
  return useLocaleContext().t;
}

export function useTranslation(): LocaleContextValue['t'] {
  return useT();
}

export function useLocaleActions(): LocaleContextValue {
  return useLocaleContext();
}

// ---------- LanguageSwitcher ----------
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleActions();
  return (
    <div
      data-testid="language-switcher"
      role="group"
      aria-label="语言切换"
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-800"
    >
      {SUPPORTED_WEB_LOCALES.map((key) => (
        <button
          key={key}
          data-testid={`lang-option-${key}`}
          aria-pressed={locale === key}
          onClick={() => setLocale(key)}
          title={WEB_LOCALE_META[key].label}
          className={`rounded px-2 py-1 ${locale === key ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
        >
          {WEB_LOCALE_META[key].flag} {key}
        </button>
      ))}
    </div>
  );
}

// ---------- Event dispatch ----------
export function onWebLocaleChange(handler: (locale: WebLocale) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const cb = (ev: Event) => {
    const detail = (ev as CustomEvent<WebLocale>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener('ai-team-web-locale-change', cb as EventListener);
  return () => window.removeEventListener('ai-team-web-locale-change', cb as EventListener);
}

export function dispatchWebLocaleChange(locale: WebLocale): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WebLocale>('ai-team-web-locale-change', { detail: locale }));
}