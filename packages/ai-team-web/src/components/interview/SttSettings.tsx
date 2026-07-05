// V161: SttSettings — provider selector + start/stop + live state badge.
//
// The component owns:
//   - the selected provider (default = most-preferred supported)
//   - the live transcripts (so it can render them inline as the user gets them)
//   - a fixed-window buffer so memory is bounded in long sessions

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listSttProviderOptions,
  listSttProviders,
  getDefaultSttProviderId,
  getSttProvider,
} from '../../lib/stt/registry';
import type {
  SttProvider,
  SttSession,
  SttState,
  SttTranscriptChunk,
} from '../../lib/stt/types';
import { Card } from '../design-system';

const TRANSCRIPT_WINDOW = 200; // keep the latest N chunks in memory
const SPEAKER_LABEL: Record<NonNullable<SttTranscriptChunk['speaker']>, string> = {
  candidate: '候选人',
  interviewer: '面试官',
  unknown: '未知',
};

interface Props {
  /** Optional callback when the transcript buffer changes (so QuestionSuggestionAgent can read it). */
  onBufferChange?: (chunks: ReadonlyArray<SttTranscriptChunk>) => void;
}

export function SttSettings({ onBufferChange }: Props) {
  const options = useMemo(() => listSttProviderOptions(), []);
  const [providerId, setProviderId] = useState<string>(() => getDefaultSttProviderId());
  const provider: SttProvider | null = useMemo(() => getSttProvider(providerId) ?? null, [providerId]);

  const [state, setState] = useState<SttState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chunks, setChunks] = useState<SttTranscriptChunk[]>([]);
  const chunksRef = useRef<SttTranscriptChunk[]>([]);

  // Sync chunks ref whenever state updates — this lets the latest snapshot be
  // pulled by the QuestionSuggestionAgent without a re-render.
  useEffect(() => {
    chunksRef.current = chunks;
    onBufferChange?.(chunks);
  }, [chunks, onBufferChange]);

  const start = async () => {
    if (!provider) return;
    if (state === 'listening' || state === 'starting') return;
    setErrorMessage(null);
    const session: SttSession = {
      onChunk: (chunk) => {
        setChunks((prev) => {
          const next = [...prev, chunk];
          // Fixed-window memory.
          return next.length > TRANSCRIPT_WINDOW ? next.slice(-TRANSCRIPT_WINDOW) : next;
        });
      },
      onError: (err) => {
        setErrorMessage(err.message);
        setState('error');
      },
      onStateChange: (s) => setState(s),
    };
    await provider.start(session);
  };

  const stop = async () => {
    if (!provider) return;
    await provider.stop();
    setState('idle');
  };

  // Auto-flip to a supported provider when the current one isn't usable.
  useEffect(() => {
    if (!provider?.supported) {
      const fallback = options.find((o) => o.supported);
      if (fallback && fallback.id !== providerId) {
        setProviderId(fallback.id);
      }
    }
  }, [providerId, options, provider]);

  return (
    <Card className="space-y-3" testId="stt-settings">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">实时语音转文字 (V161)</h4>
        <SttStateBadge state={state} provider={provider} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="stt-provider-select" className="text-xs text-slate-500">
          Provider
        </label>
        <select
          id="stt-provider-select"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          data-testid="stt-provider-select"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id} disabled={!opt.supported}>
              {opt.label} {opt.supported ? '' : '(未启用)'}
            </option>
          ))}
        </select>
        {provider?.local ? (
          <span
            className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            data-testid="stt-privacy-badge"
          >
            🔒 本地处理
          </span>
        ) : (
          <span
            className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            data-testid="stt-privacy-badge"
          >
            ☁️ 远程服务
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {state === 'listening' || state === 'starting' ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
            data-testid="stt-stop"
          >
            ⏹ 停止录音
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={!provider?.supported}
            className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-700/40 dark:bg-brand-900/30 dark:text-brand-200"
            data-testid="stt-start"
          >
            🎤 开始录音
          </button>
        )}
        {errorMessage && (
          <span className="text-[11px] text-rose-600" data-testid="stt-error">
            ⚠ {errorMessage}
          </span>
        )}
      </div>

      <div
        className="max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-900/30"
        data-testid="stt-transcript-stream"
      >
        {chunks.length === 0 ? (
          <p className="text-slate-400" data-testid="stt-empty">
            暂无转录内容。点击「开始录音」开始。
          </p>
        ) : (
          <ol className="space-y-1">
            {chunks.map((c, i) => (
              <li key={i} className="flex gap-2" data-testid="stt-chunk">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    c.speaker === 'candidate'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : c.speaker === 'interviewer'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                  data-testid="stt-chunk-speaker"
                >
                  {SPEAKER_LABEL[c.speaker ?? 'unknown']}
                </span>
                <span className={c.isFinal ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 italic'}>
                  {c.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="text-[11px] text-slate-500" data-testid="stt-chunk-count">
        共 {chunks.length} 段转录 · 保留窗口 {TRANSCRIPT_WINDOW}
      </p>
    </Card>
  );
}

function SttStateBadge({ state, provider }: { state: SttState; provider: SttProvider | null }) {
  const label = (() => {
    switch (state) {
      case 'idle': return '⚪ 空闲';
      case 'starting': return '🟡 启动中';
      case 'listening': return '🟢 录音中';
      case 'paused': return '🟠 已暂停';
      case 'stopping': return '🟠 停止中';
      case 'error': return '🔴 错误';
      default: return state;
    }
  })();
  return (
    <span
      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      data-testid="stt-state-badge"
      data-state={state}
    >
      {label}
      {provider ? ` · ${provider.label}` : ''}
    </span>
  );
}

export { listSttProviders };
