// V196 NoiseStats / NoiseSlidingWindow helpers tests.

import { describe, it, expect } from 'vitest';
import {
  summariseNoise,
  NoiseSlidingWindow,
  classifyNoise,
  noiseFillPercent,
  type NoiseSummary,
} from '../src/lib/audio/noise-stats';
import type { AudioChunk } from '../src/lib/stt/audio-source';

function chunk(amp: number, n = 200): AudioChunk {
  return {
    startMs: 0,
    samples: new Float32Array(n).fill(amp),
    sampleRate: 16_000,
  };
}

function noiseSummary(partial: Partial<NoiseSummary>): NoiseSummary {
  return {
    rmsMean: 0,
    rmsMax: 0,
    peak: 0,
    signalToSilenceRatio: 0,
    silentRatio: 0,
    chunkCount: 0,
    ...partial,
  };
}

describe('summariseNoise', () => {
  it('reports zeros for an empty chunk list', () => {
    const s = summariseNoise([]);
    expect(s.rmsMean).toBe(0);
    expect(s.rmsMax).toBe(0);
    expect(s.peak).toBe(0);
    expect(s.signalToSilenceRatio).toBe(0);
    expect(s.silentRatio).toBe(0);
    expect(s.chunkCount).toBe(0);
  });

  it('reports aggregate stats for a homogeneous window', () => {
    const s = summariseNoise([chunk(0.4), chunk(0.4), chunk(0.4)]);
    expect(s.chunkCount).toBe(3);
    expect(s.rmsMax).toBeCloseTo(0.4, 5);
    expect(s.rmsMean).toBeCloseTo(0.4, 5);
    expect(s.peak).toBeCloseTo(0.4, 5);
    expect(s.signalToSilenceRatio).toBeGreaterThanOrEqual(0);
    expect(s.silentRatio).toBe(0);
  });

  it('counts silent chunks with the configured threshold', () => {
    const s = summariseNoise(
      [chunk(0.4), chunk(0.4), chunk(0.001), chunk(0.001)],
      { silenceThreshold: 0.01 },
    );
    expect(s.silentRatio).toBeCloseTo(0.5, 5);
  });

  it('computes a positive SNR when loud / quiet quartiles diverge', () => {
    const mixed = [
      chunk(0.01),
      chunk(0.01),
      chunk(0.01),
      chunk(0.7),
      chunk(0.7),
      chunk(0.7),
    ];
    const s = summariseNoise(mixed, { silenceThreshold: 0.005 });
    expect(s.signalToSilenceRatio).toBeGreaterThan(2);
  });
});

describe('NoiseSlidingWindow', () => {
  it('rolls over chunks and produces a stable summary', () => {
    const w = new NoiseSlidingWindow(3);
    const a = w.push(chunk(0.4));
    const b = w.push(chunk(0.6));
    const c = w.push(chunk(0.5));
    expect(a.rmsMean).toBeCloseTo(0.4, 5);
    expect(b.rmsMean).toBeCloseTo(0.5, 5);
    expect(c.rmsMean).toBeCloseTo(0.5, 5);
    expect(w.snapshot().length).toBe(3);

    // Pushing a 4th chunk should evict the oldest.
    const d = w.push(chunk(0.8));
    expect(w.snapshot().length).toBe(3);
    expect(d.rmsMean).toBeCloseTo((0.6 + 0.5 + 0.8) / 3, 5);
  });

  it('reset() drops every chunk', () => {
    const w = new NoiseSlidingWindow(4);
    w.push(chunk(0.4));
    w.push(chunk(0.5));
    w.reset();
    expect(w.snapshot().length).toBe(0);
  });
});

describe('classifyNoise + noiseFillPercent', () => {
  it('classifies clipping / loud / normal / quiet', () => {
    expect(classifyNoise(noiseSummary({ peak: 0.999 }))).toBe('clipping');
    expect(classifyNoise(noiseSummary({ peak: 0.5, rmsMax: 0.7 }))).toBe('loud');
    expect(classifyNoise(noiseSummary({ peak: 0.3, rmsMean: 0.1, rmsMax: 0.3 }))).toBe(
      'normal',
    );
    expect(classifyNoise(noiseSummary({ peak: 0.1, rmsMean: 0.001, rmsMax: 0.1 }))).toBe(
      'quiet',
    );
  });

  it('noiseFillPercent caps the bar at 100%', () => {
    const high = noiseSummary({ rmsMean: 10, peak: 1, rmsMax: 1 });
    expect(noiseFillPercent(high)).toBeLessThanOrEqual(100);
    const low = noiseSummary({ rmsMean: 0.1, rmsMax: 0.4, peak: 0.4 });
    expect(noiseFillPercent(low)).toBeGreaterThan(0);
    const empty = noiseSummary({});
    expect(noiseFillPercent(empty)).toBe(0);
  });
});

// V208: branch coverage for the strict-95% layer — exercise the
// edge branches inside summariseNoise / NoiseSlidingWindow that the
// happy-path tests above miss:
//
//   1. Empty Float32Array → rmsOf/peakOf early-return path (n === 0)
//   2. Single-chunk window → avgQuartile slice === []
//   3. All-silent chunks → quietQuartile === 0 → SNR === 0
//      (the `quietQuartile > 0 ? ... : 0` falsy branch)
describe('summariseNoise edge branches (V208)', () => {
  function emptyChunk(): AudioChunk {
    return {
      startMs: 0,
      samples: new Float32Array(0),
      sampleRate: 16_000,
    };
  }

  it('handles a chunk with zero samples', () => {
    const s = summariseNoise([emptyChunk()]);
    expect(s.rmsMean).toBe(0);
    expect(s.rmsMax).toBe(0);
    expect(s.peak).toBe(0);
    // Empty samples means the silence gate (RMS=0) classifies it
    // as silent — but rmsOf returns 0 cleanly without dividing.
    expect(s.silentRatio).toBeGreaterThanOrEqual(0);
    expect(s.chunkCount).toBe(1);
  });

  it('handles a single-chunk window without crashing', () => {
    // Window size < 4 means avgQuartile's slice is empty for both
    // quiet / loud quartiles — exercises the `slice.length === 0`
    // early-return branch inside avgQuartile.
    const s = summariseNoise([chunk(0.3)], { silenceThreshold: 0.01 });
    expect(s.chunkCount).toBe(1);
    expect(s.rmsMean).toBeCloseTo(0.3, 5);
    // quietQuartile = avgQuartile([], 0, 0) === 0 → SNR = 0.
    expect(s.signalToSilenceRatio).toBe(0);
  });

  it('reports SNR === 0 when quiet quartile is zero (empty chunks)', () => {
    // quietQuartile = avgQuartile(empty, 0, 0) = 0 (slice.length === 0
    // branch inside avgQuartile). When quietQuartile === 0 the ternary
    // `quietQuartile > 0 ? ... : 0` takes the falsy arm → SNR = 0.
    const s = summariseNoise([emptyChunk(), emptyChunk()]);
    expect(s.signalToSilenceRatio).toBe(0);
  });

  it('NoiseSlidingWindow accepts a single empty chunk', () => {
    // Pushing an empty chunk into the window should produce a
    // zeros-only summary without crashing on sqrt(0/0).
    const w = new NoiseSlidingWindow(4);
    const s = w.push(emptyChunk());
    expect(s.chunkCount).toBe(1);
    expect(s.rmsMean).toBe(0);
    expect(s.peak).toBe(0);
    // WINDOW_SIZE 4 means averageQuartile slice is empty — the
    // same edge branch as the single-chunk window case.
    expect(s.signalToSilenceRatio).toBe(0);
  });
});
