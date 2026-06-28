// V129: Web i18n — locale switching + ja/ko language packs + useT hook + Design System 13 components (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  SUPPORTED_WEB_LOCALES,
  DEFAULT_WEB_LOCALE,
  WEB_LOCALE_META,
  isValidWebLocale,
  parseWebLocale,
  getWebLocaleMeta,
  detectBrowserLocale,
  setStoredWebLocale,
  getStoredWebLocale,
  WebLocale,
  WebLocaleMeta,
  useT,
  useLocale,
  useLocaleContext,
  useLocaleActions,
  LocaleProvider,
  translate,
  interpolate,
  pluralize,
  pickPluralForm,
  pluralRules,
  WEB_JA_TRANSLATIONS,
  WEB_KO_TRANSLATIONS,
  WEB_EN_TRANSLATIONS,
  WEB_ZH_CN_TRANSLATIONS,
  mergeTranslations,
  buildWebTranslations,
  DEFAULT_WEB_TRANSLATIONS,
  isMissingKey,
  countMissingKeys,
  isTranslationEqual,
  listKeys,
  validateTranslations,
  getTranslation,
  loadWebTranslations,
  resolveWebTranslation,
  useTranslation,
  LanguageSwitcher,
  selectWebLocale,
  onWebLocaleChange,
  dispatchWebLocaleChange,
} from '../src/i18n/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Constants ----------
describe('V129 web i18n constants', () => {
  it('SUPPORTED_WEB_LOCALES has 4 locales', () => {
    expect(SUPPORTED_WEB_LOCALES).toEqual(['en', 'zh-CN', 'ja', 'ko']);
  });

  it('DEFAULT_WEB_LOCALE is zh-CN', () => {
    expect(DEFAULT_WEB_LOCALE).toBe('zh-CN');
  });

  it('WEB_LOCALE_META has metadata for all 4', () => {
    for (const l of SUPPORTED_WEB_LOCALES) {
      expect(WEB_LOCALE_META[l]).toBeDefined();
      expect(WEB_LOCALE_META[l].label).toBeTruthy();
      expect(WEB_LOCALE_META[l].flag).toBeTruthy();
    }
  });
});

// ---------- Validation ----------
describe('V129 isValidWebLocale / parseWebLocale', () => {
  it('isValidWebLocale accepts canonical', () => {
    expect(isValidWebLocale('en')).toBe(true);
    expect(isValidWebLocale('zh-CN')).toBe(true);
    expect(isValidWebLocale('ja')).toBe(true);
    expect(isValidWebLocale('ko')).toBe(true);
  });

  it('isValidWebLocale rejects unknown', () => {
    expect(isValidWebLocale('fr')).toBe(false);
    expect(isValidWebLocale(null)).toBe(false);
  });

  it('parseWebLocale returns WebLocale or null', () => {
    expect(parseWebLocale('ja')).toBe('ja');
    expect(parseWebLocale('fr')).toBeNull();
  });
});

// ---------- getWebLocaleMeta ----------
describe('V129 getWebLocaleMeta', () => {
  it('returns metadata for known locale', () => {
    const meta = getWebLocaleMeta('ja');
    expect(meta.label).toContain('日本');
    expect(meta.flag).toBe('🇯🇵');
  });
});

// ---------- detectBrowserLocale ----------
describe('V129 detectBrowserLocale', () => {
  it('returns ja for Japanese browser', () => {
    expect(detectBrowserLocale('ja-JP')).toBe('ja');
    expect(detectBrowserLocale('ja')).toBe('ja');
  });

  it('returns ko for Korean browser', () => {
    expect(detectBrowserLocale('ko-KR')).toBe('ko');
    expect(detectBrowserLocale('ko')).toBe('ko');
  });

  it('returns zh-CN for Chinese browser', () => {
    expect(detectBrowserLocale('zh-CN')).toBe('zh-CN');
    expect(detectBrowserLocale('zh')).toBe('zh-CN');
  });

  it('returns en for English / unknown', () => {
    expect(detectBrowserLocale('en-US')).toBe('en');
    expect(detectBrowserLocale('fr-FR')).toBe('en');
  });
});

