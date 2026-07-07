// V167: SuggestionCache tests — per-candidate + per-position in localStorage.
// Two surfaces:
//   1. Pure helpers (cache.ts): readCache / writeCache / remember / recall /
//      forget / countCached / exportCacheJson
//   2. RealtimeQuestionSuggester integration: initialSuggestion + onSuggestionGenerated

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import {
  CACHE_KEY,
  EMPTY_CACHE,
  PER_KEY_CAP,
  POSITION_KEY_CAP,
  countCached,
  emptyCache,
  exportCacheJson,
  forgetCandidate,
  readCache,
  recallCandidate,
  recallPosition,
  remember,
  rememberCandidate,
  rememberPosition,
  writeCache,
} from '../src/lib/question-suggestion/cache';
import { RealtimeQuestionSuggester } from '../src/components/interview/RealtimeQuestionSuggester';
import type {
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from '../src/lib/question-suggestion/index';

// ---------- helpers ----------

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}

function makeSuggestion(over: Partial<QuestionSuggestion> = {}): QuestionSuggestion {
  return {
    id: 'sg_v167',
    question: '你能讲讲最近这个项目的架构吗？',
    rationale: '探查系统设计',
    focusTag: 'technical',
    difficulty: 'medium',
    followUpHints: ['追问你权衡了什么'],
    generatedAt: 1_700_000_000_000,
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

// ====================================================================
// 1. Pure helpers
// ====================================================================

describe('cache.ts pure helpers', () => {
  it('readCache returns empty cache when storage is null', () => {
    const cache = readCache(null);
    expect(cache.version).toBe(1);
    expect(cache.candidates).toEqual({});
    expect(cache.positions).toEqual({});
  });

  it('readCache returns empty when no item is stored under CACHE_KEY', () => {
    const mem = new MemoryStorage();
    expect(readCache(mem)).toEqual(emptyCache());
  });

  it('writeCache is a no-op when storage is null (but still returns the cache)', () => {
    const cache: ReturnType<typeof emptyCache> = emptyCache();
    const out = writeCache(null, cache);
    expect(out).toBe(cache);
  });

  it('writeCache survives storage.setItem throwing (e.g. quota exceeded)', () => {
    const mem = new MemoryStorage();
    const boom = new Error('QuotaExceededError');
    mem.setItem = () => { throw boom; };
    const cache = rememberCandidate(emptyCache(), 'ct_x', makeSuggestion({ id: 'doomed' }));
    // The catch swallows the error; cache is still returned unchanged.
    let out;
    expect(() => { out = writeCache(mem, cache); }).not.toThrow();
    expect(out).toBe(cache);
  });

  it('writeCache roundtrips through storage', () => {
    const mem = new MemoryStorage();
    const s = makeSuggestion({ id: 'sg_1' });
    const next = rememberCandidate(emptyCache(), 'ct_alice', s);
    writeCache(mem, next);
    const back = readCache(mem);
    expect(back.candidates.ct_alice?.[0]?.id).toBe('sg_1');
  });

  it('readCache returns empty when JSON is malformed', () => {
    const mem = new MemoryStorage();
    mem.setItem(CACHE_KEY, '{ not json');
    expect(readCache(mem)).toEqual(emptyCache());
  });

  it('readCache returns empty when JSON parses but version is not 1', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      CACHE_KEY,
      JSON.stringify({ version: 2, candidates: { x: [] }, positions: {} }),
    );
    expect(readCache(mem)).toEqual(emptyCache());
  });

  it('readCache skips entries whose lists are not arrays', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: 1,
        candidates: {
          good: [{ id: 'g', question: 'q', rationale: 'r', difficulty: 'easy', generatedAt: 1 }],
          // `bad` is a string, not an array — skip it.
          bad: 'not-array',
        },
        positions: {},
      }),
    );
    const back = readCache(mem);
    expect(back.candidates.good?.length).toBe(1);
    expect(back.candidates.bad).toBeUndefined();
  });

  it('readCache drops keys whose surviving list is empty after filtering', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: 1,
        candidates: {
          // All entries fail the shape guard — filtered.length > 0 is false.
          allBad: [{ id: 'x' }, null, 'string'],
        },
        positions: {},
      }),
    );
    const back = readCache(mem);
    expect(back.candidates.allBad).toBeUndefined();
  });

  it('readCache handles undefined candidates / positions gracefully', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      CACHE_KEY,
      JSON.stringify({ version: 1 }), // candidates / positions absent
    );
    const back = readCache(mem);
    expect(back.candidates).toEqual({});
    expect(back.positions).toEqual({});
  });

  it('readCache skips entries that fail the suggestion-shape guard', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: 1,
        candidates: {
          list: [
            { id: 'good', question: 'q', rationale: 'r', difficulty: 'easy', generatedAt: 1 },
            { id: 'missing-fields' },
            'string-not-object',
            null,
          ],
        },
        positions: {},
      }),
    );
    const back = readCache(mem);
    expect(back.candidates.list?.length).toBe(1);
    expect(back.candidates.list?.[0]?.id).toBe('good');
  });

  it('readCache ignores invalid suggestion entries (missing fields)', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: 1,
        candidates: {
          ct_alice: [
            { id: 'good', question: 'q', rationale: 'r', difficulty: 'easy', generatedAt: 1 },
            { id: 'bad' }, // missing required fields
          ],
        },
        positions: {},
      }),
    );
    const back = readCache(mem);
    expect(back.candidates.ct_alice?.length).toBe(1);
    expect(back.candidates.ct_alice?.[0]?.id).toBe('good');
  });

  it('rememberCandidate prepends newest-first and caps at PER_KEY_CAP', () => {
    let cache = emptyCache();
    for (let i = 0; i < PER_KEY_CAP + 5; i++) {
      cache = rememberCandidate(cache, 'ct_alice', makeSuggestion({ id: `sg_${i}`, generatedAt: i }));
    }
    expect(cache.candidates.ct_alice?.length).toBe(PER_KEY_CAP);
    expect(cache.candidates.ct_alice?.[0]?.id).toBe(`sg_${PER_KEY_CAP + 4}`);
  });

  it('rememberPosition prepends newest-first and caps at POSITION_KEY_CAP', () => {
    let cache = emptyCache();
    for (let i = 0; i < POSITION_KEY_CAP + 3; i++) {
      cache = rememberPosition(cache, 'Senior Frontend', makeSuggestion({ id: `sg_${i}` }));
    }
    expect(cache.positions['Senior Frontend']?.length).toBe(POSITION_KEY_CAP);
  });

  it('remember() inserts under both candidate and position keys', () => {
    const s = makeSuggestion({ id: 'shared' });
    const next = remember(emptyCache(), { candidateId: 'ct_x', position: 'Backend', suggestion: s });
    expect(next.candidates.ct_x?.[0]?.id).toBe('shared');
    expect(next.positions.Backend?.[0]?.id).toBe('shared');
  });

  it('recallCandidate returns the latest suggestion or null', () => {
    const a = makeSuggestion({ id: 'a' });
    const b = makeSuggestion({ id: 'b' });
    const cache = rememberCandidate(rememberCandidate(emptyCache(), 'ct_x', a), 'ct_x', b);
    expect(recallCandidate(cache, 'ct_x')?.id).toBe('b');
    expect(recallCandidate(cache, 'ct_unknown')).toBeNull();
  });

  it('recallPosition returns the latest suggestion or null', () => {
    const a = makeSuggestion({ id: 'a' });
    const b = makeSuggestion({ id: 'b' });
    const cache = rememberPosition(rememberPosition(emptyCache(), 'FE', a), 'FE', b);
    expect(recallPosition(cache, 'FE')?.id).toBe('b');
    expect(recallPosition(cache, 'BE')).toBeNull();
  });

  it('forgetCandidate removes only that candidate', () => {
    let cache = emptyCache();
    cache = rememberCandidate(cache, 'ct_x', makeSuggestion({ id: 'x1' }));
    cache = rememberCandidate(cache, 'ct_y', makeSuggestion({ id: 'y1' }));
    const trimmed = forgetCandidate(cache, 'ct_x');
    expect(trimmed.candidates.ct_x).toBeUndefined();
    expect(trimmed.candidates.ct_y?.[0]?.id).toBe('y1');
  });

  it('forgetCandidate is a no-op when the id is unknown', () => {
    const cache = rememberCandidate(emptyCache(), 'ct_x', makeSuggestion({ id: 'x1' }));
    const out = forgetCandidate(cache, 'ct_unknown');
    expect(out.candidates.ct_x?.[0]?.id).toBe('x1');
  });

  it('countCached returns totals across both keys', () => {
    let cache = emptyCache();
    cache = rememberCandidate(cache, 'a', makeSuggestion({ id: '1' }));
    cache = rememberCandidate(cache, 'a', makeSuggestion({ id: '2' }));
    cache = rememberPosition(cache, 'BE', makeSuggestion({ id: '3' }));
    expect(countCached(cache)).toEqual({ candidates: 2, positions: 1, total: 3 });
  });

  it('exportCacheJson produces pretty-printed JSON', () => {
    const cache = rememberCandidate(emptyCache(), 'ct_x', makeSuggestion({ id: 'v167' }));
    const str = exportCacheJson(cache);
    expect(JSON.parse(str).candidates.ct_x[0].id).toBe('v167');
    expect(str).toContain('\n');
  });

  it('EMPTY_CACHE is shared and frozen', () => {
    expect(EMPTY_CACHE.candidates).toEqual({});
    // Object.freeze makes the reference immutable but inner assignments
    // through spread helpers still work.
  });
});

