// V176: EvalResultsTable — read-only viewer for an `EvalSummary`
// produced by `runEvalSuite` / `summarise` (lib/llm/eval-harness.ts).
//
// Layout:
//   1) Header band: total / passed / failed / pass-rate / total time
//   2) Per-runner chip cluster (✅ / ❌ split)
//   3) Per-fixture table — click a row to expand its check-list
//
// Purely presentational — no state machine, no side effects. Caller
// hands in the `EvalCaseResult[]` and the component renders.

import { useMemo, useState } from 'react';
import { Card } from '../design-system';
import {
  type EvalCaseResult,
  formatPassRate,
  passRate,
  summarise,
} from '../../lib/llm/eval-harness';

interface Props {
  results: ReadonlyArray<EvalCaseResult>;
  /** Optional title shown above the table. */
  title?: string;
  /** Optional test id root. */
  testId?: string;
}

export function EvalResultsTable({
  results,
  title = '🧪 Agent Eval Harness',
  testId = 'ert',
}: Props) {
  const summary = useMemo(() => summarise(results), [results]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  if (results.length === 0) {
    return (
      <Card className="text-xs text-slate-400" testId={`${testId}-empty`}>
        尚无 eval 结果 — 运行 <code>runEvalSuite()</code> 后这里会显示 pass-rate 和 per-fixture 详情
      </Card>
    );
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="space-y-3" testId={`${testId}-content`}>
      <header
        className="flex flex-wrap items-center justify-between gap-2"
        data-testid={`${testId}-header`}
      >
        <h4
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
          data-testid={`${testId}-title`}
        >
          {title}
        </h4>
        <div
          className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"
          data-testid={`${testId}-summary`}
        >
          <span
            data-testid={`${testId}-counts`}
            className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {summary.passed}/{summary.total} 通过
          </span>
          <span data-testid={`${testId}-rate`}>
            rate {formatPassRate(summary)}
          </span>
          <span data-testid={`${testId}-elapsed`}>
            总耗时 {summary.totalElapsedMs} ms
          </span>
        </div>
      </header>

      {/* Per-runner breakdown */}
      <div
        className="flex flex-wrap gap-2"
        data-testid={`${testId}-runners`}
      >
        {Array.from(summary.byRunner.entries()).map(([runner, counts]) => (
          <div
            key={runner}
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
              counts.failed === 0
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
            }`}
            data-testid={`${testId}-runner-${runner}`}
          >
            <span className="font-semibold">{runner}</span>
            <span>
              {counts.passed} ✅ / {counts.failed} ❌
            </span>
          </div>
        ))}
      </div>

      {/* Per-fixture table */}
      <table
        className="w-full table-fixed border-collapse text-left text-[11px]"
        data-testid={`${testId}-table`}
      >
        <thead>
          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700">
            <th className="w-6 py-1" aria-label="expand" />
            <th className="w-1/4 py-1">Fixture</th>
            <th className="w-1/6 py-1">Runner</th>
            <th className="w-1/6 py-1">Status</th>
            <th className="w-1/6 py-1 text-right">耗时</th>
            <th className="w-2/4 py-1">备注</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const isOpen = expanded.has(r.fixtureId);
            const rowClass = r.passed
              ? 'border-b border-slate-100 dark:border-slate-800'
              : 'border-b border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-900/20';
            return (
              <FragmentRow
                key={r.fixtureId}
                rowClass={rowClass}
                result={r}
                isOpen={isOpen}
                onToggle={() => toggle(r.fixtureId)}
                testId={`${testId}-row`}
              />
            );
          })}
        </tbody>
      </table>

      <footer
        className="text-[10px] text-slate-500"
        data-testid={`${testId}-footer`}
      >
        点击行查看逐条 assertion (passed/failed + detail). 全局 pass-rate = {formatPassRate(summary)}.
      </footer>
    </Card>
  );
}

interface RowProps {
  rowClass: string;
  result: EvalCaseResult;
  isOpen: boolean;
  onToggle: () => void;
  testId: string;
}

function FragmentRow({ rowClass, result, isOpen, onToggle, testId }: RowProps) {
  const detail = result.error
    ? `error: ${result.error}`
    : result.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
        .join('; ') || '—';
  const passedText = passRate(summarise([result])) === 1 ? '✅ pass' : '❌ fail';
  return (
    <>
      <tr className={rowClass} data-testid={testId} data-fixture={result.fixtureId}>
        <td className="py-1 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={isOpen ? 'collapse row' : 'expand row'}
            aria-expanded={isOpen}
            data-testid={`${testId}-toggle-${result.fixtureId}`}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        </td>
        <td className="py-1 align-top font-mono text-[10px] text-slate-700 dark:text-slate-200">
          <div>{result.fixtureId}</div>
          {result.label ? (
            <div className="text-slate-500">{result.label}</div>
          ) : null}
        </td>
        <td className="py-1 align-top">{result.runnerLabel}</td>
        <td className="py-1 align-top" data-testid={`${testId}-status`}>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              result.passed
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
            }`}
          >
            {passedText}
          </span>
        </td>
        <td className="py-1 align-top text-right font-mono text-[10px] text-slate-500">
          {result.elapsedMs} ms
        </td>
        <td className="py-1 align-top text-slate-600 dark:text-slate-300">{detail}</td>
      </tr>
      {isOpen ? (
        <tr data-testid={`${testId}-details-${result.fixtureId}`} data-fixture-id={result.fixtureId}>
          <td colSpan={6} className="bg-slate-50 px-4 py-2 dark:bg-slate-800/40">
            {result.checks.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {result.error ? `agent threw: ${result.error}` : '无断言 (空 expectation)'}
              </p>
            ) : (
              <ul className="space-y-1">
                {result.checks.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[11px]"
                    data-testid={`${testId}-check`}
                    data-fixture-id={result.fixtureId}
                    data-passed={c.passed ? 'true' : 'false'}
                  >
                    <span
                      className={`mt-0.5 inline-flex w-12 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        c.passed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                      }`}
                    >
                      {c.passed ? '✅' : '❌'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{c.name}</span>
                    {c.detail ? (
                      <span className="text-slate-700 dark:text-slate-200">{c.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
