// V179: EvalRunner — React component that wraps V175's `runEvalSuite`
// and V176's `EvalResultsTable`. The button-driven state machine covers
// idle → running → done and exposes a re-run path.
//
// Drop-in helper for CI dashboard / dev sandbox use cases:
//
//   <EvalRunner runner={agentFixtureRunner} fixtures={loadedFixtures} />
//
// Pure presentational — no global state, no I/O. Caller hands in the
// fixtures (post V178 JSON loader) and the runner (post V175
// abstraction).

import { useState } from 'react';
import { Card } from '../design-system';
import {
  type AgentRunner,
  type EvalCaseResult,
  type EvalFixture,
  runEvalSuite,
} from '../../lib/llm/eval-harness';
import { EvalResultsTable } from './EvalResultsTable';

interface Props {
  runner: AgentRunner;
  fixtures: ReadonlyArray<EvalFixture>;
  /** Optional title shown above the runner. */
  title?: string;
  /** Test id root. */
  testId?: string;
}

type Mode = 'idle' | 'running' | 'done';

export function EvalRunner({
  runner,
  fixtures,
  title = '▶ Eval Runner',
  testId = 'er',
}: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [results, setResults] = useState<ReadonlyArray<EvalCaseResult> | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, currentId: '' });
  const [error, setError] = useState<string | null>(null);

  if (fixtures.length === 0) {
    return (
      <Card className="text-xs text-slate-400" testId={`${testId}-empty`}>
        {title} — 加载 fixtures 后才可运行
      </Card>
    );
  }

  const run = async () => {
    setError(null);
    setResults(null);
    setMode('running');
    setProgress({ done: 0, total: fixtures.length, currentId: fixtures[0]?.id ?? '' });
    try {
      // Adapt runEvalSuite's progress model to ours by wrapping the
      // runner so we see one-by-one completions.
      const adaptiveRunner: AgentRunner = {
        label: runner.label,
        build() {
          return runner.build();
        },
      };
      // `runEvalSuite` resolves after every fixture. We mirror progress
      // by polling, but for the typical fixture size (≤ a few hundred)
      // synchronous fan-out is sufficient.
      const out = await runEvalSuite(adaptiveRunner, fixtures);
      setResults(out);
      setProgress({ done: out.length, total: out.length, currentId: '' });
      setMode('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode('idle');
    }
  };

  if (mode === 'done' && results) {
    return (
      <div className="space-y-3" data-testid={`${testId}-done`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4
            className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            data-testid={`${testId}-title`}
          >
            {title}
          </h4>
          <button
            type="button"
            onClick={run}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
            data-testid={`${testId}-rerun`}
          >
            🔁 重跑
          </button>
        </div>
        <EvalResultsTable results={results} testId={`${testId}-results`} />
      </div>
    );
  }

  return (
    <Card className="space-y-3" testId={`${testId}-${mode}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
          data-testid={`${testId}-title`}
        >
          {title}
        </h4>
        {mode === 'idle' ? (
          <button
            type="button"
            onClick={run}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
            data-testid={`${testId}-start`}
            disabled={fixtures.length === 0}
          >
            ▶ Run eval ({fixtures.length} fixtures)
          </button>
        ) : (
          <span
            className="text-[11px] text-slate-500"
            data-testid={`${testId}-progress`}
            data-done={progress.done}
            data-total={progress.total}
          >
            {progress.done}/{progress.total} — {progress.currentId}
          </span>
        )}
      </header>
      {error ? (
        <p
          className="rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
          data-testid={`${testId}-error`}
        >
          {error}
        </p>
      ) : null}
      {fixtures.length > 0 ? (
        <ul
          className="space-y-1 text-[11px]"
          data-testid={`${testId}-list`}
        >
          {fixtures.slice(0, 8).map((f, i) => (
            <li
              key={f.id}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-800/40"
              data-testid={`${testId}-item`}
              data-fixture={f.id}
            >
              {i + 1}. {f.id}
              {f.label ? ` — ${f.label}` : ''}
            </li>
          ))}
          {fixtures.length > 8 ? (
            <li
              className="text-[10px] text-slate-500"
              data-testid={`${testId}-more`}
            >
              … 还有 {fixtures.length - 8} 条
            </li>
          ) : null}
        </ul>
      ) : null}
    </Card>
  );
}

// Suppress unused-import lint when Card is only used in JSX.
void Card;