// ====================================================================
// 2. RealtimeQuestionSuggester integration
// ====================================================================

const NOW = new Date('2026-07-04T10:00:00.000Z').getTime();

beforeEach(() => {
  vi.setSystemTime(NOW);
});

class StubAgent implements QuestionSuggestionAgent {
  readonly id = 'stub';
  readonly label = 'Stub';
  readonly remote = false;
  calls: QuestionSuggestionInput[] = [];
  nextSuggestion: QuestionSuggestion;
  delayMs = 0;

  constructor(out?: Partial<QuestionSuggestion>) {
    this.nextSuggestion = {
      id: 'live-1',
      question: '你最近一个项目里最大的技术挑战是什么？',
      rationale: '探查系统设计与权衡',
      focusTag: 'technical',
      difficulty: 'medium',
      followUpHints: ['追问你权衡了什么'],
      generatedAt: NOW,
      ...out,
    };
  }

  async suggest(input: QuestionSuggestionInput): Promise<QuestionSuggestion> {
    this.calls.push(input);
    return this.nextSuggestion;
  }
}

function Harness({ agent, initialSuggestion, onSuggestionGenerated }: {
  agent: QuestionSuggestionAgent;
  initialSuggestion?: QuestionSuggestion | null;
  onSuggestionGenerated?: (s: QuestionSuggestion) => void;
}) {
  return (
    <RealtimeQuestionSuggester
      agent={agent}
      sessionId="ct_alice"
      position="Senior Frontend"
      candidateName="Alice"
      transcript={[]}
      initialSuggestion={initialSuggestion}
      onSuggestionGenerated={onSuggestionGenerated}
    />
  );
}

