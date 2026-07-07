// V165: QuestionSuggestionHistory tests — adoption history persistence and
// panel rendering.
//
// Two surfaces under test:
//   1. Pure helper (history.ts): readHistory / writeHistory / appendAdopted /
//      clearHistory / removeAdopted / buildAdoption / exportHistoryJson
//   2. Panel (QuestionSuggestionHistory.tsx): rendering, remove/clear/export

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, within, cleanup, act } from '@testing-library/react';
import { QuestionSuggestionHistory } from '../src/components/interview/QuestionSuggestionHistory';
import {
  appendAdopted,
  buildAdoption,
  clearHistory,
  exportHistoryJson,
  MAX_ENTRIES,
  readHistory,
  removeAdopted,
  STORAGE_KEY,
  writeHistory,
  type AdoptedSuggestion,
  type HistoryFile,
} from '../src/lib/question-suggestion/history';
import type { QuestionSuggestion } from '../src/lib/question-suggestion/types';

const NOW = new Date('2026-07-04T10:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

// ---------- in-memory storage ----------

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
    id: 'sg_v165_1',
    question: '能详细讲讲你最近一个项目的技术栈选型过程吗？',
    rationale: '探查技术深度',
    focusTag: 'technical',
    difficulty: 'medium',
    followUpHints: ['跟问 1', '跟问 2'],
    generatedAt: 1700000000000,
    ...over,
  };
}

function makeAdoption(over: Partial<AdoptedSuggestion> = {}): AdoptedSuggestion {
  return {
    suggestionId: 'sg_v165_1',
    question: '能详细讲讲你最近一个项目的技术栈选型过程吗？',
    rationale: '探查技术深度',
    focusTag: 'technical',
    difficulty: 'medium',
    adoptedAt: 1700000000000,
    sessionId: 'ct_alice',
    candidateName: 'Alice',
    position: 'Senior Frontend',
    ...over,
  };
}

// ---------- pure helper tests ----------

describe('history.ts pure helpers', () => {
  it('readHistory returns empty file when storage is null', () => {
    const file = readHistory(null);
    expect(file.version).toBe(1);
    expect(file.entries).toEqual([]);
  });

  it('writeHistory is a no-op when storage is null', () => {
    const next = appendAdopted({ version: 1, entries: [] }, makeAdoption());
    const result = writeHistory(null, next);
    expect(result).toBe(next);
  });

  it('writeHistory survives storage.setItem throwing (e.g. quota exceeded)', () => {
    const mem = new MemoryStorage();
    mem.setItem = () => { throw new Error('QuotaExceededError'); };
    const file = appendAdopted({ version: 1, entries: [] }, makeAdoption());
    let out;
    expect(() => { out = writeHistory(mem, file); }).not.toThrow();
    expect(out).toBe(file);
  });

  it('appendAdopted prepends newest-first and caps at MAX_ENTRIES', () => {
    let file: HistoryFile = { version: 1, entries: [] };
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      file = appendAdopted(file, makeAdoption({ suggestionId: `sg_${i}`, adoptedAt: i }));
    }
    expect(file.entries.length).toBe(MAX_ENTRIES);
    expect(file.entries[0]?.suggestionId).toBe(`sg_${MAX_ENTRIES + 4}`);
    expect(file.entries[file.entries.length - 1]?.suggestionId).toBe(`sg_5`);
  });

  it('clearHistory and removeAdopted return the expected file shape', () => {
    const a = makeAdoption({ suggestionId: 'sg_a' });
    const b = makeAdoption({ suggestionId: 'sg_b' });
    const file = appendAdopted(appendAdopted({ version: 1, entries: [] }, a), b);
    expect(file.entries.map((e) => e.suggestionId)).toEqual(['sg_b', 'sg_a']);

    const cleared = clearHistory();
    expect(cleared.entries).toEqual([]);

    const removed = removeAdopted(file, 'sg_a');
    expect(removed.entries.map((e) => e.suggestionId)).toEqual(['sg_b']);
  });

  it('buildAdoption copies suggestion fields and applies defaults', () => {
    const s = makeSuggestion({ id: 'sg_x', focusTag: undefined, followUpHints: undefined });
    const built = buildAdoption({
      suggestion: s,
      sessionId: 'ct_bob',
      candidateName: 'Bob',
      position: 'Staff',
      adoptedAt: 12345,
    });
    expect(built.suggestionId).toBe('sg_x');
    expect(built.question).toBe(s.question);
    expect(built.focusTag).toBeUndefined();
    expect(built.adoptedAt).toBe(12345);
  });

  it('buildAdoption falls back to Date.now() when adoptedAt is omitted', async () => {
    const before = Date.now();
    const built = buildAdoption({
      suggestion: makeSuggestion({ focusTag: 'culture' }),
      sessionId: 'ct_alice',
      candidateName: 'Alice',
      position: 'FE',
    });
    const after = Date.now();
    expect(built.adoptedAt).toBeGreaterThanOrEqual(before);
    expect(built.adoptedAt).toBeLessThanOrEqual(after);
    expect(built.focusTag).toBe('culture');
  });

  it('exportHistoryJson produces a pretty-printed JSON string with the expected shape', () => {
    const file = appendAdopted({ version: 1, entries: [] }, makeAdoption({ suggestionId: 'sg_x' }));
    const json = exportHistoryJson(file);
    expect(json).toContain('\n  "version": 1');
    expect(json).toContain('"suggestionId": "sg_x"');
  });

  it('readHistory ignores malformed JSON and falls back to empty', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORAGE_KEY, '{not json');
    expect(readHistory(mem).entries).toEqual([]);

    mem.setItem(STORAGE_KEY, JSON.stringify({ version: 2, entries: [] }));
    expect(readHistory(mem).entries).toEqual([]);

    mem.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: [{ bad: 'shape' }] }));
    expect(readHistory(mem).entries).toEqual([]);

    // force the type-guard false branches: nulls / numbers / strings slip
    // through the JSON parse, then the shape guard rejects them.
    mem.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          null,
          42,
          'string-not-object',
          { suggestionId: 'p', question: 'q', rationale: 'r', difficulty: 'easy', adoptedAt: 1, sessionId: 's', candidateName: 'n', position: 'p' },
        ],
      }),
    );
    const kept = readHistory(mem).entries.map((e) => e.suggestionId);
    expect(kept).toEqual(['p']);
  });
});

