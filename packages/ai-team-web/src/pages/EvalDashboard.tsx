// V201: EvalDashboard page — wires the V199 EvalDashboardPage component
// into the SPA route /eval-dashboard.
//
// Pulls:
//   * adoption events from the V165 history storage
//   * eval timeline + recent results — empty until the V186 streaming
//     runner starts persisting runs (deferred to V186 follow-up)
//
// The page is intentionally thin: presentation lives in
// `components/llm/EvalDashboardPage.tsx`, this file only does the
// data-wiring glue.

import { useMemo } from 'react';
import { useTeamData } from '../lib/hooks';
import { readHistory } from '../lib/question-suggestion/history';
import { EvalDashboardPage } from '../components/llm/EvalDashboardPage';
import type { AdoptionEvent } from '../lib/llm/eval-summary';

export function EvalDashboard() {
  const { data, loading, source, error } = useTeamData();
  const adoptions = useMemo<AdoptionEvent[]>(() => {
    if (typeof window === 'undefined') return [];
    const file = readHistory(window.localStorage);
    return file.entries.map((e) => ({
      questionId: e.suggestionId,
      question: e.question,
      adoptedAtMs: e.adoptedAt,
      candidateId: e.sessionId,
    }));
  }, [data?.generatedAt]); // re-derive when team data refreshes

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500" data-testid="eval-dashboard-loading">
        Loading team data…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-6 text-sm text-rose-600"
        data-testid="eval-dashboard-error"
        role="alert"
      >
        Failed to load team data: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3" data-testid="eval-dashboard">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Eval Dashboard
        </h2>
        <span
          className="text-xs font-mono text-slate-500"
          data-testid="eval-dashboard-source"
        >
          source: {source}
        </span>
      </header>
      <EvalDashboardPage
        adoptions={adoptions}
        title="Eval Snapshot"
        testId="edp"
      />
    </div>
  );
}

export default EvalDashboard;