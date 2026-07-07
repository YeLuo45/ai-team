// V170: SuggestionDiffView — side-by-side / inline diff of an adopted
// (baseline) suggestion against the current (live) one. Highlights
// word-level insertions / deletions in the question + rationale text,
// plus a compact row for focusTag / difficulty changes.
//
// Drop-in: pass `baseline` (from QuestionSuggestionHistory or cache)
// and `current` (latest agent result). Both optional. Renders an empty
// state when neither is supplied. Renders a "no differences" badge
// when the two suggestions are structurally identical.
//
// Pure render component. The diff math lives in
// lib/question-suggestion/diff.ts so it can be unit-tested in isolation.

import { useMemo } from 'react';
import { Card } from '../design-system';
import {
  diffSuggestions,
  hasDiff,
  similarity,
} from '../../lib/question-suggestion/diff';
import type { DiffSegment } from '../../lib/question-suggestion/diff';
import type { QuestionSuggestion } from '../../lib/question-suggestion/types';

interface Props {
  baseline?: QuestionSuggestion | null;
  current?: QuestionSuggestion | null;
  /** Optional title shown above the diff. Defaults to "📊 建议对比". */
  title?: string;
  /** Optional id for testing. */
  testId?: string;
}

const FOCUS_LABEL: Record<NonNullable<QuestionSuggestion['focusTag']>, string> = {
  technical: '技术',
  communication: '沟通',
  problemSolving: '问题解决',
  culture: '文化契合',
};

export function SuggestionDiffView({
  baseline,
  current,
  title = '📊 建议对比',
  testId = 'sdv',
}: Props) {
  const diff = useMemo(() => diffSuggestions(baseline, current), [baseline, current]);

  if (!baseline && !current) {
    return (
      <Card className="text-xs text-slate-400" testId={`${testId}-empty`}>
        暂无对比数据 — 选择一个历史建议即可看到与最新生成建议的差异
      </Card>
    );
  }

  if (baseline && current && !hasDiff(diff)) {
    return (
      <Card className="space-y-1" testId={`${testId}-identical`}>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
        <p className="text-xs text-emerald-600 dark:text-emerald-300" data-testid={`${testId}-identical-badge`}>
          ✅ 当前建议与历史采纳版本完全一致
        </p>
      </Card>
    );
  }

  const simPct = Math.round(similarity(diff) * 100);

  return (
    <Card className="space-y-3" testId={`${testId}-content`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
          data-testid={`${testId}-title`}
        >
          {title}
        </h4>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span
            className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            data-testid={`${testId}-similarity`}
          >
            相似度 {simPct}%
          </span>
          <span data-testid={`${testId}-stats`}>
            <span className="font-semibold text-emerald-600 dark:text-emerald-300">
              +{diff.addedWords}
            </span>
            {' / '}
            <span className="font-semibold text-rose-600 dark:text-rose-300">
              −{diff.removedWords}
            </span>
          </span>
        </div>
      </header>

      {/* Question diff */}
      <section className="space-y-1" data-testid={`${testId}-question-section`}>
        <h5 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">题目</h5>
        <p
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-800/40"
          data-testid={`${testId}-question`}
        >
          {diff.questionDiff.length === 0 ? (
            <span className="text-slate-400">（无题目文本可对比）</span>
          ) : (
            diff.questionDiff.map((seg, i) => <SegmentView key={i} seg={seg} />)
          )}
        </p>
      </section>

      {/* Rationale diff */}
      <section className="space-y-1" data-testid={`${testId}-rationale-section`}>
        <h5 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">出题理由</h5>
        <p
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-800/40"
          data-testid={`${testId}-rationale`}
        >
          {diff.rationaleDiff.length === 0 ? (
            <span className="text-slate-400">（无理由文本可对比）</span>
          ) : (
            diff.rationaleDiff.map((seg, i) => <SegmentView key={i} seg={seg} />)
          )}
        </p>
      </section>

      {/* Field changes */}
      <section
        className="grid grid-cols-2 gap-2 text-[11px]"
        data-testid={`${testId}-fields`}
      >
        <FieldCompare
          label="Focus"
          baseline={baseline ? baseline.focusTag : undefined}
          current={current ? current.focusTag : undefined}
          changed={diff.focusTagChanged}
          format={(v) => {
            if (!v) return '—';
            return FOCUS_LABEL[v as keyof typeof FOCUS_LABEL] ?? v;
          }}
          testId={`${testId}-focus`}
        />
        <FieldCompare
          label="难度"
          baseline={baseline ? baseline.difficulty : undefined}
          current={current ? current.difficulty : undefined}
          changed={diff.difficultyChanged}
          format={(v) => v ?? '—'}
          testId={`${testId}-difficulty`}
        />
      </section>
    </Card>
  );
}

function SegmentView({ seg }: { seg: DiffSegment }) {
  if (seg.op === 'equal') {
    return <span>{seg.value}</span>;
  }
  if (seg.op === 'insert') {
    return (
      <span
        className="rounded-sm bg-emerald-100 px-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        data-diff-op="insert"
      >
        {seg.value}
      </span>
    );
  }
  return (
    <span
      className="rounded-sm bg-rose-100 px-0.5 text-rose-800 line-through dark:bg-rose-900/40 dark:text-rose-200"
      data-diff-op="delete"
    >
      {seg.value}
    </span>
  );
}

interface FieldCompareProps {
  label: string;
  baseline: string | undefined;
  current: string | undefined;
  changed: boolean;
  format: (v: string | undefined) => string;
  testId: string;
}

function FieldCompare({ label, baseline, current, changed, format, testId }: FieldCompareProps) {
  return (
    <div
      className={`rounded-md border px-2 py-1 ${
        changed
          ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
      }`}
      data-testid={testId}
      data-changed={changed ? 'true' : 'false'}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-1 text-[11px]">
        <span className={changed ? 'text-rose-500 line-through' : 'text-slate-400'}>
          {format(baseline)}
        </span>
        <span className="text-slate-400">→</span>
        <span
          className={
            changed
              ? 'font-medium text-emerald-700 dark:text-emerald-300'
              : 'text-slate-700 dark:text-slate-200'
          }
        >
          {format(current)}
        </span>
      </div>
    </div>
  );
}
