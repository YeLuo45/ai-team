// V168: KeyboardShortcutHint — small floating cheat sheet for keyboard shortcuts.
// Designed to sit alongside the trigger badge in RealtimeQuestionSuggester.
// The user clicks the icon to toggle the popover; outside-click closes it.
//
// Each entry is a single key (or named key combo) and a label. Popover is
// ARIA-friendly: button has aria-haspopup + aria-expanded; popover is a
// labelled region with role="dialog".

import { useEffect, useRef, useState } from 'react';

export interface KeyboardShortcut {
  /** The key the user presses (case-insensitive). */
  readonly key: string;
  /** Human-readable label for the action. */
  readonly label: string;
}

export interface KeyboardShortcutHintProps {
  /** The shortcuts to display. Order is preserved top-to-bottom. */
  shortcuts: ReadonlyArray<KeyboardShortcut>;
  /** Optional button label — defaults to "⌨️". */
  icon?: string;
  /** Optional popover title — defaults to "键盘快捷键". */
  title?: string;
  /** Optional id for testing. */
  testId?: string;
}

export function KeyboardShortcutHint({
  shortcuts,
  icon = '⌨️',
  title = '键盘快捷键',
  testId = 'ksh',
}: KeyboardShortcutHintProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Outside-click closes the popover. Without this, clicking elsewhere on
  // the page leaves it stuck open.
  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;
    const handler = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (target && root.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape closes the popover too — feels natural with modal-style popovers.
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (e && e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (shortcuts.length === 0) return null;

  return (
    <div className="relative inline-block" ref={rootRef} data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200"
        data-testid={`${testId}-toggle`}
      >
        {icon}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className="absolute right-0 top-full z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
          data-testid={`${testId}-popover`}
        >
          <h5
            className="mb-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
            data-testid={`${testId}-title`}
          >
            {title}
          </h5>
          <ul
            className="space-y-1"
            data-testid={`${testId}-list`}
          >
            {shortcuts.map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300"
                data-testid={`${testId}-row`}
                data-shortcut-key={s.key.toLowerCase()}
              >
                <span>{s.label}</span>
                <kbd
                  className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  data-testid={`${testId}-kbd`}
                >
                  {s.key}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
