// V200: PrivacyOverrideLogView — presentational UI for the V188
// PrivacyOverrideLog snapshot. Pure read-only; the caller feeds a
// PrivacyOverrideLog instance plus optional filter hints via props.
//
// Renders:
//   - Header counts (allowed / denied / timeout)
//   - Recent events list (most recent first), each row tagged with the
//     outcome tone + actor + reason + relative time + ISO title
//   - Empty state when no events match the filter

import { type ReactElement } from 'react';
import {
  type PrivacyOpKind,
  type PrivacyOutcome,
  type PrivacyOverrideEvent,
} from '../../lib/privacy/override-log';

export interface PrivacyOverrideLogViewProps {
  testId?: string;
  events?: ReadonlyArray<PrivacyOverrideEvent>;
  /** ms epoch used to render relative-time strings; defaults to Date.now(). */
  nowMs?: number;
  /** Max number of rows to display; defaults to 25. */
  limit?: number;
  /** Optional filter label surfaced above the list (purely informational). */
  filterLabel?: string;
  /** Title text shown at the top. */
  title?: string;
  /** Optional subset of ops to highlight in the header chips. */
  highlightOps?: ReadonlyArray<PrivacyOpKind>;
}

const OUTCOME_TONE: Record<PrivacyOutcome, string> = {
  allowed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  denied: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  timeout: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
};

const OP_LABEL: Record<PrivacyOpKind, string> = {
  'export-audio': '导出音频',
  'export-interview': '导出面试',
  'clipboard-copy': '复制到剪贴板',
  'remote-stream': '远端转发',
};

export function PrivacyOverrideLogView({
  testId = 'pol',
  events,
  nowMs,
  limit = 25,
  filterLabel,
  title = 'Privacy Override Log',
  highlightOps,
}: PrivacyOverrideLogViewProps): ReactElement {
  const now = nowMs ?? Date.now();
  const list = events ?? [];
  const counts: Record<PrivacyOutcome, number> = { allowed: 0, denied: 0, timeout: 0 };
  for (const e of list) counts[e.outcome] += 1;

  const opCounts = new Map<PrivacyOpKind, number>();
  if (highlightOps) {
    for (const op of highlightOps) opCounts.set(op, 0);
    for (const e of list) {
      if (highlightOps.includes(e.op)) opCounts.set(e.op, (opCounts.get(e.op) ?? 0) + 1);
    }
  }

  const sorted = [...list].sort((a, b) => b.decidedAtMs - a.decidedAtMs).slice(0, limit);

  return (
    <section
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
      data-testid={testId}
      data-total={list.length}
      data-allowed={counts.allowed}
      data-denied={counts.denied}
      data-timeout={counts.timeout}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        <span
          className="font-mono text-xs text-slate-500"
          data-testid={`${testId}-total`}
        >
          {list.length} events
        </span>
      </header>

      <div
        className="grid grid-cols-3 gap-2"
        data-testid={`${testId}-counts`}
      >
        <Stat label="allowed" value={counts.allowed} tone="allowed" testId={testId} />
        <Stat label="denied" value={counts.denied} tone="denied" testId={testId} />
        <Stat label="timeout" value={counts.timeout} tone="timeout" testId={testId} />
      </div>

      {highlightOps && highlightOps.length > 0 ? (
        <div
          className="flex flex-wrap gap-1.5 text-xs"
          data-testid={`${testId}-ops`}
        >
          {highlightOps.map((op) => (
            <span
              key={op}
              data-testid={`${testId}-op-${op}`}
              data-count={opCounts.get(op) ?? 0}
              className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-slate-700 dark:text-slate-200"
            >
              {OP_LABEL[op]} · {opCounts.get(op) ?? 0}
            </span>
          ))}
        </div>
      ) : null}

      {filterLabel ? (
        <p
          className="text-[11px] uppercase tracking-wide text-slate-500"
          data-testid={`${testId}-filter`}
        >
          filter: {filterLabel}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p
          className="text-xs text-slate-400"
          data-testid={`${testId}-empty`}
        >
          No override events recorded.
        </p>
      ) : (
        <ol
          className="space-y-1"
          data-testid={`${testId}-list`}
        >
          {sorted.map((e) => (
            <li
              key={e.id}
              data-testid={`${testId}-row-${e.id}`}
              data-op={e.op}
              data-outcome={e.outcome}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-slate-50 dark:bg-slate-800/40 px-2 py-1"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_TONE[e.outcome]}`}
                  data-testid={`${testId}-row-${e.id}-outcome`}
                >
                  {e.outcome}
                </span>
                <span
                  className="font-mono text-xs text-slate-700 dark:text-slate-200 truncate"
                  data-testid={`${testId}-row-${e.id}-op`}
                >
                  {OP_LABEL[e.op]}
                </span>
                <span
                  className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[16rem]"
                  data-testid={`${testId}-row-${e.id}-reason`}
                  title={e.reason}
                >
                  {e.reason || '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span data-testid={`${testId}-row-${e.id}-actor`}>
                  {e.actor ?? 'anon'}
                </span>
                <span
                  className="font-mono"
                  data-testid={`${testId}-row-${e.id}-age`}
                  title={new Date(e.decidedAtMs).toISOString()}
                >
                  {formatRelative(e.decidedAtMs, now)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
  testId,
}: {
  label: PrivacyOutcome;
  value: number;
  tone: PrivacyOutcome;
  testId: string;
}): ReactElement {
  return (
    <div
      data-testid={`stat-${testId}-${label}`}
      className={`rounded px-2 py-1.5 ${OUTCOME_TONE[tone]}`}
    >
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-mono text-base">{value}</div>
    </div>
  );
}

function formatRelative(decidedAtMs: number, nowMs: number): string {
  const delta = nowMs - decidedAtMs;
  if (delta < 0) return new Date(decidedAtMs).toISOString().slice(0, 19).replace('T', ' ');
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(decidedAtMs).toISOString().slice(0, 10);
}

/** Re-export the underlying helpers so consumers can pick this up in one import. */
export { formatOverrideLine, type PrivacyOpKind, type PrivacyOutcome, type PrivacyOverrideEvent } from '../../lib/privacy/override-log';