// V143: CandidateInterviewPanel — full interview detail surface for one
// candidate: resume (top), round tabs (multi-round switching), and the
// selected round's evaluation + turns.
// V146: optional breadcrumb-style nav (back / prev / next) for cross-candidate browsing.

import { useMemo, useState } from 'react';
import type { Candidate, Interview } from '@ai-team/core';
import { Card } from '../design-system';
import { recommendationLabel, formatDateTime } from '../../lib/format';
import { ResumeCard } from './ResumeCard';
import { RoundTabs, type InterviewRound } from './RoundTabs';
import { RoundsComparison } from './RoundsComparison';
import { PipelineProgress } from './PipelineProgress';
import { RejectHistoryList } from './RejectHistoryList';
import { SttSettings } from './SttSettings';
import { RealtimeQuestionSuggester } from './RealtimeQuestionSuggester';
import { QuestionSuggestionHistory } from './QuestionSuggestionHistory';
import {
  appendAdopted,
  buildAdoption,
  readHistory,
  writeHistory,
  type AdoptedSuggestion,
} from '../../lib/question-suggestion/history';
import {
  readCache as readSuggestionCache,
  writeCache as writeSuggestionCache,
  recallCandidate,
  remember as rememberSuggestion,
} from '../../lib/question-suggestion/cache';
import type { QuestionSuggestion } from '../../lib/question-suggestion/types';
import type { SttTranscriptChunk } from '../../lib/stt/types';
import {
  buildRoundLabel,
  formatRoundTimeline,
  interviewTypeLabel,
} from '../../lib/interview-helpers';

export interface CandidateNavContext {
  hasPrev: boolean;
  hasNext: boolean;
  prevCandidateName?: string;
  nextCandidateName?: string;
  currentIndex: number; // 1-based
  total: number;
}

export interface PipelineAdvanceHandler {
  /** Advance the candidate to the chosen status. */
  onAdvance: (nextStatus: string) => void;
  /** Whether an in-flight advance call is pending. */
  busy: boolean;
  /** V153: open the reject-reason modal. Only used when current status is 'rejected'. */
  onRecordReject?: () => void;
  /** V154: restore a rejected candidate back to 'interviewing'. */
  onRestore?: (nextStatus: string) => void;
}

interface Props {
  candidate: Candidate | null;
  candidateId: string;
  rounds: ReadonlyArray<InterviewRound>;
  nav?: CandidateNavContext;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** V152: optional pipeline-advance callback for the PipelineProgress. */
  pipeline?: PipelineAdvanceHandler;
}

