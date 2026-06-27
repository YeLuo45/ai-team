// V107: Theme provider + 4 themes (light / dark / sepia / nord)

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_KEYS = ['light', 'dark', 'sepia', 'nord'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const DEFAULT_THEME: ThemeKey = 'light';
export const STORAGE_KEY = 'ai-team-theme';

export function isValidTheme(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value);
}

export function applyThemeToDocument(theme: ThemeKey): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function getStoredTheme(): ThemeKey {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME;
  const raw = localStorage.getItem(STORAGE_KEY);
  return isValidTheme(raw) ? raw : DEFAULT_THEME;
}

export function setStoredTheme(theme: ThemeKey): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme);
  }
}

export const THEME_LABELS: Record<ThemeKey, string> = {
  light: '明亮',
  dark: '暗色',
  sepia: '护眼',
  nord: '极地',
};

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (next: ThemeKey) => void;
  available: typeof THEME_KEYS;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: ThemeKey;
}) {
  const [theme, setThemeState] = useState<ThemeKey>(() => initialTheme ?? getStoredTheme());

  const setTheme = useCallback((next: ThemeKey) => {
    setThemeState(next);
    applyThemeToDocument(next);
    setStoredTheme(next);
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, available: THEME_KEYS }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { theme, setTheme, available } = useTheme();
  return (
    <div data-testid="topbar-theme-switcher" role="group" aria-label="主题切换" className={`flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {available.map((key) => (
        <button
          key={key}
          data-testid={`theme-option-${key}`}
          aria-pressed={theme === key}
          onClick={() => setTheme(key)}
          title={THEME_LABELS[key]}
          className={`rounded px-2 py-1 text-xs font-medium ${theme === key ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
        >
          {THEME_LABELS[key]}
        </button>
      ))}
    </div>
  );
}