// ---------- panel tests ----------

describe('QuestionSuggestionHistory panel', () => {
  let mem: MemoryStorage;
  beforeEach(() => {
    mem = new MemoryStorage();
  });

  it('shows empty state when storage has no entries', () => {
    render(<QuestionSuggestionHistory storage={mem} />);
    expect(screen.getByTestId('qsh-empty')).toBeTruthy();
    expect(screen.getByText(/暂无采纳历史/)).toBeTruthy();
  });

  it('renders adopted entries newest-first with question + metadata', () => {
    // Storage convention: entries are stored newest-first (matches appendAdopted).
    mem.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          makeAdoption({ suggestionId: 'sg_second', adoptedAt: 200, question: '第二题' }),
          makeAdoption({ suggestionId: 'sg_first', adoptedAt: 100, question: '第一题' }),
        ],
      }),
    );

    render(<QuestionSuggestionHistory storage={mem} />);

    const list = screen.getByTestId('qsh-list');
    const items = within(list).getAllByTestId('qsh-entry');
    expect(items.length).toBe(2);
    // newest-first by storage order
    expect(items[0]?.getAttribute('data-suggestion-id')).toBe('sg_second');
    expect(items[1]?.getAttribute('data-suggestion-id')).toBe('sg_first');
    expect(within(items[0]!).getByTestId('qsh-entry-question').textContent).toContain('第二题');
  });

  it('clear button empties the panel and storage', () => {
    mem.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: [makeAdoption()] }));
    render(<QuestionSuggestionHistory storage={mem} />);

    const clearBtn = screen.getByTestId('qsh-clear');
    fireEvent.click(clearBtn);

    expect(screen.getByTestId('qsh-empty')).toBeTruthy();
    expect(readHistory(mem).entries).toEqual([]);
  });

  it('per-entry remove deletes that single entry', () => {
    mem.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          makeAdoption({ suggestionId: 'sg_keep' }),
          makeAdoption({ suggestionId: 'sg_drop' }),
        ],
      }),
    );
    render(<QuestionSuggestionHistory storage={mem} />);

    const list = screen.getByTestId('qsh-list');
    const dropItem = list.querySelector('[data-suggestion-id="sg_drop"]') as HTMLElement;
    fireEvent.click(within(dropItem).getByTestId('qsh-entry-remove'));

    const after = readHistory(mem).entries.map((e) => e.suggestionId);
    expect(after).toEqual(['sg_keep']);
  });

  it('export button triggers a Blob download with the JSON payload', () => {
    mem.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [makeAdoption({ suggestionId: 'sg_x' })] }),
    );
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = click;
      }
      return el;
    });
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;

    render(<QuestionSuggestionHistory storage={mem} />);
    fireEvent.click(screen.getByTestId('qsh-export'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
  });
});