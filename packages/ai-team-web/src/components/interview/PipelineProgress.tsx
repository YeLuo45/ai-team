// V150: PipelineProgress — horizontal timeline showing the candidate's
// current stage in the hiring funnel. Highlights the active stage and
// marks past stages as completed.

import type { CandidateStatus } from '@ai-team/core';
import { Card } from '../design-system';

export type PipelineStage =
  | 'new'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'hired';

export interface PipelineStep {
  key: PipelineStage;
  label: string;
  icon: string;
}

const PIPELINE_STEPS: ReadonlyArray<PipelineStep> = [
  { key: 'new',         label: '新录入', icon: '🆕' },
  { key: 'screening',   label: '筛选中', icon: '🔍' },
  { key: 'interviewing',label: '面试中', icon: '🎯' },
  { key: 'offer',       label: 'Offer',  icon: '📨' },
  { key: 'hired',       label: '已入职', icon: '🎉' },
];

const STATUS_TO_STAGE: Record<CandidateStatus, PipelineStage> = {
  new: 'new',
  screening: 'screening',
  interviewing: 'interviewing',
  offer: 'offer',
  hired: 'hired',
  // 'rejected' is a terminal off-path state — we still map it to a sensible
  // closest stage so the timeline doesn't break, but mark it specially.
  rejected: 'interviewing',
};

export interface PipelineProgressResult {
  currentStage: PipelineStage;
  isOffPath: boolean;
  /** Index in PIPELINE_STEPS (0-based) of the current stage. */
  currentIndex: number;
  /** Total number of stages in the pipeline. */
  totalStages: number;
}

/** Map a Candidate.status string to a pipeline stage + off-path flag. */
export function mapStatusToPipeline(status: string | undefined): PipelineProgressResult {
  const stage = (status && status in STATUS_TO_STAGE
    ? STATUS_TO_STAGE[status as CandidateStatus]
    : 'new') as PipelineStage;
  const isOffPath = status === 'rejected';
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.key === stage);
  return {
    currentStage: stage,
    isOffPath,
    currentIndex: currentIndex >= 0 ? currentIndex : 0,
    totalStages: PIPELINE_STEPS.length,
  };
}

/** Compute the next / previous stage from a given pipeline stage. */
export function nextStage(stage: PipelineStage): PipelineStage | null {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === stage);
  if (idx < 0 || idx >= PIPELINE_STEPS.length - 1) return null;
  return PIPELINE_STEPS[idx + 1].key;
}

export function prevStage(stage: PipelineStage): PipelineStage | null {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === stage);
  if (idx <= 0) return null;
  return PIPELINE_STEPS[idx - 1].key;
}

/** Map a pipeline stage to the CandidateStatus string. */
export function stageToStatus(stage: PipelineStage): CandidateStatus {
  return stage;
}

interface Props {
  status: string | undefined;
  /** Optional callback when the user clicks "上一阶段" / "下一阶段". */
  onAdvance?: (next: CandidateStatus) => void;
  /** Disable the advance buttons (e.g. when the network call is in flight). */
  busy?: boolean;
}

export function PipelineProgress({ status, onAdvance, busy }: Props) {
  const { currentIndex, totalStages, isOffPath, currentStage } = mapStatusToPipeline(status);
  const next = nextStage(currentStage);
  const prev = prevStage(currentStage);

  return (
    <Card
      className="space-y-2"
      testId="pipeline-progress"
    >
      <header className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          招聘流程进度
        </h4>
        <div className="flex items-center gap-2">
          {isOffPath && (
            <span
              className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              data-testid="pipeline-off-path"
            >
              ❌ 已拒绝
            </span>
          )}
          {onAdvance && (
            <>
              <button
                type="button"
                onClick={() => prev && onAdvance(stageToStatus(prev))}
                disabled={busy || prev === null}
                className="rounded-md border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                data-testid="pipeline-prev"
                title={prev ? `上一阶段：${prev}` : '已是第一阶段'}
              >
                ← 上一阶段
              </button>
              <button
                type="button"
                onClick={() => next && onAdvance(stageToStatus(next))}
                disabled={busy || next === null}
                className="rounded-md border border-brand-300 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-700/50 dark:bg-brand-900/30 dark:text-brand-200"
                data-testid="pipeline-next"
                title={next ? `下一阶段：${next}` : '已是最后阶段'}
              >
                下一阶段 →
              </button>
            </>
          )}
        </div>
      </header>

      <ol
        className="flex items-center gap-1"
        aria-label="招聘流程"
        data-testid="pipeline-steps"
      >
        {PIPELINE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const tone = isCurrent
            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
            : isCompleted
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200'
              : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400';
          return (
            <li
              key={step.key}
              className="flex flex-1 items-center gap-1"
              data-testid={`pipeline-step-${step.key}`}
            >
              <div
                className={`flex flex-1 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${tone}`}
                data-current={isCurrent ? 'true' : 'false'}
                data-completed={isCompleted ? 'true' : 'false'}
              >
                <span aria-hidden="true">{step.icon}</span>
                <span className="truncate">{step.label}</span>
                {isCurrent && (
                  <span
                    className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500"
                    aria-hidden="true"
                    data-testid={`pipeline-current-dot-${step.key}`}
                  />
                )}
                {isCompleted && (
                  <span className="ml-auto text-emerald-600" aria-hidden="true">✓</span>
                )}
              </div>
              {idx < totalStages - 1 && (
                <span
                  className={`h-px w-2 shrink-0 ${
                    idx < currentIndex ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}