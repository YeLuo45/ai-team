// V143: RoundTabs — switch between multiple interview rounds for the same
// candidate (一面 / 二面 / 三面 / 四面 ...). Each tab shows the round label,
// interview type, status badge, and overall score (if evaluated).

import type { Interview } from '@ai-team/core';
import {
  buildRoundLabel,
  formatRoundTimeline,
  interviewTypeLabel,
  roundRecommendation,
} from '../../lib/interview-helpers';

export interface InterviewRound extends Interview {
  round: number;
}

interface Props {
  rounds: ReadonlyArray<InterviewRound>;
  activeRound: number;
  onChange: (round: number) => void;
}

export function RoundTabs({ rounds, activeRound, onChange }: Props) {
  if (rounds.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500 dark:border-slate-700"
        data-testid="round-tabs-empty"
      >
        该候选人暂无面试记录
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="面试轮次"
      className="flex flex-wrap gap-2"
      data-testid="round-tabs"
    >
      {rounds.map((r) => {
        const isActive = r.round === activeRound;
        const tone = scoreTone(r.evaluation?.overall);
        return (
          <button
            key={r.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(r.round)}
            data-testid={`round-tab-${r.id}`}
            className={`flex min-w-[110px] flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition ${
              isActive
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {buildRoundLabel(r.round)}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">
                {interviewTypeLabel(r.type)}
              </span>
            </span>
            <span className="text-[11px] text-slate-500" data-testid={`round-timeline-${r.id}`}>
              {formatRoundTimeline(r)}
            </span>
            {r.evaluation && (
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                <span className={`font-bold ${tone}`}>{r.evaluation.overall}</span>
                <span className="text-slate-500">{roundRecommendation(r.evaluation.recommendation)}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function scoreTone(score: number | undefined): string {
  if (score == null) return 'text-slate-400';
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-brand-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-rose-600';
}