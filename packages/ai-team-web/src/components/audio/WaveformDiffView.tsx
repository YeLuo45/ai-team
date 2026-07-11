// V190: WaveformDiffView — React component that renders the V184
// WaveformDiff summary side-by-side as two stacked horizontal bars
// (one per clip) with per-frame RMS diagnostics + a similarity chip.

import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  summariseWaveform,
  diffWaveforms,
  type FrameEnergy,
  type WaveformDiff,
  defaultFrameSizeForSampleRate,
} from '../../lib/audio/waveform-diff';

export interface WaveformDiffViewProps {
  testId?: string;
  audioA: Float32Array | ArrayLike<number>;
  audioB: Float32Array | ArrayLike<number>;
  sampleRate?: number;
  frameSize?: number;
  barCount?: number;
  labelA?: string;
  labelB?: string;
}

/** Generate evenly-spaced indices and pull the rms for each. */
function downsampleToBars(
  frames: ReadonlyArray<FrameEnergy>,
  barCount: number,
): number[] {
  if (frames.length === 0 || barCount <= 0) return [];
  const out: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const idx = Math.min(
      frames.length - 1,
      Math.floor((i * frames.length) / barCount),
    );
    const f = frames[idx];
    out.push(f ? f.rms : 0);
  }
  return out;
}

function Bar({
  frames,
  rms,
  color,
  label,
  testId,
}: {
  frames: ReadonlyArray<FrameEnergy>;
  rms: number[];
  color: string;
  label: string;
  testId?: string;
}): ReactElement {
  const max = Math.max(0.0001, ...rms);
  return (
    <div className="space-y-1" data-testid={testId} data-label={label}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {frames.length} frames
        </span>
      </div>
      <div className="flex h-6 items-end gap-px rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 overflow-hidden">
        {rms.map((v, i) => (
          <span
            key={i}
            className={color}
            style={{ height: `${Math.max(1, (v / max) * 100)}%`, width: 2 }}
            data-testid={testId ? `${testId}-bar-${i}` : undefined}
            data-rms={v.toFixed(4)}
          />
        ))}
      </div>
    </div>
  );
}

export function WaveformDiffView({
  testId = 'wd-view',
  audioA,
  audioB,
  sampleRate = 16_000,
  frameSize,
  barCount = 80,
  labelA = 'Clip A',
  labelB = 'Clip B',
}: WaveformDiffViewProps): ReactElement {
  const effectiveFrameSize = useMemo(
    () => frameSize ?? defaultFrameSizeForSampleRate(sampleRate),
    [frameSize, sampleRate],
  );
  const data: WaveformDiff = useMemo(
    () =>
      diffWaveforms(audioA, audioB, {
        sampleRate,
        frameSize: effectiveFrameSize,
      }),
    [audioA, audioB, sampleRate, effectiveFrameSize],
  );
  const fullA = useMemo(
    () =>
      summariseWaveform(audioA, {
        sampleRate,
        frameSize: effectiveFrameSize,
      }),
    [audioA, sampleRate, effectiveFrameSize],
  );
  const fullB = useMemo(
    () =>
      summariseWaveform(audioB, {
        sampleRate,
        frameSize: effectiveFrameSize,
      }),
    [audioB, sampleRate, effectiveFrameSize],
  );
  const pickedA = useMemo(
    () => downsampleToBars(fullA.frames, barCount),
    [fullA, barCount],
  );
  const pickedB = useMemo(
    () => downsampleToBars(fullB.frames, barCount),
    [fullB, barCount],
  );

  const similarityPct = (data.similarity * 100).toFixed(1);
  const energyPct = (data.energyScore * 100).toFixed(1);
  const sumA = data.framesA.reduce((s: number, f) => s + f.rms, 0);
  const sumB = data.framesB.reduce((s: number, f) => s + f.rms, 0);
  const louder =
    data.framesA.length === 0 && data.framesB.length === 0
      ? 'tie'
      : Math.abs(sumA - sumB) < 1e-6
      ? 'tie'
      : sumA > sumB
      ? 'A'
      : 'B';

  return (
    <div
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3"
      data-testid={testId}
      data-similarity={data.similarity.toFixed(4)}
      data-energy-score={data.energyScore.toFixed(4)}
    >
      <header className="flex items-center justify-between text-[11px]">
        <div className="flex gap-3">
          <span className="font-mono text-emerald-600 dark:text-emerald-400">
            similarity {similarityPct}%
          </span>
          <span className="font-mono text-amber-600 dark:text-amber-400">
            energy Δ {energyPct}%
          </span>
        </div>
        <span className="font-mono text-slate-500">louder: {louder}</span>
      </header>
      <Bar
        label={labelA}
        frames={fullA.frames}
        rms={pickedA}
        color="bg-sky-500 dark:bg-sky-400"
        testId={`${testId}-a`}
      />
      <Bar
        label={labelB}
        frames={fullB.frames}
        rms={pickedB}
        color="bg-violet-500 dark:bg-violet-400"
        testId={`${testId}-b`}
      />
    </div>
  );
}
