// V115: ErrorBoundary + ErrorState + Keyboard shortcuts system

import { Component, ReactNode, useEffect, useState } from 'react';
import { Button } from '../design-system/index.js';
import { useNavigate } from 'react-router-dom';

// ---------- ErrorBoundary ----------
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (err: Error, info: React.ErrorInfo) => void;
}
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (this.props.onError) this.props.onError(error, info);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div data-testid="error-boundary" className="m-6 rounded border border-rose-300 bg-rose-50 p-4">
          <h3 className="text-base font-semibold text-rose-700">出错了</h3>
          <p className="mt-1 text-sm text-rose-600">{this.state.error?.message ?? 'Unknown error'}</p>
          <button
            data-testid="error-boundary-reset"
            onClick={this.reset}
            className="mt-3 rounded border border-rose-300 bg-white px-3 py-1 text-xs text-rose-700"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- ErrorState ----------
export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ title, description, onRetry, retryLabel = '重试' }: ErrorStateProps) {
  return (
    <div data-testid="error-state" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-4xl">⚠️</div>
      <h3 className="mt-3 text-base font-semibold text-rose-700">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {onRetry && (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

// ---------- Shortcut primitives ----------
export interface ShortcutSpec {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export function matchShortcut(e: KeyboardEvent, spec: ShortcutSpec): boolean {
  if (e.key.toLowerCase() !== spec.key.toLowerCase()) return false;
  if (spec.meta && !e.metaKey) return false;
  if (spec.ctrl && !e.ctrlKey) return false;
  if (spec.shift && !e.shiftKey) return false;
  if (spec.alt && !e.altKey) return false;
  if (!spec.meta && e.metaKey) return false;
  if (!spec.ctrl && e.ctrlKey) return false;
  if (!spec.alt && e.altKey) return false;
  return true;
}

export interface ShortcutBinding {
  id: string;
  label: string;
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  hint?: string;
}

export const SHORTCUT_PRESETS: ShortcutBinding[] = [
  { id: 'palette.search', label: '打开命令面板', key: 'k', meta: true, hint: '⌘K' },
  { id: 'help.show', label: '键盘帮助', key: '?', shift: true, hint: 'Shift+?' },
  { id: 'palette.focus', label: '即时搜索', key: '/', hint: '/' },
  { id: 'nav.recruitment', label: '招聘分组', key: '1', meta: true, hint: '⌘1' },
  { id: 'nav.members', label: '成员分组', key: '2', meta: true, hint: '⌘2' },
  { id: 'nav.intelligence', label: '智能分组', key: '3', meta: true, hint: '⌘3' },
  { id: 'nav.system', label: '系统分组', key: '4', meta: true, hint: '⌘4' },
  { id: 'go.candidate', label: '候选人', key: 'c', meta: true, shift: true, hint: '⌘⇧C' },
  { id: 'go.interview', label: '面试', key: 'i', meta: true, shift: true, hint: '⌘⇧I' },
  { id: 'go.pipeline', label: '漏斗', key: 'p', meta: true, shift: true, hint: '⌘⇧P' },
  { id: 'go.member', label: '成员', key: 'm', meta: true, shift: true, hint: '⌘⇧M' },
  { id: 'go.audit', label: '审计', key: 'a', meta: true, shift: true, hint: '⌘⇧A' },
];

const ROUTE_BY_ID: Record<string, string> = {
  'nav.recruitment': '/candidates',
  'nav.members': '/members',
  'nav.intelligence': '/',
  'nav.system': '/audit',
  'go.candidate': '/candidates',
  'go.member': '/members',
  'go.interview': '/interviews',
  'go.pipeline': '/pipeline',
  'go.audit': '/audit',
};

export function navigateToRoute(id: string): string | null {
  return ROUTE_BY_ID[id] ?? null;
}

// ---------- useKeyboardShortcuts ----------
export interface ShortcutEntry {
  spec: ShortcutSpec;
  handler: () => void;
}

export function useKeyboardShortcuts(entries: ShortcutEntry[]): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const entry of entries) {
        if (matchShortcut(e, entry.spec)) {
          e.preventDefault();
          entry.handler();
          return;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [entries]);
}

export interface GlobalShortcutHandlers {
  onPalette?: () => void;
  onHelp?: () => void;
  onFocusSearch?: () => void;
  onNavigate?: (path: string) => void;
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const preset of SHORTCUT_PRESETS) {
        if (matchShortcut(e, preset)) {
          if (preset.id === 'palette.search' && handlers.onPalette) {
            e.preventDefault();
            handlers.onPalette();
            return;
          }
          if (preset.id === 'help.show' && handlers.onHelp) {
            e.preventDefault();
            handlers.onHelp();
            return;
          }
          if (preset.id === 'palette.focus' && handlers.onFocusSearch) {
            e.preventDefault();
            handlers.onFocusSearch();
            return;
          }
          const route = navigateToRoute(preset.id);
          if (route) {
            e.preventDefault();
            const target = handlers.onNavigate ?? ((p: string) => navigate(p));
            target(route);
            return;
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handlers, navigate]);
}

// ---------- KeyboardHelpOverlay ----------
export interface KeyboardHelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardHelpOverlay({ open, onClose }: KeyboardHelpOverlayProps) {
  if (!open) return null;
  return (
    <div
      data-testid="keyboard-help"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60"
      onClick={onClose}
    >
      <div
        className="w-[36rem] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
          <h2 className="text-lg font-semibold">键盘快捷键</h2>
          <button
            data-testid="keyboard-help-close"
            onClick={onClose}
            aria-label="close"
            className="text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <ul className="mt-3 max-h-96 space-y-1 overflow-auto text-sm">
          {SHORTCUT_PRESETS.map((s) => (
            <li
              key={s.id}
              data-testid="shortcut-row"
              className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0 dark:border-slate-800"
            >
              <span>{s.label}</span>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {s.hint ?? s.key}
              </code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Hook helper: bind help overlay state + Esc to close
export function useHelpOverlay(): { open: boolean; setOpen: (b: boolean) => void; onClose: () => void } {
  const [open, setOpen] = useState(false);
  return { open, setOpen, onClose: () => setOpen(false) };
}