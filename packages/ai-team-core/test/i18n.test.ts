// V22: i18n tests

import { describe, it, expect } from 'vitest';
import {
  createTranslator,
  detectBrowserLocale,
  mergeTranslations,
  formatLocaleNumber,
  formatLocaleDate,
  DEFAULT_TRANSLATIONS,
  SUPPORTED_LOCALES,
  LOCALE_META,
  DEFAULT_LOCALE,
} from '../src/i18n.js';

describe('V22: i18n', () => {
  describe('createTranslator', () => {
    const t = createTranslator(DEFAULT_TRANSLATIONS);

    it('translates simple key', () => {
      expect(t('common.save')).toBe('Save');
      expect(t('common.cancel')).toBe('Cancel');
    });

    it('translates nested keys', () => {
      expect(t('auth.login')).toBe('Log in');
      expect(t('auth.email')).toBe('Email');
    });

    it('translates via locale option', () => {
      expect(t('common.save', { locale: 'zh-CN' })).toBe('保存');
      expect(t('auth.email', { locale: 'zh-CN' })).toBe('邮箱');
    });

    it('interpolates variables', () => {
      expect(t('auth.welcome', { vars: { name: 'Alice' } })).toBe('Welcome, Alice!');
      expect(t('auth.welcome', { locale: 'zh-CN', vars: { name: 'Alice' } })).toBe('欢迎, Alice!');
    });

    it('returns key if translation missing', () => {
      expect(t('does.not.exist')).toBe('does.not.exist');
    });

    it('uses fallback option when translation missing', () => {
      expect(t('does.not.exist', { fallback: 'Default' })).toBe('Default');
    });

    it('falls back to default locale when missing in target', () => {
      // Create translations where zh-CN doesn't have a key
      const partial = {
        en: { test: { hello: 'Hello' } },
        'zh-CN': {},
      };
      const t2 = createTranslator(partial, 'en');
      // Even with zh-CN locale, falls back to en because key doesn't exist in zh-CN
      expect(t2('test.hello', { locale: 'zh-CN' })).toBe('Hello');
    });

    it('handles plural forms', () => {
      expect(t('plural.candidates', { count: 0 })).toBe('No candidates');
      expect(t('plural.candidates', { count: 1 })).toBe('1 candidate');
      expect(t('plural.candidates', { count: 5 })).toBe('5 candidates');
      expect(t('plural.candidates', { count: 1, locale: 'zh-CN' })).toBe('1 个候选人');
      expect(t('plural.candidates', { count: 10, locale: 'zh-CN' })).toBe('10 个候选人');
    });

    it('handles plural with vars', () => {
      const customT = createTranslator({
        en: { test: { items: { one: '{{count}} item here', other: '{{count}} items here' } } },
        'zh-CN': { test: { items: { other: '{{count}} 项' } } },
      });
      expect(customT('test.items', { count: 1, vars: { count: 1 } })).toBe('1 item here');
      expect(customT('test.items', { count: 5, vars: { count: 5 } })).toBe('5 items here');
    });
  });

  describe('detectBrowserLocale', () => {
    it('detects zh-CN from zh-*', () => {
      expect(detectBrowserLocale('zh-CN')).toBe('zh-CN');
      expect(detectBrowserLocale('zh-TW')).toBe('zh-CN');
      expect(detectBrowserLocale('zh')).toBe('zh-CN');
      expect(detectBrowserLocale('zh-Hans')).toBe('zh-CN');
    });

    it('detects en from en-*', () => {
      expect(detectBrowserLocale('en')).toBe('en');
      expect(detectBrowserLocale('en-US')).toBe('en');
      expect(detectBrowserLocale('en-GB')).toBe('en');
    });

    it('is case-insensitive', () => {
      expect(detectBrowserLocale('EN')).toBe('en');
      expect(detectBrowserLocale('ZH-cn')).toBe('zh-CN');
    });

    it('returns default for unknown', () => {
      expect(detectBrowserLocale('fr-FR')).toBe(DEFAULT_LOCALE);
      expect(detectBrowserLocale('de-DE')).toBe(DEFAULT_LOCALE);
    });

    it('returns default for empty', () => {
      expect(detectBrowserLocale('')).toBe(DEFAULT_LOCALE);
    });
  });

  describe('mergeTranslations', () => {
    it('merges two Translations', () => {
      const base = {
        en: { a: { b: 'en-b' } },
        'zh-CN': { a: { b: 'zh-b' } },
      };
      const override = {
        en: { a: { c: 'en-c' } },
        'zh-CN': { a: { c: 'zh-c' } },
      };
      const result = mergeTranslations(base, override);
      expect(result.en.a.b).toBe('en-b');
      expect(result.en.a.c).toBe('en-c');
      expect(result['zh-CN'].a.b).toBe('zh-b');
      expect(result['zh-CN'].a.c).toBe('zh-c');
    });

    it('handles partial override', () => {
      const base = {
        en: { a: 'x' },
        'zh-CN': { a: 'y' },
      };
      const override = {
        en: { b: 'z' },
      };
      const result = mergeTranslations(base, override);
      expect(result.en.a).toBe('x');
      expect(result.en.b).toBe('z');
      expect(result['zh-CN'].a).toBe('y');
      expect(result['zh-CN'].b).toBeUndefined();
    });

    it('handles missing locale in override', () => {
      const base = {
        en: { a: 'x' },
        'zh-CN': { a: 'y' },
      };
      const override = {};
      const result = mergeTranslations(base, override);
      expect(result.en.a).toBe('x');
      expect(result['zh-CN'].a).toBe('y');
    });
  });

  describe('formatLocaleNumber', () => {
    it('formats numbers per locale', () => {
      const formattedEn = formatLocaleNumber(1234.56, 'en');
      const formattedZh = formatLocaleNumber(1234.56, 'zh-CN');
      expect(formattedEn).toContain('1,234');
      expect(formattedZh).toContain('1,234');
    });

    it('uses default locale when not specified', () => {
      expect(formatLocaleNumber(42)).toBe('42');
    });

    it('handles zero and negative', () => {
      expect(formatLocaleNumber(0)).toBe('0');
      expect(formatLocaleNumber(-100)).toContain('100');
    });
  });

  describe('formatLocaleDate', () => {
    it('formats dates per locale', () => {
      const date = new Date('2026-06-15T00:00:00Z');
      const formattedEn = formatLocaleDate(date, 'en');
      const formattedZh = formatLocaleDate(date, 'zh-CN');
      expect(formattedEn).toContain('2026');
      expect(formattedZh).toContain('2026');
    });

    it('accepts string input', () => {
      expect(formatLocaleDate('2026-06-15')).toContain('2026');
    });

    it('accepts timestamp input', () => {
      const ts = new Date('2026-01-01').getTime();
      expect(formatLocaleDate(ts)).toContain('2026');
    });
  });

  describe('Constants', () => {
    it('exports supported locales', () => {
      expect(SUPPORTED_LOCALES).toContain('en');
      expect(SUPPORTED_LOCALES).toContain('zh-CN');
    });

    it('exports locale metadata', () => {
      expect(LOCALE_META.en.native).toBe('English');
      expect(LOCALE_META['zh-CN'].native).toBe('简体中文');
      expect(LOCALE_META.en.flag).toBeDefined();
    });

    it('default translations have common keys', () => {
      expect(DEFAULT_TRANSLATIONS.en.common.save).toBe('Save');
      expect(DEFAULT_TRANSLATIONS['zh-CN'].common.save).toBe('保存');
    });
  });
});