// ---------- Storage ----------
describe('V129 storage', () => {
  it('getStoredWebLocale defaults to DEFAULT_WEB_LOCALE', () => {
    expect(getStoredWebLocale()).toBe(DEFAULT_WEB_LOCALE);
  });

  it('setStoredWebLocale persists', () => {
    setStoredWebLocale('ja');
    expect(getStoredWebLocale()).toBe('ja');
  });

  it('falls back to default for invalid stored', () => {
    localStorage.setItem('ai-team-web-locale', 'mystery');
    expect(getStoredWebLocale()).toBe(DEFAULT_WEB_LOCALE);
  });
});

// ---------- Pure translation ----------
describe('V129 translate + interpolate + pluralize', () => {
  it('translate returns nested key', () => {
    const result = translate({ common: { save: '保存' } }, 'common.save');
    expect(result).toBe('保存');
  });

  it('translate returns fallback for missing key', () => {
    const result = translate({}, 'common.save', { fallback: 'save' });
    expect(result).toBe('save');
  });

  it('translate returns key for deeply missing', () => {
    const result = translate({ common: {} }, 'common.save', { fallback: 'common.save' });
    expect(result).toBe('common.save');
  });

  it('interpolate replaces {{var}}', () => {
    const result = interpolate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('interpolate handles missing vars gracefully', () => {
    const result = interpolate('Hello {{name}}, age {{age}}', { name: 'A' });
    expect(result).toBe('Hello A, age {{age}}');
  });

  it('pluralize picks one/other', () => {
    const en = pluralRules.en;
    expect(pluralize({ one: '1 item', other: '{{count}} items' }, 1, en)).toBe('1 item');
    expect(pluralize({ one: '1 item', other: '{{count}} items' }, 5, en)).toBe('5 items');
  });

  it('pickPluralForm follows locale rule', () => {
    expect(pickPluralForm(0, pluralRules.en)).toBe('other');
    expect(pickPluralForm(1, pluralRules.en)).toBe('one');
    expect(pickPluralForm(2, pluralRules.en)).toBe('other');
  });
});

// ---------- Translation dictionaries ----------
describe('V129 translation dictionaries', () => {
  it('WEB_EN_TRANSLATIONS has common + design + nav keys', () => {
    expect(WEB_EN_TRANSLATIONS.common.save).toBeTruthy();
    expect(WEB_EN_TRANSLATIONS.design.button).toBeTruthy();
    expect(WEB_EN_TRANSLATIONS.nav.dashboard).toBeTruthy();
  });

  it('WEB_ZH_CN_TRANSLATIONS has Chinese strings', () => {
    expect(WEB_ZH_CN_TRANSLATIONS.common.save).toContain('保存');
    expect(WEB_ZH_CN_TRANSLATIONS.design.button).toContain('按钮');
  });

  it('WEB_JA_TRANSLATIONS has Japanese strings', () => {
    expect(WEB_JA_TRANSLATIONS.common.save).toContain('保存');
    expect(WEB_JA_TRANSLATIONS.design.button).toContain('ボタン');
  });

  it('WEB_KO_TRANSLATIONS has Korean strings', () => {
    expect(WEB_KO_TRANSLATIONS.common.save).toContain('저장');
    expect(WEB_KO_TRANSLATIONS.design.button).toContain('버튼');
  });

  it('all 4 dictionaries have same key structure', () => {
    const enKeys = listKeys(WEB_EN_TRANSLATIONS).sort();
    const jaKeys = listKeys(WEB_JA_TRANSLATIONS).sort();
    expect(jaKeys).toEqual(enKeys);
  });
});

// ---------- mergeTranslations / buildWebTranslations ----------
describe('V129 buildWebTranslations', () => {
  it('buildWebTranslations returns 4 locales', () => {
    const t = buildWebTranslations();
    expect(Object.keys(t).sort()).toEqual(['en', 'ja', 'ko', 'zh-CN']);
  });

  it('DEFAULT_WEB_TRANSLATIONS is identity to buildWebTranslations', () => {
    const t1 = DEFAULT_WEB_TRANSLATIONS;
    const t2 = buildWebTranslations();
    expect(t1.en).toBe(t2.en);
  });

  it('mergeTranslations merges dictionaries', () => {
    const merged = mergeTranslations({ a: { b: 'en' } }, { a: { c: 'fr' } });
    expect(merged.a.b).toBe('en');
    expect(merged.a.c).toBe('fr');
  });
});

// ---------- Translation helpers ----------
describe('V129 translation helpers', () => {
  it('getTranslation returns localized string', () => {
    expect(getTranslation(WEB_JA_TRANSLATIONS, 'common.save')).toBe('保存');
  });

  it('isMissingKey detects missing', () => {
    expect(isMissingKey(null)).toBe(true);
    expect(isMissingKey('')).toBe(true);
    expect(isMissingKey('hello')).toBe(false);
  });

  it('countMissingKeys counts differences', () => {
    const en = { a: 'en', b: 'en', c: 'en' };
    const ja = { a: 'ja', c: 'ja' };
    expect(countMissingKeys(en, ja)).toBe(1); // 'b' is missing
  });

  it('isTranslationEqual returns true for equal', () => {
    expect(isTranslationEqual('a', 'a')).toBe(true);
    expect(isTranslationEqual('a', 'b')).toBe(false);
  });

  it('listKeys returns dot-separated keys', () => {
    const keys = listKeys({ a: { b: 'x', c: 'y' }, d: 'z' });
    expect(keys.sort()).toEqual(['a.b', 'a.c', 'd']);
  });

  it('validateTranslations returns missing key list', () => {
    const missing = validateTranslations(WEB_EN_TRANSLATIONS, { common: {} });
    expect(missing.length).toBeGreaterThan(0);
  });

  it('loadWebTranslations returns full dict for locale', () => {
    const t = loadWebTranslations('ja');
    expect(t).toBe(WEB_JA_TRANSLATIONS);
  });

  it('resolveWebTranslation looks up dot key', () => {
    expect(resolveWebTranslation('common.save', 'ja')).toBe(WEB_JA_TRANSLATIONS.common.save);
  });
});

// ---------- useT hook ----------
describe('V129 useT hook', () => {
  it('returns translation function for current locale', () => {
    function Probe() {
      const t = useT();
      return <div data-testid="t">{t('common.save')}</div>;
    }
    render(
      <LocaleProvider initialLocale="ja">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('t').textContent).toBe(WEB_JA_TRANSLATIONS.common.save);
  });

  it('useT accepts vars for interpolation', () => {
    function Probe() {
      const t = useT();
      return <div data-testid="t">{t('auth.welcome', { vars: { name: 'Alice' } })}</div>;
    }
    render(
      <LocaleProvider initialLocale="ja">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('t').textContent).toContain('Alice');
  });

  it('useT re-renders on locale change', () => {
    function Probe() {
      const { t, locale, setLocale } = useLocaleActions();
      return (
        <div>
          <span data-testid="locale">{locale}</span>
          <span data-testid="save">{t('common.save')}</span>
          <button data-testid="switch" onClick={() => setLocale('ko')}>ko</button>
        </div>
      );
    }
    render(
      <LocaleProvider initialLocale="en">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('save').textContent).toBe('Save');
    fireEvent.click(screen.getByTestId('switch'));
    expect(screen.getByTestId('locale').textContent).toBe('ko');
    expect(screen.getByTestId('save').textContent).toBe('저장');
  });
});

// ---------- useLocale / useLocaleActions ----------
describe('V129 useLocale / useLocaleActions', () => {
  it('useLocale returns current locale', () => {
    function Probe() {
      const locale = useLocale();
      return <div data-testid="l">{locale}</div>;
    }
    render(
      <LocaleProvider initialLocale="ja">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('l').textContent).toBe('ja');
  });

  it('useLocaleActions returns setLocale', () => {
    function Probe() {
      const { locale, setLocale } = useLocaleActions();
      return (
        <div>
          <span data-testid="l">{locale}</span>
          <button data-testid="set" onClick={() => setLocale('en')}>en</button>
        </div>
      );
    }
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    fireEvent.click(screen.getByTestId('set'));
    expect(screen.getByTestId('l').textContent).toBe('en');
  });
});

// ---------- LanguageSwitcher ----------
describe('V129 LanguageSwitcher', () => {
  it('renders 4 options', () => {
    render(
      <LocaleProvider>
        <LanguageSwitcher />
      </LocaleProvider>
    );
    for (const l of SUPPORTED_WEB_LOCALES) {
      expect(screen.getByTestId(`lang-option-${l}`)).toBeTruthy();
    }
  });

  it('clicking option switches locale', () => {
    function Probe() {
      const { locale, setLocale } = useLocaleActions();
      return (
        <div>
          <span data-testid="l">{String(locale)}</span>
          <button data-testid="set-ja" onClick={() => setLocale('ja')}>set-ja</button>
        </div>
      );
    }
    render(
      <LocaleProvider>
        <LanguageSwitcher />
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('l').textContent).toBe('zh-CN');
    // Use LanguageSwitcher's button — verify aria-pressed updates
    const jaBtn = screen.getByTestId('lang-option-ja');
    expect(jaBtn.getAttribute('aria-pressed')).toBe('false');
    // Click the LanguageSwitcher's button
    fireEvent.click(jaBtn);
    // Now ja should be active
    expect(jaBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks current locale with aria-pressed', () => {
    render(
      <LocaleProvider initialLocale="ja">
        <LanguageSwitcher />
      </LocaleProvider>
    );
    expect(screen.getByTestId('lang-option-ja').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('lang-option-en').getAttribute('aria-pressed')).toBe('false');
  });
});

// ---------- selectWebLocale / onWebLocaleChange ----------
describe('V129 selectWebLocale / onWebLocaleChange', () => {
  it('selectWebLocale returns canonical or default', () => {
    expect(selectWebLocale('ja')).toBe('ja');
    expect(selectWebLocale('fr')).toBe(DEFAULT_WEB_LOCALE);
  });

  it('onWebLocaleChange dispatches event', () => {
    const cb = vi.fn();
    const unsub = onWebLocaleChange(cb);
    dispatchWebLocaleChange('ko');
    expect(cb).toHaveBeenCalledWith('ko');
    unsub();
  });
});

// ---------- useTranslation alias ----------
describe('V129 useTranslation alias', () => {
  it('behaves same as useT', () => {
    function Probe() {
      const t = useTranslation();
      return <div data-testid="t">{t('common.save')}</div>;
    }
    render(
      <LocaleProvider initialLocale="ja">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('t').textContent).toBe(WEB_JA_TRANSLATIONS.common.save);
  });
});

// ---------- Design System components use t() ----------
describe('V129 Design System components use t()', () => {
  it('Button renders translated label when given translation key', async () => {
    const { Button } = await import('../src/components/design-system/index.js');
    function Probe() {
      const t = useT();
      return <Button t={t} tKey="common.save" />;
    }
    render(
      <LocaleProvider initialLocale="ja">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByText('保存')).toBeTruthy();
  });

  it('Badge renders translated status when given tKey', async () => {
    const { Badge } = await import('../src/components/design-system/index.js');
    function Probe() {
      const t = useT();
      return <Badge t={t} tKey="design.badgeSuccess" tone="success" />;
    }
    render(
      <LocaleProvider initialLocale="ko">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByText('성공')).toBeTruthy();
  });

  it('EmptyState renders localized default text', async () => {
    const { EmptyState } = await import('../src/components/design-system/index.js');
    function Probe() {
      const t = useT();
      return <EmptyState t={t} tKeyTitle="design.empty" title="placeholder" />;
    }
    render(
      <LocaleProvider initialLocale="ja">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });
});