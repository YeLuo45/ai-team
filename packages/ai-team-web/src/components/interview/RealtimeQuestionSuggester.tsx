// V164: RealtimeQuestionSuggester — wraps a QuestionSuggestionAgent and
// surfaces its output as an "adopt / regenerate" panel.
//
// Trigger model:
//   * manual — user clicks 🔄 重新生成
//   * content-shift — whenever the underlying transcript content diverges
//     from the last trigger point (simple substring heuristic)
//   * time-based — a built-in throttle fires N seconds after the last call
//
// The Orchestrator (QuestionSuggestionAgent) is the source of truth for the
// suggestion text. This component only owns presentation + throttling +
// adoption (clipboard).

import { useEffect, useRef, useState } from 'react';
import { Card } from '../design-system';
import type {
  EvaluationSummary,
  PreviousQuestion,
  QuestionSuggestion,
  QuestionSuggestionAgent,
  TranscriptChunkInput,
} from '../../lib/question-suggestion/types';
import type { SttTranscriptChunk } from '../../lib/stt/types';

interface Props {
  /** Optional injected agent — defaults to the built-in mock. */
  agent?: QuestionSuggestionAgent;
  /** The session id (used by some agents for state correlation). */
  sessionId: string;
  position: string;
  candidateName: string;
  /** Stream from the STT provider — passed in via onBufferChange. */
  transcript: ReadonlyArray<SttTranscriptChunk>;
  /** History of previous questions — defaults to empty. */
  previousQuestions?: ReadonlyArray<PreviousQuestion>;
  /** History of evaluation summaries — defaults to empty. */
  evaluationHistory?: ReadonlyArray<EvaluationSummary>;
  /** Throttle floor for time-based triggers, ms. Default 30s. */
  timeBasedIntervalMs?: number;
}

const FOCUS_LABEL: Record<NonNullable<QuestionSuggestion['focusTag']>, string> = {
  technical: '技术',
  communication: '沟通',
  problemSolving: '问题解决',
  culture: '文化契合',
};

