// V192: LiveSubtitlePanel — React component that wires the V192
// audio source + V185 subtitle accumulator + a stub "transcribe"
// function to surface live captions in the UI.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  SubtitleAccumulator,
  type SubtitleChunk,
  type SrtCue,
  type FlushEvent,
} from '../../lib/subtitle';
import {
  type AudioSource,
  type AudioChunk,
  isSilent,
} from '../../lib/stt/audio-source';

export type TranscribeFn = (
  chunk: AudioChunk,
) => Promise<SubtitleChunk | null>;

export interface LiveSubtitlePanelProps {
  testId?: string;
  audio: AudioSource;
  transcribe: TranscribeFn;
  emitIntervalMs?: number;
  skipSilence?: boolean;
  silenceThreshold?: number;
  title?: string;
}

interface UiState {
  status: 'idle' | 'live' | 'paused' | 'error';
  cues: SrtCue[];
  lastFlushMs: number | null;
  totalChunks: number;
  error: string | null;
}

export function LiveSubtitlePanel({
  testId = 'live-subtitle',
  audio,
  transcribe,
  emitIntervalMs = 1_500,
  skipSilence = true,
  silenceThreshold = 0.01,
  title = 'Live Subtitle',
}: LiveSubtitlePanelProps): ReactElement {
  const [state, setState] = useState<UiState>({
    status: 'idle',
    cues: [],
    lastFlushMs: null,
    totalChunks: 0,
    error: null,
  });
  const accRef = useRef<SubtitleAccumulator>(
    new SubtitleAccumulator({ flushIntervalMs: emitIntervalMs }),
  );

  const audioIdentity = useMemo(() => audio, [audio]);

  useEffect(() => {
    let cancelled = false;
    const acc = accRef.current;
    acc.reset();
    setState((s) => ({
      ...s,
      status: 'live',
      cues: [],
      lastFlushMs: null,
      totalChunks: 0,
      error: null,
    }));

    async function loop() {
      let elapsedMs = 0;
      let nextEmitAt = 0;
      try {
        await audioIdentity.start();
        while (!cancelled) {
          const chunk = await audioIdentity.next();
          if (!chunk) break;
          setState((s) => ({ ...s, totalChunks: s.totalChunks + 1 }));
          if (skipSilence && isSilent(chunk, silenceThreshold)) {
            continue;
          }
          elapsedMs += (chunk.samples.length / chunk.sampleRate) * 1_000;
          if (elapsedMs < nextEmitAt) continue;
          nextEmitAt = elapsedMs + emitIntervalMs;
          const parsed = await transcribe(chunk);
          if (!parsed) continue;
          const sub: SubtitleChunk = {
            startMs: elapsedMs - (chunk.samples.length / chunk.sampleRate) * 1_000,
            endMs: elapsedMs,
            text: parsed.text,
            speaker: parsed.speaker,
          };
          const evt: FlushEvent = acc.push(sub);
          if (!cancelled) {
            setState((s) => ({
              ...s,
              cues: evt.cues.slice(),
              lastFlushMs: evt.flushThroughMs,
            }));
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          }));
        }
      } finally {
        if (!cancelled) {
          await audioIdentity.stop().catch(() => undefined);
          setState((s) => ({ ...s, status: 'paused' }));
        }
      }
    }
    void loop();

    return () => {
      cancelled = true;
      void audioIdentity.stop().catch(() => undefined);
    };
  }, [audioIdentity, transcribe, emitIntervalMs, skipSilence, silenceThreshold]);

  const lastCue = state.cues.length > 0 ? state.cues[state.cues.length - 1] : null;

  return (
    <div
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2"
      data-testid={testId}
      data-status={state.status}
      data-cue-count={state.cues.length}
    >
      <header className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        <span
          className="font-mono text-slate-500"
          data-testid={`${testId}-status`}
          data-status-label={state.status}
        >
          {state.status} · {state.totalChunks} chunks
        </span>
      </header>
      {state.error ? (
        <div
          className="rounded bg-rose-100 dark:bg-rose-900/40 px-2 py-1 text-rose-700 dark:text-rose-200 text-xs"
          data-testid={`${testId}-error`}
        >
          {state.error}
        </div>
      ) : null}
      <div
        className="min-h-[3rem] rounded bg-slate-50 dark:bg-slate-800/60 px-2 py-1 text-sm text-slate-800 dark:text-slate-100"
        data-testid={`${testId}-caption`}
        data-last-cue={lastCue?.text ?? ''}
      >
        {lastCue ? (
          <span>{lastCue.text}</span>
        ) : (
          <span className="italic text-slate-400">Waiting for captions…</span>
        )}
      </div>
      <details className="text-[11px] text-slate-500">
        <summary>Cue log ({state.cues.length})</summary>
        <ol className="space-y-0.5 max-h-32 overflow-y-auto pr-2">
          {state.cues.slice(-20).map((c) => (
            <li key={c.index}>
              <span className="font-mono">[{c.index}]</span>{' '}
              {c.startMs}–{c.endMs}ms: <span>{c.text}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
