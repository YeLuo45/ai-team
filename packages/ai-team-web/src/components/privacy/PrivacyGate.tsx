// V177: PrivacyGate — wrapper component that gates UI actions based on
// the current privacy status. Two render modes:
//   * `block`: renders a banner explaining why the action is blocked and
//     hides the children (the operation is suppressed).
//   * `warn`:  renders a warning chip beside the children (the caller
//     can render the children with `aria-disabled` / disabled props).
//
// The component is presentational — the decision logic lives in
// `lib/privacy/guard.ts` (V177) and the privacy status reducer in
// `lib/privacy/summary.ts` (V174).

import type { ReactNode } from 'react';
import {
  evaluateGuard,
  type PrivacyDecision,
  type PrivacySensitiveOp,
} from '../../lib/privacy/guard';
import type { PrivacyStatus } from '../../lib/privacy/summary';

interface Props {
  /** The current privacy status (returned by `summarizePrivacy`). */
  status: PrivacyStatus;
  /** The sensitive operation being wrapped. */
  op: PrivacySensitiveOp;
  /** Optional fallback rendered when the operation is blocked. */
  fallback?: ReactNode;
  /** Test id root. */
  testId?: string;
  /** Children to gate. */
  children: ReactNode;
}

const TONE: Record<PrivacyDecision['tone'], string> = {
  ok: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30',
  warn: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30',
  block: 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/30',
};

const CHIP_TONE: Record<PrivacyDecision['tone'], string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  block: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

export function PrivacyGate({
  status,
  op,
  fallback,
  testId = 'pg',
  children,
}: Props) {
  const decision = evaluateGuard(status, op);

  if (decision.blocked) {
    return (
      <div
        className={`rounded-lg border-l-4 p-3 ring-1 ${TONE[decision.tone]}`}
        data-testid={`${testId}-blocked`}
        role="alert"
        aria-live="assertive"
        data-blocked="true"
        data-op={op}
        data-mode={status.mode}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            className="text-sm font-semibold"
            data-testid={`${testId}-label`}
          >
            {decision.label}
          </p>
          <span
            className="rounded-full bg-rose-700 px-2 py-0.5 text-[10px] font-medium uppercase text-white"
            data-testid={`${testId}-badge`}
          >
            🔒 blocked
          </span>
        </div>
        <p className="text-[11px]" data-testid={`${testId}-detail`}>
          {decision.detail}
        </p>
        {fallback ? (
          <div
            className="text-[11px] text-slate-600 dark:text-slate-300"
            data-testid={`${testId}-fallback`}
          >
            {fallback}
          </div>
        ) : null}
      </div>
    );
  }

  if (decision.tone === 'warn') {
    return (
      <div
        className="relative inline-block"
        data-testid={`${testId}-warn`}
        data-warned="true"
        data-op={op}
        data-mode={status.mode}
      >
        <div
          className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${CHIP_TONE[decision.tone]}`}
          data-testid={`${testId}-chip`}
        >
          {decision.label}
        </div>
        <div className="opacity-90 transition hover:opacity-100" data-testid={`${testId}-children`}>
          {children}
        </div>
        <p className="mt-1 text-[10px] text-slate-500" data-testid={`${testId}-detail`}>
          {decision.detail}
        </p>
      </div>
    );
  }

  // ok — render children with no decoration
  return (
    <div data-testid={`${testId}-ok`} data-mode={status.mode} data-op={op}>
      {children}
    </div>
  );
}

/** Convenience hook for non-React callers / bespoke UI. */
export function usePrivacyDecision(
  status: PrivacyStatus,
  op: PrivacySensitiveOp,
): PrivacyDecision {
  return evaluateGuard(status, op);
}