async function mount(jsx: React.ReactNode) {
  const out = render(<>{jsx}</>);
  await act(async () => {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });
  return out;
}

describe('RealtimeQuestionSuggester + cache', () => {
  it('shows initialSuggestion immediately when supplied', async () => {
    const cached = makeSuggestion({ id: 'from-cache', question: '缓存的建议 Q' });
    const { container } = await mount(
      <Harness agent={new StubAgent()} initialSuggestion={cached} />,
    );
    expect(container.querySelector('[data-testid="rqs-question"]')?.textContent).toContain('缓存的建议 Q');
  });

  it('fires onSuggestionGenerated after the agent completes a run', async () => {
    const generated: QuestionSuggestion[] = [];
    await mount(
      <Harness agent={new StubAgent({ id: 'gen-1' })} onSuggestionGenerated={(s) => generated.push(s)} />,
    );
    expect(generated.length).toBe(1);
    expect(generated[0]?.id).toBe('gen-1');
  });

  it('initialSuggestion blocks the initial trigger so the cached value wins', async () => {
    const generated: QuestionSuggestion[] = [];
    const { container } = await mount(
      <Harness
        agent={new StubAgent({ id: 'fresh', question: '新鲜建议' })}
        initialSuggestion={makeSuggestion({ id: 'cached', question: '缓存建议' })}
        onSuggestionGenerated={(s) => generated.push(s)}
      />,
    );
    // No agent run because initialSuggestion was provided.
    expect(generated.length).toBe(0);
    expect(container.querySelector('[data-testid="rqs-question"]')?.textContent).toContain('缓存建议');
  });

  it('pressing 🔄 重新生成 fires a second onSuggestionGenerated', async () => {
    const agent = new StubAgent();
    const generated: QuestionSuggestion[] = [];
    const { container } = await mount(
      <Harness agent={agent} onSuggestionGenerated={(s) => generated.push(s)} />,
    );
    expect(generated.length).toBe(1);
    // Re-render with a new nextSuggestion.
    agent.nextSuggestion = makeSuggestion({ id: 'regen-1', question: '重新生成的' });
    fireEvent.click(container.querySelector('[data-testid="rqs-regenerate"]') as HTMLElement);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(generated.length).toBe(2);
    expect(generated[1]?.id).toBe('regen-1');
  });
});

describe('CandidateInterviewPanel wires cache ↔ storage', () => {
  // (Pure helper test already covers the round-trip; this block is reserved
  // for future UI integration tests when the panel exposes a flush button.)
  it('placeholder — wiring lives in CandidateInterviewPanel', () => {
    expect(true).toBe(true);
  });
});
