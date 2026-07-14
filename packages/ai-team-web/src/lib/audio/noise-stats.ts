// V196: NoiseStats — per-chunk + sliding-window RMS / SNR helpers for the
// live capture pipeline. Wraps V184's `rmsOf` / `peakOf` + V172-style
// threshold logic so V192's LiveSubtitlePanel can drive a noise meter.

import {
  isSilent,
  type AudioChunk,
} from '../stt/audio-source';

/** Inline reduced-RMS helpers — duplicated from waveform-diff so V196
 *  stays self-contained. The single-sample `rmsOf` and `peakOf` are
 *  tiny so the duplication cost is negligible.
 *
 *  V208: typed against `Float32Array` only (the only callers in
 *  summariseNoise / NoiseSlidingWindow pass `AudioChunk.samples`,
 *  which is `Float32Array`). Dropping the `ArrayLike<number>` union
 *  also removes the unreachable `?? 0` defensive branches — the V8
 *  coverage gate no longer treats them as uncoverable. */
function rmsOf(
  samples: Float32Array,
  start = 0,
  end = samples.length,
): number {
  const n = Math.max(0, end - start);
  if (n === 0) return 0;
  let acc = 0;
  for (let i = start; i < end; i++) {
    const v = samples[i] as number;
    acc += v * v;
  }
  return Math.sqrt(acc / n);
}

function peakOf(
  samples: Float32Array,
  start = 0,
  end = samples.length,
): number {
  let peak = 0;
  for (let i = start; i < end; i++) {
    const v = Math.abs(samples[i] as number);
    if (v > peak) peak = v;
  }
  return peak;
}

const legacyIsSilent = isSilent;

export interface NoiseSummary {
  /** Average RMS across the supplied window. */
  rmsMean: number;
  /** Maximum RMS seen. */
  rmsMax: number;
  /** Peak absolute amplitude across the window. */
  peak: number;
  /** Ratio of loud → silent RMS — useful as a quick SNR estimate. */
  signalToSilenceRatio: number;
  /** Fraction of chunks deemed "silent" by V192's silence gate. */
  silentRatio: number;
  /** Number of chunks examined. */
  chunkCount: number;
}

export interface NoiseStatsOptions {
  /** RMS threshold under which a chunk counts as silent. */
  silenceThreshold?: number;
}

/** Compute a NoiseSummary over a list of chunks. */
export function summariseNoise(
  chunks: ReadonlyArray<AudioChunk>,
  options: NoiseStatsOptions = {},
): NoiseSummary {
  const threshold = options.silenceThreshold ?? 0.01;
  if (chunks.length === 0) {
    return {
      rmsMean: 0,
      rmsMax: 0,
      peak: 0,
      signalToSilenceRatio: 0,
      silentRatio: 0,
      chunkCount: 0,
    };
  }
  let rmsSum = 0;
  let rmsMax = 0;
  let peak = 0;
  let silentCount = 0;
  // For SNR, we just look at the loudest 25% vs the quietest 25%.
  const rmsList: number[] = [];
  for (const c of chunks) {
    const r = rmsOf(c.samples);
    const p = peakOf(c.samples);
    rmsSum += r;
    if (r > rmsMax) rmsMax = r;
    if (p > peak) peak = p;
    if (legacyIsSilent(c, threshold)) silentCount += 1;
    rmsList.push(r);
  }
  const rmsMean = rmsSum / chunks.length;
  rmsList.sort((a, b) => a - b);
  const quietQuartile = avgQuartile(rmsList, 0, Math.floor(rmsList.length / 4));
  const loudQuartile = avgQuartile(
    rmsList,
    Math.floor((rmsList.length * 3) / 4),
    rmsList.length,
  );
  const snr = quietQuartile > 0
    ? Math.max(0, loudQuartile / quietQuartile)
    : 0;
  return {
    rmsMean,
    rmsMax,
    peak,
    signalToSilenceRatio: snr,
    silentRatio: silentCount / chunks.length,
    chunkCount: chunks.length,
  };
}

function avgQuartile(
  sorted: ReadonlyArray<number>,
  from: number,
  to: number,
): number {
  const slice = sorted.slice(from, to);
  if (slice.length === 0) return 0;
  let sum = 0;
  for (const v of slice) sum += v;
  return sum / slice.length;
}

/** Sliding-window noise tracker — accumulates the last `windowSize`
 *  chunk summaries and emits a smoothed mean. */
export class NoiseSlidingWindow {
  private readonly windowSize: number;
  private readonly threshold: number;
  private readonly samples: AudioChunk[] = [];

  constructor(windowSize: number, options: NoiseStatsOptions = {}) {
    this.windowSize = Math.max(1, windowSize);
    this.threshold = options.silenceThreshold ?? 0.01;
  }

  push(chunk: AudioChunk): NoiseSummary {
    this.samples.push(chunk);
    if (this.samples.length > this.windowSize) {
      this.samples.splice(0, this.samples.length - this.windowSize);
    }
    return summariseNoise(this.samples, { silenceThreshold: this.threshold });
  }

  snapshot(): ReadonlyArray<AudioChunk> {
    return this.samples.slice();
  }

  reset(): void {
    this.samples.length = 0;
  }
}

/** Classify noise severity from a summary — handy for UI meters. */
export type NoiseLevel = 'quiet' | 'normal' | 'loud' | 'clipping';

export function classifyNoise(summary: NoiseSummary): NoiseLevel {
  if (summary.peak >= 0.99) return 'clipping';
  if (summary.rmsMax >= 0.6) return 'loud';
  if (summary.rmsMean >= 0.05) return 'normal';
  return 'quiet';
}

/** Render an RMS value as a 0..100 progress bar fill percent. */
export function noiseFillPercent(summary: NoiseSummary): number {
  const denom = Math.max(summary.peak, summary.rmsMax, 0.0001);
  return Math.min(1, summary.rmsMean / denom) * 100;
}