export function RealtimeQuestionSuggester({
  agent,
  sessionId,
  position,
  candidateName,
  transcript,
  previousQuestions,
  evaluationHistory,
  timeBasedIntervalMs = 30_000,
}: Props) {
  const [suggestion, setSuggestion] = useState<QuestionSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastTrigger, setLastTrigger] = useState<'manual' | 'content-shift' | 'time-based' | 'init'>('init');
  const [adopted, setAdopted] = useState(false);
  const lastContentHash = useRef<string>('');
  const lastRunAt = useRef<number>(0);

  // Internal — invoke the agent with the current state
  const trigger = async (kind: 'manual' | 'content-shift' | 'time-based') => {
    if (busy) return;
    setBusy(true);
    setLastTrigger(kind);
    try {
      const input = await buildInput({
        sessionId, position, candidateName, transcript, previousQuestions, evaluationHistory, kind,
      });
      const out = await (agent ?? defaultMockAgent()).suggest(input);
      setSuggestion(out);
      lastRunAt.current = Date.now();
      lastContentHash.current = shortHashFromTranscript(transcript);
      setAdopted(false);
    } finally {
      setBusy(false);
    }
  };

  // Run once on mount — the agent decides what to do with empty input
  // (e.g. suggest a baseline "tell me about yourself" question). Skipping
  // the call here would leave the panel in a permanent empty state when
  // the user hasn't started the STT session yet.
  useEffect(() => {
    void trigger('time-based');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Content-shift trigger: fire whenever the new transcript content diverges
  // from the hash captured at the last run.
  useEffect(() => {
    const h = shortHashFromTranscript(transcript);
    if (lastContentHash.current && h !== lastContentHash.current) {
      void trigger('content-shift');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  // Time-based throttle: re-trigger every `timeBasedIntervalMs`, only when
  // there is transcript content and the agent isn't already running.
  useEffect(() => {
    if (!transcript.length) return;
    const id = setInterval(() => {
      if (busy) return;
      if (Date.now() - lastRunAt.current >= timeBasedIntervalMs) {
        void trigger('time-based');
      }
    }, timeBasedIntervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, transcript.length, timeBasedIntervalMs]);

  const adopt = async () => {
    if (!suggestion) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(suggestion.question);
      }
    } catch {
      // ignore — UI will still flip the adopted flag so the user knows it was attempted
    }
    setAdopted(true);
  };

  return (
    <Card className="space-y-3" testId="realtime-question-suggester">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">🧠 实时面试题建议</h4>
        <TriggerBadge
          busy={busy}
          lastTrigger={lastTrigger}
          transcriptCount={transcript.length}
        />
      </header>

      {suggestion ? (
        <div className="space-y-2" data-testid="rqs-content">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50" data-testid="rqs-question">
            {suggestion.question}
          </p>
          <p className="text-xs text-slate-500" data-testid="rqs-rationale">
            <span className="mr-1">💡</span>
            {suggestion.rationale}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestion.focusTag && (
              <span
                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                data-testid="rqs-focus-tag"
              >
                {FOCUS_LABEL[suggestion.focusTag]}
              </span>
            )}
            <span
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              data-testid="rqs-difficulty"
            >
              {suggestion.difficulty}
            </span>
            {suggestion.followUpHints && suggestion.followUpHints.length > 0 && (
              <span className="text-[11px] text-slate-500" data-testid="rqs-hint-count">
                + {suggestion.followUpHints.length} 跟问线索
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={adopt}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              data-testid="rqs-adopt"
            >
              {adopted ? '✅ 已采纳' : '✅ 采纳'}
            </button>
            <button
              type="button"
              onClick={() => trigger('manual')}
              disabled={busy}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200"
              data-testid="rqs-regenerate"
            >
              🔄 重新生成
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400" data-testid="rqs-empty">
          {busy ? '⏳ 分析中…' : '等待 transcript 输入…'}
        </p>
      )}
    </Card>
  );
}

// ---------------- helpers ----------------

function TriggerBadge({
  busy,
  lastTrigger,
  transcriptCount,
}: {
  busy: boolean;
  lastTrigger: 'manual' | 'content-shift' | 'time-based' | 'init';
  transcriptCount: number;
}) {
  const label =
    lastTrigger === 'manual' ? '📝 手动'
    : lastTrigger === 'content-shift' ? '⚡ 实时'
    : lastTrigger === 'time-based' ? '⏱ 定时'
    : '初始化';
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500" data-testid="rqs-trigger">
      <span
        className={`rounded-full px-2 py-0.5 font-medium ${
          busy
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`}
        data-testid="rqs-trigger-state"
      >
        {busy ? '⏳ 分析中' : label}
      </span>
      <span data-testid="rqs-transcript-count">{transcriptCount} 段对话</span>
    </div>
  );
}

async function buildInput(args: {
  sessionId: string;
  position: string;
  candidateName: string;
  transcript: ReadonlyArray<SttTranscriptChunk>;
  previousQuestions?: ReadonlyArray<PreviousQuestion>;
  evaluationHistory?: ReadonlyArray<EvaluationSummary>;
  kind: 'manual' | 'content-shift' | 'time-based';
}) {
  const ti: TranscriptChunkInput[] = args.transcript.map((c) => ({
    text: c.text,
    speaker: c.speaker ?? 'unknown',
    timestamp: c.timestamp ?? Date.now(),
  }));
  return {
    sessionId: args.sessionId,
    position: args.position,
    candidateName: args.candidateName,
    previousQuestions: args.previousQuestions ?? [],
    recentTranscript: ti,
    evaluationHistory: args.evaluationHistory ?? [],
    trigger: buildTrigger(args.kind),
  };
}

function buildTrigger(kind: 'manual' | 'content-shift' | 'time-based'): { kind: 'manual' } | { kind: 'content-shift' } | { kind: 'time-based'; elapsedMs: number } {
  if (kind === 'time-based') return { kind: 'time-based', elapsedMs: 30_000 };
  if (kind === 'manual') return { kind: 'manual' };
  return { kind: 'content-shift' };
}

function shortHashFromTranscript(transcript: ReadonlyArray<{ text: string }>): string {
  return transcript.slice(-12).map((c) => c.text).join(' ');
}

import { MockQuestionSuggestionAgent } from '../../lib/question-suggestion/mock-question-suggestion-agent';
let _defaultAgent: MockQuestionSuggestionAgent | null = null;
function defaultMockAgent() {
  if (!_defaultAgent) _defaultAgent = new MockQuestionSuggestionAgent();
  return _defaultAgent;
}
