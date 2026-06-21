// V22: i18n Web hook tests
// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, render, screen, fireEvent, cleanup } from '@testing-library/react';
// Import directly from source (bypass barrel that pulls node: deps)
import { I18nProvider, useI18n, useT, useLocale, useSetLocale } from '../src/i18n/I18nProvider.js';
import { LanguageSwitcher } from '../src/i18n/LanguageSwitcher.js';
import {
  DEFAULT_TRANSLATIONS,
  SUPPORTED_LOCALES,
  LOCALE_META,
} from '@ai-team/core/i18n';

describe('V22: i18n Web', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  describe('I18nProvider', () => {
    it('provides default locale', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      expect(result.current.locale).toBe('en');
    });

    it('throws when used outside provider', () => {
      expect(() => renderHook(() => useI18n())).toThrow(/within I18nProvider/);
    });

    it('translates via t function', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      expect(result.current.t('common.save')).toBe('Save');
      expect(result.current.t('common.cancel')).toBe('Cancel');
    });

    it('translates zh-CN', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="zh-CN">{children}</I18nProvider>,
      });
      expect(result.current.t('common.save')).toBe('保存');
      expect(result.current.t('common.cancel')).toBe('取消');
    });

    it('supports variable interpolation', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      expect(result.current.t('auth.welcome', { vars: { name: 'Alice' } })).toBe('Welcome, Alice!');
    });

    it('supports plural forms', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      expect(result.current.t('plural.candidates', { count: 0 })).toBe('No candidates');
      expect(result.current.t('plural.candidates', { count: 1 })).toBe('1 candidate');
      expect(result.current.t('plural.candidates', { count: 5 })).toBe('5 candidates');
    });

    it('setLocale updates state', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      expect(result.current.locale).toBe('en');
      act(() => result.current.setLocale('zh-CN'));
      expect(result.current.locale).toBe('zh-CN');
    });

    it('setLocale rejects invalid locale', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      const beforeLocale = result.current.locale;
      act(() => result.current.setLocale('fr' as any));
      expect(result.current.locale).toBe(beforeLocale);
    });

    it('re-renders when locale changes', () => {
      const { result } = renderHook(() => useI18n(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      expect(result.current.t('common.save')).toBe('Save');
      act(() => result.current.setLocale('zh-CN'));
      expect(result.current.t('common.save')).toBe('保存');
    });
  });

  describe('useLocale / useSetLocale', () => {
    it('useLocale returns current locale', () => {
      const { result } = renderHook(() => useLocale(), {
        wrapper: ({ children }) => <I18nProvider initialLocale="zh-CN">{children}</I18nProvider>,
      });
      expect(result.current).toBe('zh-CN');
    });

    it('useSetLocale returns setter', () => {
      const { result } = renderHook(() => ({ locale: useLocale(), setLocale: useSetLocale() }), {
        wrapper: ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>,
      });
      expect(result.current.locale).toBe('en');
      act(() => result.current.setLocale('zh-CN'));
      expect(result.current.locale).toBe('zh-CN');
    });
  });

  describe('LanguageSwitcher', () => {
    it('renders all supported locales', () => {
      render(
        <I18nProvider initialLocale="en">
          <LanguageSwitcher />
        </I18nProvider>
      );
      for (const loc of SUPPORTED_LOCALES) {
        expect(screen.getByRole('option', { name: new RegExp(LOCALE_META[loc].native, 'i') })).toHaveProperty('value', loc);
      }
    });

    it('changes locale on selection', () => {
      render(
        <I18nProvider initialLocale="en">
          <LanguageSwitcher />
        </I18nProvider>
      );
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'zh-CN' } });
      expect((select as HTMLSelectElement).value).toBe('zh-CN');
    });
  });

  describe('Available locales', () => {
    it('exports all locales', () => {
      expect(SUPPORTED_LOCALES).toContain('en');
      expect(SUPPORTED_LOCALES).toContain('zh-CN');
    });
  });

  describe('Default translations', () => {
    it('has same keys in both locales', () => {
      const enKeys = Object.keys(DEFAULT_TRANSLATIONS.en);
      const zhKeys = Object.keys(DEFAULT_TRANSLATIONS['zh-CN']);
      expect(enKeys.sort()).toEqual(zhKeys.sort());
    });
  });
});