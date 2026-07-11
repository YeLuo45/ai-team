// V184: Waveform helpers — frame-level energy extraction + diff.
//
// Pure functions. Frame size defaults to 16 ms @ 16 kHz = 256 samples,
// matching Whisper's typical window. The helpers are STT-pipeline
// agnostic — they operate on raw Float32 buffers (e.g. the audio
// chunks captured by V180's WhisperLocalProvider).

import { mergeBuffers, normalizeToMono, rmsToDb } from './frame-utils';

export { mergeBuffers, normalizeToMono, rmsToDb };

export interface FrameEnergy {
  startMs: number;
  samples: number;
  rms: number;
  peak: number;
}

export interface WaveformSummary {
  durationSec: number;
  sampleRate: number;
  frameSize: number;
  window: number;
  frames: ReadonlyArray<FrameEnergy>;
  peak: number;
}
/** Default settings — keep them open for test fixtures. */
export const DEFAULT_SAMPLE_RATE = 16_000;
export const DEFAULT_FRAME_SAMPLES = 256;
export const DEFAULT_WINDOW = 1;

/** Convert sample-rate to a default 16 ms frame size (rounded). */
export function defaultFrameSizeForSampleRate(sampleRate: number): number {
  return 16 * Math.round(sampleRate / 1_000);
}

export interface WaveformDiff {
  framesA: ReadonlyArray<FrameEnergy>;
  framesB: ReadonlyArray<FrameEnergy>;
  durationASec: number;
  durationBSec: number;
  delta: ReadonlyArray<number>;
  energyScore: number;
  similarity: number;
  overlap: ReadonlyArray<{
    start: number;
    end: number;
    owner: 'a' | 'b' | 'both';
  }>;
}

export function rmsOf(
  samples: Float32Array | ArrayLike<number>,
  start = 0,
  end = samples.length,
): number {
  const n = Math.max(0, end - start);
  if (n === 0) return 0;
  let acc = 0;
  for (let i = start; i < end; i++) {
    const v = samples[i] ?? 0;
    acc += v * v;
  }
  return Math.sqrt(acc / n);
}

export function peakOf(
  samples: Float32Array | ArrayLike<number>,
  start = 0,
  end = samples.length,
): number {
  let peak = 0;
  for (let i = start; i < end; i++) {
    const v = Math.abs(samples[i] ?? 0);
    if (v > peak) peak = v;
  }
  return peak;
}

export function normaliseSamples(
  input: Float32Array | ArrayLike<number> | ReadonlyArray<number> | null | undefined,
): Float32Array {
  if (!input) return new Float32Array(0);
  if (input instanceof Float32Array) {
    return input.length === 0
      ? new Float32Array(0)
      : new Float32Array(input.buffer, input.byteOffset, input.length);
  }
  const len = (input as ArrayLike<number>).length;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = (input as ArrayLike<number>)[i] ?? 0;
  return out;
}

export function summariseWaveform(
  audio: Float32Array | ArrayLike<number> | ReadonlyArray<number>,
  options: { sampleRate?: number; frameSize?: number; window?: number } = {},
): WaveformSummary {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const frameSize = options.frameSize ?? DEFAULT_FRAME_SAMPLES;
  const window = options.window ?? DEFAULT_WINDOW;
  const samples = normaliseSamples(audio);
  const frameMs = (frameSize / sampleRate) * 1000;
  const frames: FrameEnergy[] = [];
  let peak = 0;
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(samples.length, start + frameSize);
    const len = end - start;
    const rms = rmsOf(samples, start, end);
    const framePeak = peakOf(samples, start, end);
    if (framePeak > peak) peak = framePeak;
    frames.push({ startMs: frames.length * frameMs, samples: len, rms, peak: framePeak });
  }
  return {
    durationSec: samples.length / sampleRate,
    sampleRate,
    frameSize,
    window,
    frames,
    peak,
  };
}

