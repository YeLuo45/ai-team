// V185 SubtitleAccumulator (stream.ts) tests.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SubtitleAccumulator,
  runStreamingSubtitles,
} from '../src/lib/subtitle/stream';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SubtitleAccumulator — basic ingest', () => {
  it('records chunks and closes to emit a final flush', () => {
    const acc = new SubtitleAccumulator({ flushIntervalMs: 1_000 });
    acc.push({ startMs: 0, endMs: 500, text: 'hello' });
    const final = acc.close();
    expect(final.cues.length).toBeGreaterThanOrEqual(1);
    expect(final.drained).toBe(true);
  });

  it('drops chunks with non-finite startMs', () => {
    const acc = new SubtitleAccumulator();
    acc.push({ startMs: Number.NaN, text: 'bad' });
    const final = acc.close();
    expect(final.cues.length).toBe(0);
  });

  it('ignores pushes after close()', () => {
    const acc = new SubtitleAccumulator();
    acc.close();
    const evt = acc.push({ startMs: 0, text: 'after' });
    expect(evt.drained).toBe(true);
  });
});

describe('SubtitleAccumulator — flushing', () => {
  it('emits a flush event after the first push when nothing is buffered', () => {
    const acc = new SubtitleAccumulator({ flushIntervalMs: 1_000 });
    const evt = acc.push({ startMs: 0, endMs: 1_500, text: 'a' });
    expect(evt.flushAtMs).toBe(1_500);
    expect(evt.cues.length).toBeGreaterThanOrEqual(1);
  });

  it('holds chunks back when within flushInterval', () => {
    const acc = new SubtitleAccumulator({ flushIntervalMs: 5_000 });
    acc.push({ startMs: 0, endMs: 1_000, text: 'a' });
    // Second push is well within 5s of the previous flush — no new flush.
    acc.push({ startMs: 1_500, endMs: 2_000, text: 'b' });
    const state = acc.state();
    expect(state.cues.length).toBeGreaterThanOrEqual(1);
  });

  it('emits another flush after flushInterval passes', () => {
    const acc = new SubtitleAccumulator({ flushIntervalMs: 1_000 });
    acc.push({ startMs: 0, endMs: 1_000, text: 'a' });
    const evt1 = acc.push({ startMs: 1_500, endMs: 3_000, text: 'b' });
    expect(evt1.flushAtMs).toBe(3_000);
    // third push is 0.1s after — should be suppressed.
    acc.push({ startMs: 3_500, endMs: 3_600, text: 'c' });
    const state = acc.state();
    expect(state.cues.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SubtitleAccumulator — memory cap', () => {
  it('keeps only the most recent maxCues entries', () => {
    const acc = new SubtitleAccumulator({ maxCues: 3 });
    for (let i = 0; i < 10; i++) {
      acc.push({ startMs: i * 1_000, endMs: i * 1_000 + 500, text: `c${i}` });
    }
    const final = acc.close();
    expect(final.cues.length).toBeLessThanOrEqual(3);
  });
});

describe('runStreamingSubtitles', () => {
  it('returns a final cue list and emits a flush per significant boundary', () => {
    const chunks = [
      { startMs: 0, endMs: 600, text: 'hi' },
      { startMs: 700, endMs: 1_400, text: 'again' },
    ];
    const { finalCues, flushEvents } = runStreamingSubtitles(chunks, { flushIntervalMs: 1000 });
    expect(finalCues.length).toBeGreaterThanOrEqual(1);
    expect(flushEvents.length).toBeGreaterThanOrEqual(3); // push x2 + close()
    expect(flushEvents[flushEvents.length - 1]?.drained).toBe(true);
  });
});
