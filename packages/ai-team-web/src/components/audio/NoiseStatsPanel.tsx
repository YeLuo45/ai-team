// V204: NoiseStatsPanel — presentational UI for the V196 NoiseStats
// helpers (summariseNoise + classifyNoise + noiseFillPercent).
//
// Consumers feed either:
//   - a `NoiseSummary` object computed upstream via `summariseNoise`, or
//   - a raw `chunks` array; the panel invokes `summariseNoise` itself
//     when `summary` is omitted.
//
// The component renders:
//   - a severity chip (`quiet`/`normal`/`loud`/`clipping`)
//   - a fill bar (0..100%) driven by `noiseFillPercent`
//   - the summary stats (rmsMean, rmsMax, peak, snr, silentRatio)
//   - an optional RMS history sparkline for live capture views
//
// Pure read-only — no side effects. Designed to slot into a future
// LiveSubtitlePanel sidebar, a noise-metrics dashboard, or any
// V192 audio source consumer.

import { useMemo, type ReactElement } from 'react';
import {
  classifyNoise,
  noiseFillPercent,
  summariseNoise,
  type NoiseLevel,
  type NoiseSummary,
  type NoiseStatsOptions,
} from '../../lib/audio/noise-stats';
import type { AudioChunk } from '../../lib/stt/audio-source';

export interface NoiseStatsPanelProps {
  testId?: string;
  /** Pre-computed noise summary. Wins over `chunks` when supplied. */
  summary?: NoiseSummary;
  /** Raw audio chunks — the panel runs `summariseNoise` if `summary`
   *  is omitted. Useful when callers don't want to import V196 helpers. */
  chunks?: ReadonlyArray<AudioChunk>;
  /** Options forwarded to `summariseNoise` when computing from chunks. */
  options?: NoiseStatsOptions;
  /** Optional ring buffer of past `rmsMean` values for a sparkline. */
  history?: ReadonlyArray<number>;
  /** Number of sparkline bars to render; defaults to 40. */
  historyBars?: number;
  /** Visible title. Defaults to "Noise Meter". */
  title?: string;
  /** Visible subtitle / status text. */
  subtitle?: string;
}

const LEVEL_TONE: Record<NoiseLevel, string> = {
  quiet:
    'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  normal:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  loud:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  clipping:
    'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

const LEVEL_BAR: Record<NoiseLevel, string> = {
  quiet: 'bg-slate-400 dark:bg-slate-500',
  normal: 'bg-emerald-500 dark:bg-emerald-400',
  loud: 'bg-amber-500 dark:bg-amber-400',
  clipping: 'bg-rose-500 dark:bg-rose-400',
};

function fmt(value: number, digits = 4): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '0';
}

export function NoiseStatsPanel({
  testId = 'ns-panel',
  summary,
  chunks,
  options,
  history,
  historyBars = 40,
  title = 'Noise Meter',
  subtitle,
}: NoiseStatsPanelProps): ReactElement {
  const effective: NoiseSummary = useMemo(() => {
    if (summary) return summary;
    if (chunks) {
      return summariseNoise(chunks, options ?? {});
    }
    return {
      rmsMean: 0,
      rmsMax: 0,
      peak: 0,
      signalToSilenceRatio: 0,
      silentRatio: 0,
      chunkCount: 0,
    };
  }, [summary, chunks, options]);

  const level: NoiseLevel = useMemo(
    () => classifyNoise(effective),
    [effective],
  );

  const fillPercent = useMemo(
    () => Math.round(noiseFillPercent(effective)),
    [effective],
  );

  const sparkline = useMemo<number[]>(() => {
    if (!history || history.length === 0) return [];
    const out: number[] = [];
    const total = Math.max(1, historyBars);
    for (let i = 0; i < total; i++) {
      const idx = Math.min(
        history.length - 1,
        Math.floor((i * history.length) / total),
      );
      out.push(Math.max(0, history[idx] ?? 0));
    }
    return out;
  }, [history, historyBars]);

  const peakBar = Math.max(0.0001, ...sparkline, effective.rmsMax);
  const silentPct = (effective.silentRatio * 100).toFixed(0);

  return (
    <div
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2"
      data-testid={testId}
      data-level={level}
      data-fill={String(fillPercent)}
      data-silent-ratio={effective.silentRatio.toFixed(4)}
      data-chunk-count={String(effective.chunkCount)}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          {subtitle ? (
            <span className="text-[10px] font-mono text-slate-500">
              {subtitle}
            </span>
          ) : null}
        </div>
        <span
          className={
            'text-[10px] font-mono px-2 py-0.5 rounded ' + LEVEL_TONE[level]
          }
          data-testid={testId ? `${testId}-level` : undefined}
        >
          {level}
        </span>
      </header>

      <div className="space-y-1">
        <div
          className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"
          data-testid={testId ? `${testId}-bar-track` : undefined}
        >
          <div
            className={'h-full ' + LEVEL_BAR[level]}
            style={{ width: `${Math.max(2, Math.min(100, fillPercent))}%` }}
            data-testid={testId ? `${testId}-bar-fill` : undefined}
            data-fill-percent={String(fillPercent)}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>{fillPercent}%</span>
          <span>peak {fmt(effective.peak, 3)}</span>
        </div>
      </div>

      {sparkline.length > 0 ? (
        <div className="space-y-1" data-testid={testId ? `${testId}-history` : undefined}>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              history
            </span>
            <span className="font-mono text-slate-500">
              {sparkline.length} samples
            </span>
          </div>
          <div className="flex h-4 items-end gap-px rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 overflow-hidden">
            {sparkline.map((v, i) => (
              <span
                key={i}
                className={LEVEL_BAR[level]}
                style={{
                  height: `${Math.max(1, (v / peakBar) * 100)}%`,
                  width: 2,
                }}
                data-testid={
                  testId ? `${testId}-history-bar-${i}` : undefined
                }
                data-rms={v.toFixed(4)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <dl
        className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]"
        data-testid={testId ? `${testId}-stats` : undefined}
      >
        <Stat label="rms mean" value={fmt(effective.rmsMean)} testId={`${testId}-rms-mean`} />
        <Stat label="rms max" value={fmt(effective.rmsMax)} testId={`${testId}-rms-max`} />
        <Stat label="snr" value={fmt(effective.signalToSilenceRatio, 2)} testId={`${testId}-snr`} />
        <Stat label="silent" value={`${silentPct}%`} testId={`${testId}-silent`} />
        <Stat label="chunks" value={String(effective.chunkCount)} testId={`${testId}-chunks`} />
        <Stat
          label="peak"
          value={fmt(effective.peak, 3)}
          testId={`${testId}-peak`}
        />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}): ReactElement {
  return (
    <div className="flex flex-col" data-testid={testId} data-label={label}>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="font-mono text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export default NoiseStatsPanel;
