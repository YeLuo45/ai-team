// V22: i18n 国际化

export type Locale = 'en' | 'zh-CN';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'zh-CN'];
export const DEFAULT_LOCALE: Locale = 'en';

// 翻译字典 (string -> string OR nested object)
export type TranslationDict = {
  [key: string]: string | TranslationDict | string[];
};

// 翻译表 (按 locale)
export type Translations = Record<Locale, TranslationDict>;

// Plural form: simple, {one, other} support
export type PluralForm = { one?: string; other: string; zero?: string };

// 复数插值选项
export interface TranslateOptions {
  locale?: Locale;
  vars?: Record<string, string | number>;
  count?: number;  // for plural
  fallback?: string;
}

// 默认英语翻译 (示例)
export const DEFAULT_TRANSLATIONS: Translations = {
  en: {
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
    auth: {
      login: 'Log in',
      logout: 'Log out',
      register: 'Register',
      username: 'Username',
      email: 'Email',
      password: 'Password',
      role: 'Role',
      welcome: 'Welcome, {{name}}!',
      invalidCredentials: 'Invalid email or password',
      loginRequired: 'Authentication required',
      forbidden: 'You do not have permission to perform this action',
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
      notifications: 'Notifications',
      data: 'Data',
      settings: 'Settings',
    },
    errors: {
      notFound: 'Resource not found',
      serverError: 'Server error occurred',
      networkError: 'Network error',
      validationError: 'Validation failed',
      unauthorized: 'Unauthorized',
      forbidden: 'Forbidden',
    },
    plural: {
      candidates: { one: '1 candidate', other: '{{count}} candidates', zero: 'No candidates' },
      members: { one: '1 member', other: '{{count}} members', zero: 'No members' },
      interviews: { one: '1 interview', other: '{{count}} interviews', zero: 'No interviews' },
    },
  },
  'zh-CN': {
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
    auth: {
      login: '登录',
      logout: '退出',
      register: '注册',
      username: '用户名',
      email: '邮箱',
      password: '密码',
      role: '角色',
      welcome: '欢迎, {{name}}!',
      invalidCredentials: '邮箱或密码错误',
      loginRequired: '需要登录',
      forbidden: '您没有权限执行此操作',
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
      notifications: '通知',
      data: '数据',
      settings: '设置',
    },
    errors: {
      notFound: '资源未找到',
      serverError: '服务器错误',
      networkError: '网络错误',
      validationError: '验证失败',
      unauthorized: '未授权',
      forbidden: '禁止访问',
    },
    plural: {
      candidates: { one: '1 个候选人', other: '{{count}} 个候选人', zero: '没有候选人' },
      members: { one: '1 个成员', other: '{{count}} 个成员', zero: '没有成员' },
      interviews: { one: '1 次面试', other: '{{count}} 次面试', zero: '没有面试' },
    },
  },
};

// 从嵌套对象中按 key path 获取值
function getNestedValue(obj: TranslationDict, path: string): string | PluralForm | TranslationDict | string[] | undefined {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

// 简单变量插值
function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) return '';
    return String(value);
  });
}

// Plural 选择 (零/一/其他)
function selectPlural(form: PluralForm, count: number): string {
  if (count === 0 && form.zero) return form.zero;
  if (count === 1 && form.one) return form.one;
  return form.other;
}

// 翻译函数
export function createTranslator(translations: Translations, defaultLocale: Locale = DEFAULT_LOCALE) {
  return function t(key: string, options: TranslateOptions = {}): string {
    const locale = options.locale || defaultLocale;
    const dict = translations[locale] || translations[defaultLocale];
    const value = getNestedValue(dict, key);

    if (value === undefined) {
      // Fallback to default locale
      const fallbackDict = translations[defaultLocale];
      const fallbackValue = getNestedValue(fallbackDict, key);
      if (fallbackValue === undefined) {
        return options.fallback !== undefined ? options.fallback : key;
      }
      return renderValue(fallbackValue, options);
    }

    return renderValue(value, options);
  };
}

function renderValue(value: any, options: TranslateOptions): string {
  // Plural form
  if (typeof value === 'object' && 'other' in value) {
    const count = options.count ?? 0;
    // Auto-include count in vars if not present
    const vars = { count, ...(options.vars || {}) };
    return interpolate(selectPlural(value, count), vars);
  }
  // String
  if (typeof value === 'string') {
    return interpolate(value, options.vars || {});
  }
  // Array (select by index)
  if (Array.isArray(value)) {
    const idx = options.count !== undefined ? options.count : 0;
    return interpolate(value[Math.min(idx, value.length - 1)] || '', options.vars || {});
  }
  // Object (treat as nested - shouldn't happen at top level)
  return JSON.stringify(value);
}

// Browser locale detection
export function detectBrowserLocale(acceptLanguage?: string): Locale {
  const al = acceptLanguage || (typeof navigator !== 'undefined' ? (navigator as any).language : 'en');
  if (al.toLowerCase().startsWith('zh')) return 'zh-CN';
  if (al.toLowerCase().startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

// 合并翻译 (deep merge, second wins)
export function mergeTranslations(base: Translations, override: Partial<Translations>): Translations {
  const result: Translations = { ...base };
  for (const locale of Object.keys(override) as Locale[]) {
    if (!override[locale]) continue;
    result[locale] = deepMerge(base[locale] || {}, override[locale]!) as TranslationDict;
  }
  return result;
}

function deepMerge(a: any, b: any): any {
  if (a == null || b == null) return b;
  if (typeof a !== 'object' || typeof b !== 'object') return b;
  if (Array.isArray(a) || Array.isArray(b)) return b;
  const result: any = { ...a };
  for (const key of Object.keys(b)) {
    result[key] = deepMerge(a[key], b[key]);
  }
  return result;
}

// Locale metadata (display name, native name)
export const LOCALE_META: Record<Locale, { code: string; native: string; english: string; flag: string }> = {
  en: { code: 'en', native: 'English', english: 'English', flag: '🇺🇸' },
  'zh-CN': { code: 'zh-CN', native: '简体中文', english: 'Simplified Chinese', flag: '🇨🇳' },
};

// Format number per locale (simple)
export function formatLocaleNumber(value: number, locale: Locale = DEFAULT_LOCALE): string {
  // Avoid Intl polyfill issues in tests
  if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
    try {
      return new Intl.NumberFormat(locale).format(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// Format date per locale
export function formatLocaleDate(date: Date | string | number, locale: Locale = DEFAULT_LOCALE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
      }).format(d);
    } catch {
      return d.toISOString();
    }
  }
  return d.toISOString();
}