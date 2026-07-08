// V172: SpeakerDiarizationView — paints a colour-coded timeline of
// speaker turns produced by `buildSpeakerTimeline()`. Drop-in companion
// to `RealtimeQuestionSuggester` / `SttSettings`.
//
// Layout:
//   - One header line with the dominant speaker + total span.
//   - A horizontal bar split per-speaker, widths proportional to total
//     talk time, colour-coded:
//       interviewer = blue
//       candidate   = emerald
//       unknown     = slate
//   - A legend (chips) below with per-speaker counts.
//   - A scrollable list of turns with `MM:SS start–MM:SS end` ranges.

import { useMemo } from 'react';
import { Card } from '../design-system';
import {
  buildSpeakerTimeline,
  countSpeakers,
  dominantSpeaker,
  formatMmSs,
  totalSpanMs,
  type SpeakerLabel,
  type SpeakerTurn,
} from '../../lib/stt/speaker-timeline';
import type { SttTranscriptChunk } from '../../lib/stt/types';

interface Props {
  chunks: ReadonlyArray<SttTranscriptChunk>;
  /** Optional limit on the number of rendered turns (defaults to 50). */
  limit?: number;
  /** Optional title. */
  title?: string;
  /** Test id root. */
  testId?: string;
}

const SPEAKER_LABEL: Record<SpeakerLabel, string> = {
  interviewer: '👔 面试官',
  candidate: '🧑 候选人',
  unknown: '❓ 未知',
};

const SPEAKER_BAR_CLASS: Record<SpeakerLabel, string> = {
  interviewer: 'bg-blue-500',
  candidate: 'bg-emerald-500',
  unknown: 'bg-slate-400',
};

const SPEAKER_CHIP_CLASS: Record<SpeakerLabel, string> = {
  interviewer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  candidate: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  unknown: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

export function SpeakerDiarizationView({
  chunks,
  limit = 50,
  title = '🎙 扬声器日记',
  testId = 'sd',
}: Props) {
  const turns = useMemo(() => buildSpeakerTimeline(chunks), [chunks]);
  const stats = useMemo(() => countSpeakers(turns), [turns]);
  const totalMs = useMemo(() => totalSpanMs(turns), [turns]);
  const dominant = useMemo(() => dominantSpeaker(turns), [turns]);

  if (turns.length === 0) {
    return (
      <Card className="text-xs text-slate-400" testId={`${testId}-empty`}>
        暂无扬声器日记 — 开始 STT 后这里会按 <code>candidate</code> / <code>interviewer</code> 分类显示
      </Card>
    );
  }

  // Clip turns to limit so very long sessions don't blow up the DOM.
  const visible = turns.slice(0, limit);

  return (
    <Card className="space-y-3" testId={`${testId}-content`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4
          className="text-sm font-semibold text-slate-700 dark:text-slate-200"
          data-testid={`${testId}-title`}
        >
          {title}
        </h4>
        <div
          className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"
          data-testid={`${testId}-summary`}
        >
          <span data-testid={`${testId}-turns`}>
            {turns.length} 段对话
          </span>
          <span data-testid={`${testId}-span`}>
            总时长 {formatMmSs(totalMs)}
          </span>
          {dominant ? (
            <span
              data-testid={`${testId}-dominant`}
              className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              主说话人 {SPEAKER_LABEL[dominant]}
            </span>
          ) : null}
        </div>
      </header>

      {/* Horizontal proportion bar */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
        data-testid={`${testId}-bar`}
        role="img"
        aria-label="speaker proportion bar"
      >
        {stats.map((s) => {
          const pct = totalMs === 0 ? 0 : (s.totalMs / totalMs) * 100;
          return (
            <div
              key={s.speaker}
              className={SPEAKER_BAR_CLASS[s.speaker]}
              style={{ width: `${pct}%` }}
              title={`${SPEAKER_LABEL[s.speaker]} ${pct.toFixed(1)}%`}
              data-testid={`${testId}-bar-${s.speaker}`}
              data-pct={pct.toFixed(1)}
            />
          );
        })}
      </div>

      {/* Speaker legend chips */}
      <div
        className="flex flex-wrap gap-2 text-[11px]"
        data-testid={`${testId}-legend`}
      >
        {stats.map((s) => (
          <div
            key={s.speaker}
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 ${SPEAKER_CHIP_CLASS[s.speaker]}`}
            data-testid={`${testId}-chip-${s.speaker}`}
          >
            <span className="font-semibold">{SPEAKER_LABEL[s.speaker]}</span>
            <span>{s.turns} 段</span>
            <span>· {s.chunks} chunks</span>
            <span>· {formatMmSs(s.totalMs)}</span>
          </div>
        ))}
      </div>

      {/* Turn list */}
      <ul
        className="max-h-60 space-y-1 overflow-y-auto text-[11px]"
        data-testid={`${testId}-list`}
      >
        {visible.map((t: SpeakerTurn, i: number) => (
          <li
            key={`${t.startMs}-${i}`}
            className={`flex items-start gap-2 rounded-md border px-2 py-1 ${
              t.speaker === 'interviewer'
                ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20'
                : t.speaker === 'candidate'
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
            }`}
            data-testid={`${testId}-turn`}
            data-speaker={t.speaker}
          >
            <span
              className={`mt-0.5 inline-flex w-20 flex-shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                t.speaker === 'interviewer'
                  ? 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100'
                  : t.speaker === 'candidate'
                  ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
              data-testid={`${testId}-turn-speaker`}
            >
              {SPEAKER_LABEL[t.speaker]}
            </span>
            <span
              className="mt-0.5 font-mono text-[10px] text-slate-500"
              data-testid={`${testId}-turn-time`}
            >
              {formatMmSs(t.startMs)}–{formatMmSs(t.endMs)}
            </span>
            <span
              className="flex-1 break-words text-slate-700 dark:text-slate-200"
              data-testid={`${testId}-turn-text`}
            >
              {t.text}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
