// V143: ResumeCard — display a candidate's parsed resume inside the
// interview detail panel. Renders a compact summary header (preview +
// counters) and an expandable full-text view split by sections.

import { useState } from 'react';
import { Card, Badge } from '../design-system';
import { GlassCard } from '../glass/GlassCard';
import { summarizeResume, shouldCollapseResume } from '../../lib/interview-helpers';

interface Props {
  resume?: string;
  candidateName: string;
  candidatePosition: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateTags: ReadonlyArray<string>;
  candidateSkills: ReadonlyArray<{ skillId: string; score: number }>;
}

export function ResumeCard({
  resume,
  candidateName,
  candidatePosition,
  candidateEmail,
  candidatePhone,
  candidateTags,
  candidateSkills,
}: Props) {
  const summary = summarizeResume(resume);
  const [expanded, setExpanded] = useState(false);
  const collapsible = shouldCollapseResume(summary);

  return (
    <GlassCard className="space-y-4" testId="resume-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            候选人简历
          </div>
          <h4 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
            {candidateName}
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            {candidatePosition}
            {candidateEmail && (
              <>
                {' · '}
                <a href={`mailto:${candidateEmail}`} className="underline-offset-2 hover:underline">
                  {candidateEmail}
                </a>
              </>
            )}
            {candidatePhone && <> · {candidatePhone}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {candidateTags.slice(0, 4).map((tag) => (
            <Badge key={tag} tone="info">
              {tag}
            </Badge>
          ))}
        </div>
      </header>

      {candidateSkills.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500">技能</div>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="resume-skills">
            {candidateSkills.slice(0, 12).map((s) => (
              <span
                key={s.skillId}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {s.skillId} · {s.score}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.totalChars === 0 ? (
        <Card className="text-center text-sm text-slate-500" testId="resume-empty">
          <p>该候选人暂未上传简历原文。</p>
          <p className="mt-1 text-xs text-slate-400">
            在候选人页点击 &quot;📄 上传简历&quot; 录入后将自动显示在此处。
          </p>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="resume-body">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
            <p className="whitespace-pre-wrap" data-testid="resume-preview">
              {summary.preview}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span data-testid="resume-stats">
                {summary.totalChars} 字 · {summary.bulletCount} 项 · {summary.lineCount} 行
                {summary.sections.length > 1 && ` · ${summary.sections.length} 段`}
              </span>
              {collapsible && (
                <button
                  type="button"
                  className="text-brand-600 hover:underline"
                  onClick={() => setExpanded((v) => !v)}
                  data-testid="resume-toggle"
                >
                  {expanded ? '收起' : '查看完整简历'}
                </button>
              )}
            </div>
          </div>

          {expanded && (
            <div className="space-y-3" data-testid="resume-full">
              {summary.sections.map((section, i) => (
                <article
                  key={`${section.heading}-${i}`}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <h5 className="mb-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {section.heading}
                  </h5>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {section.body}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}