// V22: Language switcher component

import { useI18n } from './I18nProvider';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, available, meta } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as any)}
      className={className || 'rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'}
      aria-label="Language switcher"
    >
      {available.map((loc) => (
        <option key={loc} value={loc}>
          {meta[loc].flag} {meta[loc].native}
        </option>
      ))}
    </select>
  );
}