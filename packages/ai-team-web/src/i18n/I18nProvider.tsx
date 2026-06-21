// V22: i18n React hook + provider

import { useState, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';
import {
  createTranslator,
  detectBrowserLocale,
  DEFAULT_TRANSLATIONS,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_META,
  type Locale,
  type Translations,
} from '@ai-team/core/i18n';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, options?: { vars?: Record<string, string | number>; count?: number; fallback?: string }) => string;
  available: typeof SUPPORTED_LOCALES;
  meta: typeof LOCALE_META;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'ai-team-locale';

interface ProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  translations?: Translations;
}

export function I18nProvider({ children, initialLocale, translations }: ProviderProps) {
  const dict = translations || DEFAULT_TRANSLATIONS;

  // Determine initial locale: prop > localStorage > browser > default
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale && SUPPORTED_LOCALES.includes(initialLocale)) {
      return initialLocale;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
          return stored as Locale;
        }
      } catch {}
      const detected = detectBrowserLocale(window.navigator?.language);
      if (SUPPORTED_LOCALES.includes(detected)) return detected;
    }
    return DEFAULT_LOCALE;
  });

  // Persist locale changes
  const setLocale = useCallback((newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, newLocale);
      } catch {}
    }
  }, []);

  // Create translator for current locale
  const t = useMemo(
    () => createTranslator(dict, locale),
    [dict, locale]
  );

  // Create translator with locale option (for explicit locale)
  const tWithLocale = useCallback(
    (key: string, options?: { vars?: Record<string, string | number>; count?: number; fallback?: string }) => {
      return t(key, { ...options, locale });
    },
    [t, locale]
  );

  const value: I18nContextValue = {
    locale,
    setLocale,
    t: tWithLocale,
    available: SUPPORTED_LOCALES,
    meta: LOCALE_META,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}

// Convenience: just the translator function
export function useT() {
  return useI18n().t;
}

// Convenience: just the locale setter
export function useSetLocale() {
  return useI18n().setLocale;
}

// Convenience: just the current locale
export function useLocale() {
  return useI18n().locale;
}