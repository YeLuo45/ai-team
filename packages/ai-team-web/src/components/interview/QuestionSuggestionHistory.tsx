// V165: QuestionSuggestionHistory — panel showing previously adopted
// suggestions for the current browser (localStorage).
//
// The RealtimeQuestionSuggester (V164) owns the "current" suggestion. This
// component owns the "past" — a chronological list of every suggestion the
// interviewer has clicked ✅ Adopt.
//
// Newest-first ordering is enforced on read by `readHistory`.
// Empty state, clear button, and JSON export are all inline so the panel is
// drop-in usable from any panel/list page.

import { useEffect, useMemo, useState } from 'react';
import { Card } from '../design-system';
import {
  clearHistory as clearHistoryPure,
  exportHistoryJson,
  readHistory,
  removeAdopted,
  type AdoptedSuggestion,
  type HistoryFile,
  writeHistory,
} from '../../lib/question-suggestion/history';

interface Props {
  /** Optional — inject storage (for SSR / private-mode tests). Defaults to window.localStorage. */
  storage?: Storage | null;
  /** Optional — cap displayed entries (defaults to showing all up to MAX_ENTRIES). */
  limit?: number;
  /** Optional — fired after the underlying history changes (clear / remove). */
  onChange?: (file: HistoryFile) => void;
}

const FOCUS_LABEL: Record<NonNullable<AdoptedSuggestion['focusTag']>, string> = {
  technical: '技术',
  communication: '沟通',
  problemSolving: '问题解决',
  culture: '文化契合',
};

export function QuestionSuggestionHistory({ storage, limit, onChange }: Props) {
  const store: Storage | null = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const [file, setFile] = useState<HistoryFile>(() => readHistory(store));

  // Re-read storage when the prop changes (e.g. switching browsers / user logs in).
  useEffect(() => {
    setFile(readHistory(store));
  }, [store]);

  const visible = useMemo(
    () => (limit ? file.entries.slice(0, limit) : file.entries),
    [file, limit],
  );

  const update = (next: HistoryFile) => {
    writeHistory(store, next);
    setFile(next);
    onChange?.(next);
  };

  const onClear = () => {
    if (visible.length === 0) return;
    update(clearHistoryPure());
  };

  const onRemove = (suggestionId: string) => {
    update(removeAdopted(file, suggestionId));
  };

  const onExport = () => {
    if (typeof window === 'undefined') return;
    const json = exportHistoryJson(file);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `question-suggestion-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="space-y-3" testId="question-suggestion-history">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          📋 采纳历史（{file.entries.length}）
        </h4>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onExport}
            disabled={file.entries.length === 0}
            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200"
            data-testid="qsh-export"
          >
            ⬇ 导出 JSON
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={file.entries.length === 0}
            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="qsh-clear"
          >
            🗑 清空
          </button>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="text-xs text-slate-400" data-testid="qsh-empty">
          暂无采纳历史 — 在面试详情里点击「✅ 采纳」后会出现在这里
        </p>
      ) : (
        <ul className="space-y-2" data-testid="qsh-list">
          {visible.map((entry) => (
            <li
              key={entry.suggestionId}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/40"
              data-testid="qsh-entry"
              data-suggestion-id={entry.suggestionId}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p
                  className="flex-1 font-medium text-slate-900 dark:text-slate-50"
                  data-testid="qsh-entry-question"
                >
                  {entry.question}
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(entry.suggestionId)}
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="删除此条历史"
                  data-testid="qsh-entry-remove"
                >
                  ×
                </button>
              </div>
              <p
                className="mt-1 text-[11px] text-slate-500"
                data-testid="qsh-entry-rationale"
              >
                💡 {entry.rationale}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span data-testid="qsh-entry-candidate">
                  👤 {entry.candidateName}
                </span>
                <span>·</span>
                <span data-testid="qsh-entry-position">
                  {entry.position}
                </span>
                {entry.focusTag && (
                  <>
                    <span>·</span>
                    <span
                      className="rounded-full bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      data-testid="qsh-entry-focus"
                    >
                      {FOCUS_LABEL[entry.focusTag]}
                    </span>
                  </>
                )}
                <span>·</span>
                <span data-testid="qsh-entry-difficulty">
                  {entry.difficulty}
                </span>
                <span>·</span>
                <span data-testid="qsh-entry-time">
                  {new Date(entry.adoptedAt).toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}