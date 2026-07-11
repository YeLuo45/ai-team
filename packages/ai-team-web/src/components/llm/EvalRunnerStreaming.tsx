// V186: EvalRunnerStreaming — UI 组件，包装 V181 流式 harness +
// V176 结果表格 + V182 导出按钮的完整闭环。
//
// 与 V179 EvalRunner 区别：
//   - 用 runStreamingEvalSuite 替代 runEvalSuite → 实时 progress
//   - 跑分过程可见：每 case 完成后追加结果
//   - 完成后可直接 export JSON/NDJSON/Markdown
//   - 支持 AbortSignal — 用户中途取消
//
// 状态机:
//   * idle    — 等待启动，显示 fixtures list
//   * running — streaming 进度条 + 当前 fixture label
//   * done    — EvalResultsTable + Export 按钮 + 重跑

import { useState } from 'react';
import { Card } from '../design-system';
import {
  type AgentRunner,
  type EvalCaseResult,
  type EvalFixture,
  type ExportOptions,
  type StreamingProgress,
  downloadResults,
  exportFilename,
  progressPercent,
  runStreamingEvalSuite,
} from '../../lib/llm';

interface Props {
  runner: AgentRunner;
  fixtures: ReadonlyArray<EvalFixture>;
  title?: string;
  testId?: string;
}

type Mode = 'idle' | 'running' | 'done';

export function EvalRunnerStreaming({
  runner,
  fixtures,
  title = '▶ Eval Runner (Streaming)',
  testId = 'es',
}: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [results, setResults] = useState<ReadonlyArray<EvalCaseResult>>([]);
  const [progress, setProgress] = useState<StreamingProgress>({
    total: 0,
    done: 0,
    currentId: '',
    passedSoFar: 0,
    failedSoFar: 0,
  });
  const [aborted, setAborted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportOptions['format']>('json');

  if (fixtures.length === 0) {
    return (
      <Card className="text-xs text-slate-400" testId={`${testId}-empty`}>
        {title} — 加载 fixtures 后才可运行
      </Card>
    );
  }

  const start = async () => {
    setError(null);
    setAborted(false);
    setResults([]);
    setProgress({ total: fixtures.length, done: 0, currentId: '', passedSoFar: 0, failedSoFar: 0 });
    setMode('running');
    try {
      const summary = await runStreamingEvalSuite(runner, fixtures, {
        onProgress: (p) => {
          setProgress(p);
        },
        onAfterCase: (result) => {
          setResults((prev) => [...prev, result]);
        },
      });
      setAborted(summary.aborted);
      setMode('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode('idle');
    }
  };

  const exportResults = () => {
    downloadResults(results, { format: exportFormat });
  };

  const pct = progressPercent(progress);

  if (mode === 'done') {
    return (
      <div className="space-y-3" data-testid={`${testId}-done`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4
            className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            data-testid={`${testId}-title`}
          >
            {title}
            {aborted ? ' ⏹ (aborted)' : ''}
          </h4>
          <div
            className="flex flex-wrap items-center gap-2 text-[11px]"
            data-testid={`${testId}-controls`}
          >
            <select
              value={exportFormat ?? 'json'}
              onChange={(e) => setExportFormat(e.target.value as ExportOptions['format'])}
              className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
              data-testid={`${testId}-format`}
            >
              <option value="json">JSON</option>
              <option value="ndjson">NDJSON</option>
              <option value="markdown">Markdown</option>
            </select>
            <button
              type="button"
              onClick={exportResults}
              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
              data-testid={`${testId}-export`}
            >
              📥 Export {exportFilename(exportFormat ?? 'json').split('.').pop()}
            </button>
            <button
              type="button"
              onClick={start}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              data-testid={`${testId}-rerun`}
            >
              🔁 重跑
            </button>
          </div>
        </div>
        <div className="text-[11px]" data-testid={`${testId}-progress`}>
          {progress.done}/{progress.total} ({pct}%) — pass {progress.passedSoFar} · fail {progress.failedSoFar}
        </div>
        <div className="space-y-2" data-testid={`${testId}-list`}>
          {results.length > 0 ? (
            <table
              className="w-full table-fixed border-collapse text-left text-[11px]"
              data-testid={`${testId}-table`}
            >
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="w-1/3 py-1">Fixture</th>
                  <th className="w-1/6 py-1">Runner</th>
                  <th className="w-1/6 py-1">Status</th>
                  <th className="w-1/6 py-1 text-right">Elapsed</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.fixtureId}
                    className="border-b border-slate-100 dark:border-slate-800"
                    data-testid={`${testId}-row-${r.fixtureId}`}
                    data-fixture-id={r.fixtureId}
                    data-passed={r.passed ? 'true' : 'false'}
                  >
                    <td className="py-1 font-mono text-[10px] text-slate-700 dark:text-slate-200">
                      {r.fixtureId}
                    </td>
                    <td className="py-1">{r.runnerLabel}</td>
                    <td className="py-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          r.passed
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                        }`}
                      >
                        {r.passed ? '✅' : '❌'}
                      </span>
                    </td>
                    <td className="py-1 text-right font-mono text-[10px] text-slate-500">
                      {r.elapsedMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[11px] text-slate-500">无结果（已取消）</p>
          )}
        </div>
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
            onClick={start}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
            data-testid={`${testId}-start`}
          >
            ▶ Streaming run ({fixtures.length} fixtures)
          </button>
        ) : (
          <span
            className="text-[11px] text-slate-500"
            data-testid={`${testId}-progress`}
            data-pct={pct}
            data-done={progress.done}
            data-total={progress.total}
          >
            {progress.done}/{progress.total} ({pct}%) {progress.currentId ? `— ${progress.currentId}` : ''}
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
      {mode === 'running' && progress.total > 0 ? (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
          data-testid={`${testId}-bar`}
        >
          <div
            className="h-2 bg-blue-500 transition-[width] duration-150"
            style={{ width: `${pct}%` }}
            data-testid={`${testId}-bar-fill`}
          />
        </div>
      ) : null}
      <ul className="space-y-1 text-[11px]" data-testid={`${testId}-queue`}>
        {fixtures.slice(0, 8).map((f, i) => (
          <li
            key={f.id}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono dark:border-slate-700 dark:bg-slate-800/40"
            data-testid={`${testId}-queue-item`}
            data-fixture={f.id}
            data-done={
              results.some((r) => r.fixtureId === f.id) ? 'true' : 'false'
            }
          >
            {i + 1}. {f.id}
            {f.label ? ` — ${f.label}` : ''}
          </li>
        ))}
      </ul>
    </Card>
  );
}
