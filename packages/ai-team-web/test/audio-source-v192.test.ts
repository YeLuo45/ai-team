// V192 audio-source helpers tests.

import { describe, it, expect } from 'vitest';
import {
  BufferedAudioSource,
  chunkDurationMs,
  chunkRms,
  isSilent,
  mergeChunks,
  totalDurationMs,
  type AudioChunk,
} from '../src/lib/stt/audio-source';

function makeChunk(durationMs: number, amplitude = 0.5, sampleRate = 16_000): AudioChunk {
  const samples = new Float32Array(Math.round((durationMs / 1_000) * sampleRate)).fill(amplitude);
  return { startMs: 0, samples, sampleRate };
}

describe('BufferedAudioSource', () => {
  it('returns chunks in order then null when exhausted', async () => {
    const a = makeChunk(100);
    const b = makeChunk(200);
    const src = new BufferedAudioSource([a, b], 16_000);
    await src.start();
    expect(await src.next()).toBe(a);
    expect(await src.next()).toBe(b);
    expect(await src.next()).toBeNull();
    await src.stop();
  });

  it('start/stop are idempotent', async () => {
    const src = new BufferedAudioSource([makeChunk(50)], 16_000);
    await src.start();
    await src.start();
    await src.stop();
    await src.stop();
  });
});

describe('chunk helpers', () => {
  it('chunkDurationMs reports ms based on sample count', () => {
    const c = makeChunk(500);
    expect(chunkDurationMs(c)).toBeCloseTo(500, 5);
  });

  it('chunkRms reports sqrt-of-mean-square', () => {
    const c = makeChunk(100, 0.4);
    expect(chunkRms(c)).toBeCloseTo(0.4, 5);
  });

  it('isSilent flags chunks below the threshold', () => {
    const silent = makeChunk(100, 0.005);
    const loud = makeChunk(100, 0.1);
    expect(isSilent(silent)).toBe(true);
    expect(isSilent(loud)).toBe(false);
  });
});

describe('mergeChunks / totalDurationMs', () => {
  it('mergeChunks concatenates samples in order', () => {
    const c1 = new Float32Array([1, 2]);
    const c2 = new Float32Array([3, 4, 5]);
    const c3 = new Float32Array([6]);
    const merged = mergeChunks([
      { startMs: 0, samples: c1, sampleRate: 16_000 },
      { startMs: 0, samples: c2, sampleRate: 16_000 },
      { startMs: 0, samples: c3, sampleRate: 16_000 },
    ]);
    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('totalDurationMs aggregates chunk durations', () => {
    const t = totalDurationMs([makeChunk(100), makeChunk(250), makeChunk(50)]);
    expect(t).toBeCloseTo(400, 5);
  });
});
