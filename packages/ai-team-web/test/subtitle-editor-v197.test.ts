// V197 SubtitleEditor helpers tests.

import { describe, it, expect } from 'vitest';
import {
  applyEdits,
  rebuildFromChunks,
  suspiciousOverlaps,
  appendEditLog,
  type CueEdit,
  type SrtCue,
} from '../src/lib/subtitle/editor';
import type { SubtitleChunk } from '../src/lib/subtitle';

function makeCue(
  index: number,
  text: string,
  startMs: number,
  endMs: number,
): SrtCue {
  return { index, startMs, endMs, text };
}

describe('applyEdits', () => {
  it('renumbers cues after editing', () => {
    const cues: SrtCue[] = [
      makeCue(1, 'a', 0, 1000),
      makeCue(2, 'b', 1000, 2000),
      makeCue(3, 'c', 2000, 3000),
    ];
    const out = applyEdits(cues, [{ cueIndex: 2, text: 'B-updated' }]);
    expect(out.cues.length).toBe(3);
    expect(out.cues.map((c) => c.text)).toEqual(['a', 'B-updated', 'c']);
    expect(out.cues.map((c) => c.index)).toEqual([1, 2, 3]);
    expect(out.droppedIndices).toEqual([]);
  });

  it('drops cues when requested and renumbers', () => {
    const cues: SrtCue[] = [
      makeCue(1, 'a', 0, 1000),
      makeCue(2, 'b', 1000, 2000),
      makeCue(3, 'c', 2000, 3000),
    ];
    const out = applyEdits(cues, [{ cueIndex: 2, drop: true }]);
    expect(out.cues.length).toBe(2);
    expect(out.cues.map((c) => c.text)).toEqual(['a', 'c']);
    expect(out.droppedIndices).toEqual([2]);
  });

  it('returns the original when no edits are supplied', () => {
    const cues: SrtCue[] = [makeCue(1, 'a', 0, 1000)];
    const out = applyEdits(cues, []);
    expect(out.cues[0]?.text).toBe('a');
  });

  it('shifts start / end times when those fields are set', () => {
    const cues: SrtCue[] = [makeCue(1, 'a', 0, 1000)];
    const out = applyEdits(cues, [{ cueIndex: 1, startMs: 500, endMs: 1500 }]);
    expect(out.cues[0]?.startMs).toBe(500);
    expect(out.cues[0]?.endMs).toBe(1500);
  });
});

describe('rebuildFromChunks', () => {
  it('rebuilds the cue list from raw chunks', () => {
    const chunks: SubtitleChunk[] = [
      { startMs: 0, endMs: 1000, text: 'one' },
      { startMs: 1500, endMs: 2500, text: 'two' },
    ];
    const cues = rebuildFromChunks(chunks);
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues[0]?.text).toBe('one');
    expect(cues[1]?.text).toBe('two');
  });
});

describe('suspiciousOverlaps', () => {
  it('flags cues that begin before the previous end', () => {
    const cues: SrtCue[] = [
      makeCue(1, 'a', 0, 2000),
      makeCue(2, 'b', 1000, 2000), // overlaps
      makeCue(3, 'c', 2500, 3500),
    ];
    const flagged = suspiciousOverlaps(cues);
    expect(flagged).toEqual([2]);
  });

  it('returns empty for non-overlapping cues', () => {
    const cues: SrtCue[] = [
      makeCue(1, 'a', 0, 1000),
      makeCue(2, 'b', 1000, 2000),
    ];
    expect(suspiciousOverlaps(cues)).toEqual([]);
  });
});

describe('appendEditLog', () => {
  it('returns unchanged log when before/after match', () => {
    const log = appendEditLog([], 1, 'same', 'same', NOW);
    expect(log).toEqual([]);
  });

  it('appends the edit when text changes', () => {
    const log = appendEditLog([], 1, 'before', 'after', NOW);
    expect(log.length).toBe(1);
    expect(log[0]).toEqual({ cueIndex: 1, editedAtMs: NOW, before: 'before', after: 'after' });
  });

  it('keeps prior entries intact', () => {
    const seed = [
      { cueIndex: 1, editedAtMs: NOW - 100, before: 'x', after: 'y' },
    ];
    const log = appendEditLog(seed, 2, 'a', 'b', NOW);
    expect(log.length).toBe(2);
    expect(log[0]).toBe(seed[0]);
  });
});

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
