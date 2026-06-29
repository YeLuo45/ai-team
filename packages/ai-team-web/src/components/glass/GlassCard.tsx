// V140: Glass surface — backdrop-blur + semi-transparent tokens (4 themes)

import { useEffect, useState, ReactNode } from 'react';

// ---------- Types ----------
export interface GlassTokens {
  background: string;
  backdrop: string;
  border: string;
  shadow: string;
}

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  testId?: string;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  opacity?: 'subtle' | 'medium' | 'strong';
}

// ---------- Constants ----------
const BLUR_CLASS: Record<NonNullable<GlassCardProps['blur']>, string> = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-2xl',
};

const OPACITY: Record<NonNullable<GlassCardProps['opacity']>, number> = {
  subtle: 0.55,
  medium: 0.7,
  strong: 0.85,
};

// ---------- Pure helpers ----------
export function getGlassTokens(theme: 'light' | 'dark' | 'sepia' | 'nord'): GlassTokens {
  switch (theme) {
    case 'dark':
      return {
        background: 'bg-slate-900/55',
        backdrop: 'backdrop-blur-md',
        border: 'border-slate-700/40',
        shadow: 'shadow-lg shadow-black/20',
      };
    case 'sepia':
      return {
        background: 'bg-amber-50/70',
        backdrop: 'backdrop-blur-md',
        border: 'border-amber-200/50',
        shadow: 'shadow-md shadow-amber-900/10',
      };
    case 'nord':
      return {
        background: 'bg-slate-200/55',
        backdrop: 'backdrop-blur-md',
        border: 'border-slate-300/40',
        shadow: 'shadow-md shadow-slate-900/10',
      };
    case 'light':
    default:
      return {
        background: 'bg-white/60',
        backdrop: 'backdrop-blur-md',
        border: 'border-slate-200/50',
        shadow: 'shadow-md shadow-slate-900/5',
      };
  }
}

export function getCurrentTheme(): 'light' | 'dark' | 'sepia' | 'nord' {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'sepia' || attr === 'nord') return attr;
  return 'light';
}

export function buildGlassClassName(theme: 'light' | 'dark' | 'sepia' | 'nord', blur: GlassCardProps['blur'] = 'md', opacity: GlassCardProps['opacity'] = 'medium'): string {
  const tokens = getGlassTokens(theme);
  const _opacity = OPACITY[opacity ?? 'medium'];
  void _opacity;
  return [
    tokens.background,
    tokens.backdrop,
    tokens.border,
    tokens.shadow,
    'border rounded-lg',
    BLUR_CLASS[blur ?? 'md'],
  ].join(' ');
}

// ---------- useGlassTheme hook ----------
export function useGlassTheme(): 'light' | 'dark' | 'sepia' | 'nord' {
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia' | 'nord'>(() => getCurrentTheme());
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

// ---------- GlassCard component ----------
export function GlassCard({ children, className = '', testId, blur = 'md', opacity = 'medium' }: GlassCardProps) {
  const theme = useGlassTheme();
  const glassClass = buildGlassClassName(theme, blur, opacity);
  return (
    <div
      data-testid={testId ?? 'glass-card'}
      data-theme={theme}
      className={`${glassClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

// ---------- Topbar shell variant ----------
export interface TopbarGlassProps {
  title: string;
  subtitle?: string;
  cta?: { label: string; onClick: () => void; testId?: string };
  rightSlot?: ReactNode;
}

export function TopbarGlass({ title, subtitle, cta, rightSlot }: TopbarGlassProps) {
  const theme = useGlassTheme();
  const tokens = getGlassTokens(theme);
  return (
    <div
      data-testid="topbar-glass"
      className={`sticky top-0 z-40 ${tokens.background} ${tokens.backdrop} ${tokens.border} border-b`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          {cta && (
            <button
              data-testid={cta.testId ?? 'topbar-cta'}
              onClick={cta.onClick}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
