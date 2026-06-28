// V107: Design System primitive components
// Card / Button / Badge / EmptyState / Skeleton / Drawer / Sheet
// Popover / Tooltip / Tabs / Stat / Section

import React, { ReactNode, useEffect, useRef, useState, MouseEvent } from 'react';

export type CardVariant = 'default' | 'outlined' | 'elevated';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type Size = 'sm' | 'md' | 'lg';

// ---------- Card ----------
const CARD_VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
  outlined: 'rounded-lg border border-slate-300 bg-transparent dark:border-slate-700',
  elevated: 'rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900',
};

export function Card({
  title,
  subtitle,
  actions,
  variant = 'default',
  className = '',
  children,
  testId,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className={`${CARD_VARIANT_CLASS[variant]} ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

// ---------- Button ----------
const BTN_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};
const BTN_SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  onClick,
  children,
  type = 'button',
  testId,
  t,
  tKey,
}: {
  variant?: ButtonVariant;
  size?: Size;
  disabled?: boolean;
  className?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  testId?: string;
  t?: (key: string, options?: { vars?: Record<string, string | number>; fallback?: string }) => string;
  tKey?: string;
}) {
  const label = t && tKey ? t(tKey, { fallback: typeof children === 'string' ? children : undefined }) : children;
  return (
    <button
      data-testid={testId}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BTN_VARIANT_CLASS[variant]} ${BTN_SIZE_CLASS[size]} ${className}`}
    >
      {label}
    </button>
  );
}

// ---------- Badge ----------
const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

export function Badge({ tone = 'neutral', className = '', children, t, tKey }: { tone?: BadgeTone; className?: string; children?: ReactNode; t?: (key: string, options?: { vars?: Record<string, string | number>; fallback?: string }) => string; tKey?: string }) {
  const label = t && tKey ? t(tKey, { fallback: typeof children === 'string' ? children : undefined }) : children;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE_CLASS[tone]} ${className}`}>{label}</span>;
}

// ---------- EmptyState ----------
export function EmptyState({
  icon = '📋',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  t,
  tKeyTitle,
  tKeyDescription,
  tKeyAction,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  t?: (key: string, options?: { vars?: Record<string, string | number>; fallback?: string }) => string;
  tKeyTitle?: string;
  tKeyDescription?: string;
  tKeyAction?: string;
}) {
  const finalTitle = t && tKeyTitle ? t(tKeyTitle, { fallback: title }) : title;
  const finalDescription = t && tKeyDescription ? t(tKeyDescription, { fallback: description }) : description;
  const finalActionLabel = t && tKeyAction ? t(tKeyAction, { fallback: actionLabel }) : actionLabel;
  return (
    <div data-testid="empty-state" className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{finalTitle}</h3>
      {finalDescription && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{finalDescription}</p>}
      {finalActionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>{finalActionLabel}</Button>
      )}
    </div>
  );
}

// ---------- Skeleton ----------
export function Skeleton({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          data-skeleton-line
          className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700"
          style={{ width: `${Math.max(40, 100 - i * 10)}%` }}
        />
      ))}
    </div>
  );
}

// ---------- Tabs ----------
export interface TabsItem<T extends string = string> {
  id: T;
  label: string;
  content: ReactNode;
}
export function Tabs<T extends string>({
  items,
  initial = items[0]?.id,
  onChange,
}: {
  items: TabsItem<T>[];
  initial?: T;
  onChange?: (id: T) => void;
}) {
  const [active, setActive] = useState<T | undefined>(initial);
  return (
    <div>
      <div role="tablist" className="flex border-b border-slate-200 dark:border-slate-700">
        {items.map((it) => (
          <button
            key={it.id}
            role="tab"
            aria-selected={active === it.id}
            data-testid={`tab-${it.id}`}
            onClick={() => {
              setActive(it.id);
              onChange?.(it.id);
            }}
            className={`px-4 py-2 text-sm font-medium ${active === it.id ? 'border-b-2 border-brand-500 text-brand-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            {it.label}
          </button>
        ))}
      </div>
      <div className="px-4 py-3">
        {items.map((it) => (active === it.id ? <div key={it.id}>{it.content}</div> : null))}
      </div>
    </div>
  );
}

// ---------- Stat ----------
export function Stat({ label, value, suffix, delta }: { label: string; value: number | string; suffix?: string; delta?: { value: number; positive: boolean } }) {
  return (
    <div data-testid="stat" className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
        {suffix && <span className="text-sm text-slate-500 dark:text-slate-400">{suffix}</span>}
        {delta && (
          <span className={`ml-2 text-xs font-medium ${delta.positive ? 'text-green-600' : 'text-red-600'}`}>
            {delta.positive ? '↑' : '↓'} {Math.abs(delta.value)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Section ----------
export function Section({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}

// ---------- Tooltip (title fallback) ----------
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  // Inject `title` onto the single child element so native tooltip shows on hover
  if (typeof children === 'object' && children !== null && 'type' in children) {
    const el = children as React.ReactElement<{ title?: string }>;
    const existing = el.props.title;
    return (
      <span className="inline-flex">
        {React.cloneElement(el, { title: existing ?? content })}
      </span>
    );
  }
  return (
    <span title={content} className="inline-flex">
      {children}
    </span>
  );
}

// ---------- Popover ----------
export function Popover({ trigger, content, align = 'right' }: { trigger: ReactNode; content: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          data-testid="popover-content"
          className={`absolute z-30 mt-2 min-w-[180px] rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// ---------- Drawer (right-side) ----------
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'md',
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  testId?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const W = width === 'sm' ? 'w-80' : width === 'lg' ? 'w-[36rem]' : 'w-[28rem]';
  return (
    <div className="fixed inset-0 z-40 flex">
      <div data-testid={`${testId || 'drawer'}-overlay`} className="flex-1 bg-slate-900/40" onClick={onClose} />
      <aside data-testid={testId || 'drawer'} className={`${W} flex h-full flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900`}>
        {title && (
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <button onClick={onClose} aria-label="close" className="text-slate-400 hover:text-slate-700">×</button>
          </header>
        )}
        <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
      </aside>
    </div>
  );
}

// ---------- Sheet (bottom drawer) ----------
export function Sheet({
  open,
  onClose,
  title,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testId?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div data-testid={`${testId || 'sheet'}-overlay`} className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div data-testid={testId || 'sheet'} className="relative z-10 w-full max-w-2xl rounded-t-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        {title && (
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <button onClick={onClose} aria-label="close" className="text-slate-400 hover:text-slate-700">×</button>
          </header>
        )}
        <div className="max-h-[60vh] overflow-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}