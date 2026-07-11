import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rmsOf,
  peakOf,
  normaliseSamples,
  summariseWaveform,
  pickRepresentativeFrames,
  diffWaveforms,
  louderClip,
  clamp01,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_FRAME_SAMPLES,
} from '../src/lib/audio/waveform-diff';
import { mergeBuffers, rmsToDb } from '../src/lib/audio/frame-utils';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ====================================================================
// 1. Frame energy (RMS / peak)
// ====================================================================

describe('rmsOf / peakOf', () => {
  it('returns 0 for an empty range', () => {
    expect(rmsOf(new Float32Array(0))).toBe(0);
    expect(peakOf(new Float32Array(0))).toBe(0);
  });

  it('computes RMS from sample range', () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    expect(rmsOf(samples)).toBeCloseTo(1, 5);
  });

  it('computes RMS for sub-range', () => {
    const samples = new Float32Array([2, 0, 0, 0, 2]);
    expect(rmsOf(samples, 0, 1)).toBeCloseTo(2, 5);
    expect(rmsOf(samples, 4, 5)).toBeCloseTo(2, 5);
    expect(rmsOf(samples)).toBeCloseTo(Math.sqrt(8 / 5), 5);
  });

  it('returns zero peak for silent input', () => {
    expect(peakOf(new Float32Array(100))).toBe(0);
  });

  it('returns absolute peak', () => {
    const samples = new Float32Array([0.1, -0.5, 0.2, 0.7, -0.3]);
    expect(peakOf(samples)).toBeCloseTo(0.7, 5);
  });
});

// ====================================================================
// 2. Sample normalisation + summarise + windows
// ====================================================================

describe('normaliseSamples', () => {
  it('returns an empty Float32Array on nullish input', () => {
    expect(normaliseSamples(null).length).toBe(0);
    expect(normaliseSamples(undefined).length).toBe(0);
  });

  it('copies array-like values element-wise', () => {
    const out = normaliseSamples([1, 2, 3]);
    expect(out.length).toBe(3);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });

  it('round-trips Float32Array data without copying', () => {
    const original = new Float32Array([0.4, 0.5, 0.6]);
    const out = normaliseSamples(original);
    expect(out.length).toBe(3);
    expect(out[1]).toBe(0.5);
  });
});

describe('summariseWaveform', () => {
  it('emits one frame per 256 samples by default', () => {
    const samples = new Float32Array(DEFAULT_FRAME_SAMPLES * 4);
    const summary = summariseWaveform(samples);
    expect(summary.frames.length).toBe(4);
    expect(summary.durationSec).toBe(4 * DEFAULT_FRAME_SAMPLES / DEFAULT_SAMPLE_RATE);
  });

  it('packs a partial tail frame', () => {
    const samples = new Float32Array(DEFAULT_FRAME_SAMPLES * 2 + 60);
    const summary = summariseWaveform(samples);
    expect(summary.frames.length).toBe(3);
    expect(summary.frames[2]?.samples).toBe(60);
  });

  it('tracks the source sample rate on the summary', () => {
    const summary = summariseWaveform(new Float32Array(8_000), { sampleRate: 8_000 });
    expect(summary.sampleRate).toBe(8_000);
    expect(summary.durationSec).toBe(1);
  });

  it('respects a custom frame size', () => {
    const samples = new Float32Array(512);
    const summary = summariseWaveform(samples, { frameSize: 128 });
    expect(summary.frames.length).toBe(4);
    expect(summary.frameSize).toBe(128);
  });
});

describe('pickRepresentativeFrames', () => {
  it('returns the same frames when window is 1', () => {
    const samples = new Float32Array(DEFAULT_FRAME_SAMPLES * 4);
    const summary = summariseWaveform(samples);
    expect(pickRepresentativeFrames(summary).length).toBe(summary.frames.length);
  });

  it('returns every Nth frame when window is N', () => {
    const samples = new Float32Array(DEFAULT_FRAME_SAMPLES * 10);
    const summary = summariseWaveform(samples);
    const picked = pickRepresentativeFrames(summary, 2);
    expect(picked.length).toBe(5);
    expect(picked[0]).toBe(summary.frames[0]);
    expect(picked[1]).toBe(summary.frames[2]);
  });
});