export function CandidateInterviewPanel({ candidate, candidateId, rounds, nav, onBack, onPrev, onNext, pipeline }: Props) {
  const initialRound = rounds.length > 0 ? rounds[0].round : 1;
  const [activeRound, setActiveRound] = useState<number>(initialRound);
  const [transcript, setTranscript] = useState<SttTranscriptChunk[]>([]);
  // V165: bump to force the history panel to re-read localStorage on adopt.
  // V166: mirror the same array into RealtimeQuestionSuggester for j/k cycling.
  const [historyVersion, setHistoryVersion] = useState(0);
  const [adoptionEntries, setAdoptionEntries] = useState<ReadonlyArray<AdoptedSuggestion>>(() => {
    if (typeof window === 'undefined') return [];
    return readHistory(window.localStorage).entries;
  });
  // V167: cross-session suggestion cache — restore the previous suggestion for
  // this candidate on mount, and persist every freshly generated one.
  const [cachedSuggestion, setCachedSuggestion] = useState<QuestionSuggestion | null>(() => {
    if (typeof window === 'undefined') return null;
    return recallCandidate(readSuggestionCache(window.localStorage), candidateId);
  });
  // Add a setter adapter that wraps the readonly array from onBufferChange
  const updateTranscript = (next: ReadonlyArray<SttTranscriptChunk>) => {
    setTranscript([...next]);
  };

  const selected = useMemo<InterviewRound | null>(() => {
    if (rounds.length === 0) return null;
    return rounds.find((r) => r.round === activeRound) ?? rounds[0];
  }, [rounds, activeRound]);

  const showNavToolbar = nav !== undefined && (onBack !== undefined || onPrev !== undefined || onNext !== undefined);

  if (rounds.length === 0) {
    return (
      <div className="space-y-4" data-testid="candidate-panel-empty">
        {showNavToolbar && <NavToolbar nav={nav!} onBack={onBack} onPrev={onPrev} onNext={onNext} />}
        {pipeline && (
          <PipelineProgress
            status={candidate?.status}
            onAdvance={pipeline.onAdvance}
            busy={pipeline.busy}
            onRecordReject={pipeline.onRecordReject}
            onRestore={pipeline.onRestore}
            stageEnteredAt={candidate?.updatedAt}
          />
        )}
        {candidate?.status === 'rejected' && (
          <RejectHistoryList notes={candidate.notes} />
        )}
        <SttSettings onBufferChange={updateTranscript} />
        <RealtimeQuestionSuggester
          sessionId={candidateId}
          position={candidate?.position ?? candidateId}
          candidateName={candidate?.name ?? candidateId}
          transcript={transcript}
          adoptionHistory={adoptionEntries}
          initialSuggestion={cachedSuggestion}
          onSuggestionGenerated={(s) => {
            if (typeof window === 'undefined') return;
            const prev = readSuggestionCache(window.localStorage);
            const next = rememberSuggestion(prev, {
              candidateId,
              position: candidate?.position ?? candidateId,
              suggestion: s,
            });
            writeSuggestionCache(window.localStorage, next);
            setCachedSuggestion(s);
          }}
          onAdopt={(s) => {
            if (typeof window === 'undefined') return;
            const store = window.localStorage;
            const prev = readHistory(store);
            const next = appendAdopted(
              prev,
              buildAdoption({
                suggestion: s,
                sessionId: candidateId,
                candidateName: candidate?.name ?? candidateId,
                position: candidate?.position ?? candidateId,
              }),
            );
            writeHistory(store, next);
            setAdoptionEntries(next.entries);
            setHistoryVersion((n) => n + 1);
          }}
        />
        <QuestionSuggestionHistory key={historyVersion} />
        <ResumeCard
          candidateId={candidateId}
          candidateName={candidate?.name ?? candidateId}
          candidatePosition={candidate?.position ?? ''}
          candidateEmail={candidate?.email}
          candidatePhone={candidate?.phone}
          candidateTags={candidate?.tags ?? []}
          candidateSkills={(candidate?.skills ?? []).map((s) => ({ skillId: s.skillId, score: s.score }))}
          resume={candidate?.resume}
        />
        <Card className="text-center text-sm text-slate-500">
          该候选人暂未开始面试。在候选人页点击 &quot;🤖 开始面试&quot; 启动一面。
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="candidate-panel">
      {showNavToolbar && <NavToolbar nav={nav!} onBack={onBack} onPrev={onPrev} onNext={onNext} />}
      {pipeline && (
        <PipelineProgress
          status={candidate?.status}
          onAdvance={pipeline.onAdvance}
          busy={pipeline.busy}
        />
      )}
      <ResumeCard
        candidateId={candidateId}
        candidateName={candidate?.name ?? candidateId}
        candidatePosition={candidate?.position ?? ''}
        candidateEmail={candidate?.email}
        candidatePhone={candidate?.phone}
        candidateTags={candidate?.tags ?? []}
        candidateSkills={(candidate?.skills ?? []).map((s) => ({ skillId: s.skillId, score: s.score }))}
        resume={candidate?.resume}
      />

      <section className="space-y-3" data-testid="candidate-rounds">
        <header className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            面试轮次 ({rounds.length})
          </h4>
          <span className="text-xs text-slate-500">点击 tab 切换查看详情</span>
        </header>
        <RoundTabs rounds={rounds} activeRound={activeRound} onChange={setActiveRound} />
      </section>

      <RoundsComparison rounds={rounds} />

      {selected && <RoundDetail round={selected} />}
    </div>
  );
}

function NavToolbar({
  nav,
  onBack,
  onPrev,
  onNext,
}: {
  nav: CandidateNavContext;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <nav
      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50"
      aria-label="候选人导航"
      data-testid="candidate-nav-toolbar"
    >
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-600 hover:underline dark:text-slate-300"
            data-testid="candidate-nav-back"
          >
            ← 返回候选人列表
          </button>
        )}
      </div>
      <span className="text-xs text-slate-500" data-testid="candidate-nav-position">
        {nav.currentIndex} / {nav.total}
      </span>
      <div className="flex items-center gap-2">
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            disabled={!nav.hasPrev}
            className="text-xs text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            title={nav.prevCandidateName ? `上一位：${nav.prevCandidateName}` : '已是第一位候选人'}
            data-testid="candidate-nav-prev"
          >
            ← 上一个
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={!nav.hasNext}
            className="text-xs text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            title={nav.nextCandidateName ? `下一位：${nav.nextCandidateName}` : '已是最后一位候选人'}
            data-testid="candidate-nav-next"
          >
            下一个 →
          </button>
        )}
      </div>
    </nav>
  );
}