export function pickRepresentativeFrames(
  summary: WaveformSummary,
  window = summary.window || 1,
): ReadonlyArray<FrameEnergy> {
  if (window <= 1) return summary.frames;
  const out: FrameEnergy[] = [];
  for (let i = 0; i < summary.frames.length; i += window) {
    const f = summary.frames[i];
    if (f) out.push(f);
  }
  return out;
}

function correlate(
  a: Float32Array | ArrayLike<number>,
  b: Float32Array | ArrayLike<number>,
): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sumA = 0;
  let sumB = 0;
  let sumAa = 0;
  let sumBb = 0;
  let sumAb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    sumA += x;
    sumB += y;
    sumAa += x * x;
    sumBb += y * y;
    sumAb += x * y;
  }
  const denom = Math.sqrt((n * sumAa - sumA * sumA) * (n * sumBb - sumB * sumB));
  if (denom === 0) return 0;
  return (n * sumAb - sumA * sumB) / denom;
}

export function diffWaveforms(
  a: Float32Array | ArrayLike<number>,
  b: Float32Array | ArrayLike<number>,
  options: { sampleRate?: number; frameSize?: number } = {},
): WaveformDiff {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const frameSize = options.frameSize ?? DEFAULT_FRAME_SAMPLES;
  const aMon = normalizeToMono(normaliseSamples(a));
  const bMon = normalizeToMono(normaliseSamples(b));
  const sumA = summariseWaveform(aMon, { sampleRate, frameSize, window: 1 });
  const sumB = summariseWaveform(bMon, { sampleRate, frameSize, window: 1 });
  const n = Math.max(sumA.frames.length, sumB.frames.length);
  const delta: number[] = new Array(n).fill(0);
  let energySum = 0;
  let energyA = 0;
  let energyB = 0;
  for (let i = 0; i < n; i++) {
    const fa = sumA.frames[i];
    const fb = sumB.frames[i];
    const ra = fa ? fa.rms : 0;
    const rb = fb ? fb.rms : 0;
    delta[i] = Math.abs(ra - rb);
    if (fa && fb) {
      energySum += delta[i] ?? 0;
      energyA += ra;
      energyB += rb;
    }
  }
  const maxE = Math.max(energyA, energyB);
  const energyScore = maxE === 0 ? 0 : Math.min(1, energySum / maxE);
  const isEmpty = aMon.length === 0 && bMon.length === 0;
  const isExact = !isEmpty && aMon.length === bMon.length && aMon.every((v, i) => v === bMon[i]);
  const corr = isEmpty ? 0 : isExact ? 1 : correlate(aMon, bMon);
  const similarity = isEmpty
    ? 0
    : isExact
    ? 1
    : Math.max(0, Math.min(1, (corr + 1) / 2));
  const overlap: Array<{ start: number; end: number; owner: 'a' | 'b' | 'both' }> = [];
  const durA = sumA.durationSec;
  const durB = sumB.durationSec;
  const dur = Math.max(durA, durB);
  if (dur === 0) {
    overlap.push({ start: 0, end: 1, owner: 'both' });
  } else {
    if (durA > 0) overlap.push({ start: 0, end: durA / dur, owner: 'a' });
    if (durB > 0) overlap.push({ start: 0, end: durB / dur, owner: 'b' });
    overlap.push({ start: 0, end: 1, owner: 'both' });
    overlap.sort((x, y) => x.start - y.start);
  }
  return {
    framesA: sumA.frames,
    framesB: sumB.frames,
    durationASec: durA,
    durationBSec: durB,
    delta,
    energyScore: clamp01(energyScore),
    similarity: clamp01(similarity),
    overlap,
  };
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function louderClip(d: WaveformDiff): 'a' | 'b' | 'tie' {
  if (d.framesA.length === 0 && d.framesB.length === 0) return 'tie';
  const sum = (frames: ReadonlyArray<FrameEnergy>) =>
    frames.reduce<number>((s, f) => s + f.rms, 0);
  const la = sum(d.framesA);
  const lb = sum(d.framesB);
  if (Math.abs(la - lb) < 1e-6) return 'tie';
  return la > lb ? 'a' : 'b';
}
