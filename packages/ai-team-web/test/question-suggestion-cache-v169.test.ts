// V169: history ↔ cache bidirectional sync tests.
//
// Two surfaces:
//   1. cache.ts: remember() with `adoptedAt` mirrors the timestamp onto
//      generatedAt (so readers can tell at a glance the cached entry was
//      also adopted).
//   2. End-to-end round-trip through localStorage: writeCache → readCache
//      → remember with adoptedAt → recallCandidate returns the latest
//      entry with the adopted timestamp.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CACHE_KEY,
  emptyCache,
  readCache,
  recallCandidate,
  recallPosition,
  remember,
  rememberCandidate,
  rememberPosition,
  writeCache,
} from '../src/lib/question-suggestion/cache';
import {
  appendAdopted,
  buildAdoption,
  readHistory,
  STORAGE_KEY as HISTORY_KEY,
  writeHistory,
} from '../src/lib/question-suggestion/history';
import type { QuestionSuggestion } from '../src/lib/question-suggestion/types';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-04T12:34:56.789Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeSuggestion(over: Partial<QuestionSuggestion> = {}): QuestionSuggestion {
  return {
    id: 'sg_v169',
    question: '你能讲讲这个项目最关键的决策吗？',
    rationale: '探查决策权衡',
    focusTag: 'technical',
    difficulty: 'hard',
    followUpHints: ['如果时间倒流会改什么'],
    generatedAt: 0, // overwritten by remember with adoptedAt
    ...over,
  };
}

describe('V169: remember() adoptedAt mirrors to generatedAt', () => {
  it('omitting adoptedAt leaves generatedAt untouched', () => {
    const s = makeSuggestion({ generatedAt: 1700000000000 });
    const next = remember(emptyCache(), {
      candidateId: 'ct_x',
      position: 'FE',
      suggestion: s,
    });
    expect(next.candidates.ct_x?.[0]?.generatedAt).toBe(1700000000000);
    expect(next.positions.FE?.[0]?.generatedAt).toBe(1700000000000);
  });

  it('passing adoptedAt overwrites generatedAt in BOTH keys', () => {
    const s = makeSuggestion({ generatedAt: 1700000000000 });
    const t = 1717500000000;
    const next = remember(emptyCache(), {
      candidateId: 'ct_y',
      position: 'BE',
      suggestion: s,
      adoptedAt: t,
    });
    expect(next.candidates.ct_y?.[0]?.generatedAt).toBe(t);
    expect(next.positions.BE?.[0]?.generatedAt).toBe(t);
  });

  it('preserves the original suggestion object (mutation safety)', () => {
    const s = makeSuggestion({ generatedAt: 1700000000000 });
    remember(emptyCache(), {
      candidateId: 'ct_z',
      position: 'BA',
      suggestion: s,
      adoptedAt: 1717500000000,
    });
    // The input must NOT be mutated — callers should be free to reuse it.
    expect(s.generatedAt).toBe(1700000000000);
  });
});

describe('V169: history + cache stay in sync via storage round-trip', () => {
  it('recalling cache returns the adopted entry after a write round-trip', () => {
    const mem = new MemoryStorage();
    const s = makeSuggestion({ id: 'shared-1', generatedAt: 0 });
    const candidateId = 'ct_alice';
    const position = 'Senior Frontend';

    // 1) Adopt → write history.
    writeHistory(
      mem,
      appendAdopted(readHistory(mem), buildAdoption({
        suggestion: { ...s, generatedAt: 1717500000000 },
        sessionId: candidateId,
        candidateName: 'Alice',
        position,
      })),
    );

    // 2) Adopt → write cache with same adoptedAt, per V169 panel sync.
    const adoptedAt = 1717500000001;
    writeCache(
      mem,
      remember(readCache(mem), {
        candidateId,
        position,
        suggestion: { ...s, generatedAt: 0 },
        adoptedAt,
      }),
    );

    // 3) Both keys now reflect the adopted entry.
    expect(mem.getItem(HISTORY_KEY)).toBeTruthy();
    expect(mem.getItem(CACHE_KEY)).toBeTruthy();
    expect(readHistory(mem).entries.length).toBe(1);
    expect(readCache(mem).candidates[candidateId]?.length).toBe(1);

    // 4) recallCandidate returns the latest cached suggestion.
    const cache = readCache(mem);
    expect(recallCandidate(cache, candidateId)?.id).toBe('shared-1');
    expect(recallCandidate(cache, candidateId)?.generatedAt).toBe(adoptedAt);
    expect(recallPosition(cache, position)?.id).toBe('shared-1');
    expect(recallPosition(cache, position)?.generatedAt).toBe(adoptedAt);
  });

  it('forgetting one key does not affect the other (independent stores)', () => {
    const mem = new MemoryStorage();
    writeHistory(
      mem,
      appendAdopted(readHistory(mem), buildAdoption({
        suggestion: makeSuggestion({ id: 'keep' }),
        sessionId: 'ct_alice',
        candidateName: 'Alice',
        position: 'FE',
      })),
    );
    expect(readHistory(mem).entries.length).toBe(1);

    // Now wipe the history only — cache should be untouched.
    mem.removeItem(HISTORY_KEY);
    expect(readHistory(mem).entries.length).toBe(0);
    expect(mem.getItem(CACHE_KEY)).toBeNull(); // nothing written to cache yet
  });

  it('cache candidates and positions stay aligned via remember()', () => {
    const mem = new MemoryStorage();
    const s = makeSuggestion({ id: 'aligned-1' });
    const cache = remember(readCache(mem), {
      candidateId: 'ct_x',
      position: 'P1',
      suggestion: s,
      adoptedAt: 1717500000050,
    });
    writeCache(mem, cache);

    const back = readCache(mem);
    expect(back.candidates.ct_x?.[0]?.id).toBe('aligned-1');
    expect(back.positions.P1?.[0]?.id).toBe('aligned-1');

    // Now write a *new* suggestion under the same two keys — verify both
    // prepend to the head AND stay in sync.
    const s2 = makeSuggestion({ id: 'aligned-2' });
    const cache2 = remember(back, {
      candidateId: 'ct_x',
      position: 'P1',
      suggestion: s2,
      adoptedAt: 1717500000100,
    });
    writeCache(mem, cache2);

    const back2 = readCache(mem);
    expect(back2.candidates.ct_x?.[0]?.id).toBe('aligned-2');
    expect(back2.candidates.ct_x?.[1]?.id).toBe('aligned-1');
    expect(back2.positions.P1?.[0]?.id).toBe('aligned-2');
    expect(back2.positions.P1?.[1]?.id).toBe('aligned-1');
  });

  it('recallCandidate from an empty cache returns null without throwing', () => {
    const mem = new MemoryStorage();
    expect(readCache(mem)).toEqual(emptyCache());
    expect(recallCandidate(readCache(mem), 'unknown')).toBeNull();
  });

  it('rememberCandidate / rememberPosition direct calls still work without adoptedAt', () => {
    const mem = new MemoryStorage();
    let cache = emptyCache();
    cache = rememberCandidate(cache, 'a', makeSuggestion({ id: 'x' }));
    cache = rememberPosition(cache, 'Z', makeSuggestion({ id: 'y' }));
    writeCache(mem, cache);
    expect(readCache(mem).candidates.a?.[0]?.id).toBe('x');
    expect(readCache(mem).positions.Z?.[0]?.id).toBe('y');
  });
});