function RoundDetail({ round }: { round: InterviewRound }) {
  const rec = recommendationLabel(round.evaluation?.recommendation);
  const evalSummary = round.evaluation?.summary;
  return (
    <Card className="space-y-5" testId={`round-detail-${round.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">
            {buildRoundLabel(round.round)} · {interviewTypeLabel(round.type)}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
            {round.id}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            岗位 {round.position}
            {round.startedAt && <> · 开始 {formatDateTime(round.startedAt)}</>}
            {round.completedAt && <> · 完成 {formatDateTime(round.completedAt)}</>}
          </p>
          <p className="mt-1 text-xs text-slate-500" data-testid={`round-timeline-summary-${round.id}`}>
            {formatRoundTimeline(round)}
          </p>
        </div>
        {round.evaluation && (
          <span className={`shrink-0 ${rec.cls}`} data-testid={`round-rec-${round.id}`}>
            {rec.text}
          </span>
        )}
      </div>

      {round.evaluation ? (
        <div
          className="rounded-lg bg-gradient-to-br from-brand-50 to-violet-50 p-5 dark:from-brand-900/20 dark:to-violet-900/20"
          data-testid={`round-evaluation-${round.id}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">总评分</div>
              <div className="text-4xl font-bold text-brand-600">
                {round.evaluation.overall}
                <span className="text-base text-slate-400">/100</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreBar label="技术" value={round.evaluation.breakdown.technical} />
            <ScoreBar label="沟通" value={round.evaluation.breakdown.communication} />
            <ScoreBar label="解决问题" value={round.evaluation.breakdown.problemSolving} />
            <ScoreBar label="文化契合" value={round.evaluation.breakdown.culture} />
          </div>
          {evalSummary && (
            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{evalSummary}</p>
          )}
          {round.evaluation.strengths.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-emerald-600">优势</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {round.evaluation.strengths.map((s, i) => (
                  <li key={i}>· {s}</li>
                ))}
              </ul>
            </div>
          )}
          {round.evaluation.concerns.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-rose-600">顾虑</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {round.evaluation.concerns.map((s, i) => (
                  <li key={i}>· {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
          暂无评估结果
        </div>
      )}

      <div>
        <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          对话记录 ({round.turns.length} 轮)
        </h4>
        {round.turns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
            该轮次暂无对话记录
          </div>
        ) : (
          <div className="space-y-2">
            {round.turns.map((t, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 text-sm ${
                  t.role === 'interviewer'
                    ? 'bg-brand-50 dark:bg-brand-900/20'
                    : 'bg-slate-50 dark:bg-slate-800/50'
                }`}
              >
                <div className="mb-1 text-xs font-medium text-slate-500">
                  {t.role === 'interviewer' ? '🤖 面试官' : '👤 候选人'} · {formatDateTime(t.timestamp)}
                </div>
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{t.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-brand-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{pct}</div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Re-export so consumers can pick up Interview type if needed.
export type { Interview };