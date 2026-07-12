// V198: ReuseBar — UI 包装 V193 cross-session suggestion reuse helpers。
// 显示 candidate 已采纳的建议ranked by reuse score, 支持点击 re-use。

import { type ReactElement, useMemo } from 'react';
import {
  findReuseCandidates,
  type HistoryLikeEntry,
} from '../../lib/question-suggestion/reuse';

export interface ReuseBarProps {
  testId?: string;
  history: ReadonlyArray<HistoryLikeEntry>;
  /** Current focus tag, scopes results. */
  focusTag?: string;
  /** Limit. Default 5. */
  limit?: number;
  nowMs?: number;
  /** Invoked when the interviewer picks a suggestion. */
  onPick?: (c: { questionId: string; question: string }) => void;
}

export function ReuseBar({
  testId = 'reuse-bar',
  history,
  focusTag,
  limit = 5,
  nowMs,
  onPick,
}: ReuseBarProps): ReactElement {
  const candidates = useMemo(
    () =>
      findReuseCandidates(history, {
        nowMs: nowMs ?? Date.now(),
        limit,
        ...(focusTag ? { focusTag } : {}),
      }),
    [history, focusTag, limit, nowMs],
  );

  if (candidates.length === 0) {
    return (
      <div
        data-testid={testId}
        data-state="empty"
        className="rounded border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500"
      >
        No reuse candidates yet.
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
      data-testid={testId}
      data-state="ready"
      data-count={candidates.length}
    >
      <h4 className="font-medium text-slate-700 dark:text-slate-200">
        Reuse from history
      </h4>
      <ol className="mt-1 space-y-1">
        {candidates.map((c) => (
          <li
            key={c.questionId}
            className="flex items-start justify-between gap-2"
          >
            <button
              type="button"
              onClick={() => onPick?.({ questionId: c.questionId, question: c.question })}
              className="flex-1 rounded px-1 py-0.5 text-left text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/40"
              data-testid={`${testId}-pick-${c.questionId}`}
              data-score={(c.score ?? 0).toFixed(4)}
              data-adoption-count={c.adoptionCount}
            >
              <span className="font-mono">{c.question}</span>
            </button>
            <span className="text-[10px] font-mono text-slate-500">
              {c.adoptionCount}× · {(c.score ?? 0).toFixed(2)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