// ====================================================================
// 3. Diff + frame-by-frame delta
// ====================================================================

describe('diffWaveforms', () => {
  it('returns ~1 similarity for two identical clips', () => {
    const a = new Float32Array(16_000); // 1 second of zeros — boring but identical
    const b = new Float32Array(16_000);
    a.fill(0.2);
    b.fill(0.2);
    const d = diffWaveforms(a, b);
    expect(d.similarity).toBeGreaterThan(0.95);
    expect(d.energyScore).toBeLessThan(0.05);
  });

  it('reports energy imbalance between a louder and a quieter clip', () => {
    const a = new Float32Array(8_000).map((_, i) => Math.sin(i / 10) * 0.8);
    const b = new Float32Array(8_000).map((_, i) => Math.sin(i / 10) * 0.1);
    const d = diffWaveforms(a, b);
    expect(d.energyScore).toBeGreaterThan(0.5);
    expect(louderClip(d)).toBe('a');
  });

  it('returns the louder clip label as a tie for symmetric audio', () => {
    const a = new Float32Array(4_000).map((_, i) => Math.sin(i / 5) * 0.5);
    const b = new Float32Array(4_000).map((_, i) => Math.sin(i / 5) * 0.5);
    const d = diffWaveforms(a, b);
    expect(louderClip(d)).toBe('tie');
  });

  it('aligns to the longer clip + emits per-frame delta', () => {
    const a = new Float32Array(DEFAULT_FRAME_SAMPLES * 2);
    const b = new Float32Array(DEFAULT_FRAME_SAMPLES * 3);
    a.fill(0.3);
    b.fill(0.1);
    const d = diffWaveforms(a, b);
    expect(d.delta.length).toBe(3);
    expect(d.delta[0]).toBeCloseTo(0.2, 1);
    expect(d.delta[1]).toBeCloseTo(0.2, 1);
    expect(d.delta[2]).toBeCloseTo(0.1, 1);
  });

  it('emits three overlap ranges when both clips exist', () => {
    const a = new Float32Array(16_000); // 1 second
    const b = new Float32Array(32_000); // 2 seconds
    a.fill(0.1);
    b.fill(0.1);
    const d = diffWaveforms(a, b);
    expect(d.overlap.length).toBe(3);
    expect(d.durationASec).toBe(1);
    expect(d.durationBSec).toBe(2);
  });

  it('handles an empty pair gracefully', () => {
    const d = diffWaveforms(new Float32Array(0), new Float32Array(0));
    expect(d.similarity).toBe(0);
    expect(d.energyScore).toBe(0);
    expect(louderClip(d)).toBe('tie');
  });
});

// ====================================================================
// 4. Framing + helpers
// ====================================================================

describe('clamp01', () => {
  it('clamps +infinity to 1', () => {
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
  });
  it('clamps -infinity to 0', () => {
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });
  it('treats NaN as 0', () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('louderClip', () => {
  it('returns the label for the louder clip', () => {
    const d = {
      framesA: [{ rms: 0.5, samples: 1, peak: 0.5, startMs: 0 }],
      framesB: [{ rms: 0.1, samples: 1, peak: 0.1, startMs: 0 }],
      durationASec: 1,
      durationBSec: 1,
      delta: [],
      energyScore: 0.4,
      similarity: 1,
      overlap: [],
    };
    expect(louderClip(d)).toBe('a');
  });
});

// ====================================================================
// 5. Audio frame-utils smoke
// ====================================================================

describe('frame-utils', () => {
  it('mergeBuffers concatenates Float32Arrays', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5]);
    const merged = mergeBuffers([a, b]);
    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5]);
  });

  it('mergeBuffers tolerates an empty list', () => {
    const merged = mergeBuffers<Float32Array>([]);
    expect(merged.length).toBe(0);
  });

  it('rmsToDb clamps to a sensible minimum', () => {
    expect(rmsToDb(0)).toBe(-120);
    expect(rmsToDb(1)).toBeCloseTo(0, 5);
  });
});
