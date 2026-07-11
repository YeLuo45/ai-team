import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatSrtTimestamp,
  formatVttTimestamp,
  normaliseChunks,
  chunkToCues,
  chunksToSrt,
  chunksToVtt,
  type SubtitleChunk,
} from '../src/lib/subtitle/cue';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ====================================================================
// 1. Timestamp formatters
// ====================================================================

describe('formatSrtTimestamp', () => {
  it('emits the canonical SRT form HH:MM:SS,mmm', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(1_234)).toBe('00:00:01,234');
    expect(formatSrtTimestamp(61_500)).toBe('00:01:01,500');
    expect(formatSrtTimestamp(3_661_999)).toBe('01:01:01,999');
  });

  it('clamps negative and NaN to zero', () => {
    expect(formatSrtTimestamp(-1)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(Number.NaN)).toBe('00:00:00,000');
  });

  it('rounds millisecond overflow from rounding', () => {
    expect(formatSrtTimestamp(1_999.4)).toBe('00:00:01,999');
  });
});

describe('formatVttTimestamp', () => {
  it('emits WEBVTT form HH:MM:SS.mmm', () => {
    expect(formatVttTimestamp(0)).toBe('00:00:00.000');
    expect(formatVttTimestamp(12_345)).toBe('00:00:12.345');
  });
});

// ====================================================================
// 2. normaliseChunks
// ====================================================================

describe('normaliseChunks', () => {
  it('returns sorted chunks with endMs filled', () => {
    const out = normaliseChunks([
      { startMs: 2000, endMs: 4000, text: 'b' },
      { startMs: 0, text: 'a' },
      { startMs: 1000, endMs: 1500, text: 'mid' },
    ]);
    expect(out.map((c) => c.text)).toEqual(['a', 'mid', 'b']);
    expect(out[0]?.endMs).toBe(1);
    expect(out[1]?.endMs).toBe(1500);
  });

  it('drops invalid chunks (NaN start / empty text)', () => {
    const out = normaliseChunks([
      { startMs: Number.NaN, text: 'bad' },
      { startMs: 100, text: '' },
      { startMs: 100, text: 'ok' },
    ]);
    expect(out.length).toBe(1);
    expect(out[0]?.text).toBe('ok');
  });

  it('clamps negative startMs to zero', () => {
    const out = normaliseChunks([{ startMs: -50, text: 'x' }]);
    expect(out[0]?.startMs).toBe(0);
  });
});

// ====================================================================
// 3. chunkToCues
// ====================================================================

describe('chunkToCues', () => {
  it('emits one cue per chunk by default', () => {
    const cues = chunkToCues([
      { startMs: 0, endMs: 2000, text: 'hello world' },
      { startMs: 2000, endMs: 4000, text: 'foo bar' },
    ]);
    expect(cues.length).toBe(2);
    expect(cues[0]?.index).toBe(1);
    expect(cues[0]?.text).toBe('hello world');
    expect(cues[0]?.endMs).toBe(2000);
  });

  it('splits a single chunk into multiple cues when text exceeds maxCueChars', () => {
    const longText = 'Apple Banana Cherry Dragon Elephant Frog Giraffe'.padEnd(200, '! ');
    const cues = chunkToCues(
      [{ startMs: 0, endMs: 60_000, text: longText }],
      { maxCueChars: 50, maxCueDurationMs: 60_000 },
    );
    expect(cues.length).toBeGreaterThan(1);
    for (const c of cues) {
      expect(c.text.length).toBeLessThanOrEqual(50);
    }
  });

  it('honours maxCueDurationMs and splits long chunks into multiple time slices', () => {
    const cues = chunkToCues(
      [{ startMs: 0, endMs: 60_000, text: 'A B C D E F G H I J ' .repeat(50) }],
      { maxCueChars: 200, maxCueDurationMs: 5_000 },
    );
    expect(cues.length).toBeGreaterThan(2);
    for (const c of cues) {
      expect(c.endMs - c.startMs).toBeLessThanOrEqual(5_000);
    }
  });

  it('prefixes the speaker label when labelSpeakers is true (default)', () => {
    const cues = chunkToCues([
      { startMs: 0, endMs: 1000, text: 'hi', speaker: 'Alice' },
    ]);
    expect(cues[0]?.text).toBe('Alice: hi');
  });

  it('skips empty chunks', () => {
    const cues = chunkToCues([
      { startMs: 0, endMs: 1000, text: '   ' },
      { startMs: 1000, endMs: 2000, text: 'actual' },
    ]);
    expect(cues.length).toBe(1);
    expect(cues[0]?.text).toBe('actual');
  });
});

// ====================================================================
// 4. chunksToSrt / chunksToVtt
// ====================================================================

describe('chunksToSrt', () => {
  it('returns an SRT body with 1-indexed cues', () => {
    const out = chunksToSrt([
      { startMs: 0, endMs: 2_000, text: 'first' },
      { startMs: 2_500, endMs: 4_500, text: 'second' },
    ]);
    expect(out).toContain('1\n');
    expect(out).toContain('2\n');
    expect(out).toContain('00:00:00,000 --> 00:00:02,000');
    expect(out).toContain('00:00:02,500 --> 00:00:04,500');
    expect(out).toContain('first');
    expect(out).toContain('second');
  });
});

describe('chunksToVtt', () => {
  it('returns a WEBVTT body with cue-ids', () => {
    const out = chunksToVtt([
      { startMs: 0, endMs: 2_000, text: 'first' },
      { startMs: 2_500, endMs: 4_500, text: 'second' },
    ]);
    expect(out.startsWith('WEBVTT')).toBe(true);
    expect(out).toContain('cue-1');
    expect(out).toContain('cue-2');
    expect(out).toContain('00:00:00.000 --> 00:00:02.000');
    expect(out).toContain('00:00:02.500 --> 00:00:04.500');
  });

  it('emits an empty body when no cues remain', () => {
    expect(chunksToVtt([])).toBe('WEBVTT\n\n');
  });
});
