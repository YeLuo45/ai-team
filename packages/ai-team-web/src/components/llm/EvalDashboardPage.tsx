// V199: EvalDashboardPage — presentational UI for the V191 eval-summary
// snapshot. Pure read-only; consumers feed the eval-summary in via props.

import { type ReactElement } from 'react';
import {
  buildEvalSummary,
  type AdoptionEvent,
} from '../../lib/llm/eval-summary';
import type { EvalCaseResult } from '../../lib/llm/eval-harness';
import type { EvalTimelineEntry } from '../../lib/llm/eval-timeline';

export interface EvalDashboardPageProps {
  testId?: string;
  recentResults?: ReadonlyArray<EvalCaseResult>;
  timeline?: ReadonlyArray<EvalTimelineEntry>;
  adoptions?: ReadonlyArray<AdoptionEvent>;
  nowMs?: number;
  /** Title text shown at the top. */
  title?: string;
}

export function EvalDashboardPage({
  testId = 'es-dash',
  recentResults,
  timeline,
  adoptions,
  nowMs,
  title = 'Eval Dashboard',
}: EvalDashboardPageProps): ReactElement {
  const summary = buildEvalSummary({
    recentResults,
    timeline,
    adoptions,
    nowMs,
  });
  const passRatePct = (summary.recent.passRate * 100).toFixed(1);

  return (
    <div
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4"
      data-testid={testId}
      data-cases={summary.recent.totalCases}
      data-pass-rate={passRatePct}
    >
      <header className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        <span className="font-mono text-xs text-slate-500">
          {summary.recent.totalCases} cases · {passRatePct}%
        </span>
      </header>

      <section data-testid={`${testId}-recent`}>
        <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Recent run
        </h4>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Stat label="cases" value={summary.recent.totalCases.toString()} />
          <Stat label="passed" value={summary.recent.passed.toString()} />
          <Stat label="failed" value={summary.recent.failed.toString()} />
        </div>
      </section>

      <section data-testid={`${testId}-top-failures`}>
        <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Top failures
        </h4>
        {summary.recent.topFailures.length === 0 ? (
          <p className="text-xs text-slate-400 mt-1">No failures recorded.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-xs">
            {summary.recent.topFailures.slice(0, 5).map((f) => (
              <li
                key={f.fixtureId}
                data-testid={`${testId}-failure-${f.fixtureId}`}
                data-count={f.count}
                data-runner={f.latestRunner}
                className="flex justify-between font-mono text-rose-600 dark:text-rose-400"
              >
                <span>{f.fixtureId}</span>
                <span>
                  {f.count}× · {f.latestRunner}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid={`${testId}-adoptions`}>
        <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Adopted questions
        </h4>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Stat label="total" value={summary.adoptions.total.toString()} />
          <Stat label="unique" value={summary.adoptions.uniqueQuestions.toString()} />
          <Stat label="7d" value={summary.adoptions.lastSevenDays.toString()} />
        </div>
        {summary.adoptions.mostAdopted.length > 0 ? (
          <ol className="mt-2 space-y-0.5 text-xs">
            {summary.adoptions.mostAdopted.slice(0, 5).map((q) => (
              <li
                key={q.questionId}
                data-testid={`${testId}-top-q-${q.questionId}`}
                data-adoption-count={q.count}
                className="flex justify-between font-mono text-slate-700 dark:text-slate-200"
              >
                <span>{q.questionId}</span>
                <span>{q.count}×</span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section data-testid={`${testId}-timeline`}>
        <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Timeline
        </h4>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Stat label="runs" value={summary.timeline.totalRuns.toString()} />
          <Stat
            label="pass-rate"
            value={`${(summary.timeline.overallPassRate * 100).toFixed(1)}%`}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div
      data-testid={`stat-${label}`}
      className="rounded bg-slate-50 dark:bg-slate-800/40 px-2 py-1.5"
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="font-mono text-sm text-slate-800 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}
