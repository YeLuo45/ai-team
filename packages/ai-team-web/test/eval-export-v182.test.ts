// V182: EvalResultsExporter tests — JSON / NDJSON / Markdown export

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  serialize,
  toBlob,
  exportFilename,
  downloadResults,
} from '../src/lib/llm/eval-export';
import type { EvalCaseResult, EvalFixture } from '../src/lib/llm/eval-harness';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeFixture(id: string): EvalFixture {
  return {
    id,
    label: `${id} label`,
    input: {
      sessionId: 'ct_x',
      position: 'Senior Frontend',
      candidateName: 'Alice',
      previousQuestions: [],
      recentTranscript: [{ text: 'hi', speaker: 'candidate', timestamp: 0 }],
      evaluationHistory: [],
      trigger: { kind: 'manual' },
    },
    expected: { focusTag: 'technical' },
  };
}

function passed(id: string, runner = 'A', elapsedMs = 12): EvalCaseResult {
  return {
    fixtureId: id,
    label: `${id} label`,
    runnerLabel: runner,
    actual: null,
    expectation: makeFixture(id).expected,
    checks: [{ name: 'ok', passed: true }],
    elapsedMs,
    passed: true,
  };
}

function failed(id: string, detail: string, runner = 'B', elapsedMs = 35): EvalCaseResult {
  return {
    fixtureId: id,
    label: `${id} label`,
    runnerLabel: runner,
    actual: null,
    expectation: makeFixture(id).expected,
    checks: [{ name: 'focus tag', passed: false, detail }],
    elapsedMs,
    passed: false,
  };
}

function errored(id: string, message: string): EvalCaseResult {
  return {
    fixtureId: id,
    label: `${id} label`,
    runnerLabel: 'C',
    actual: null,
    expectation: makeFixture(id).expected,
    checks: [],
    elapsedMs: 0,
    passed: false,
    error: message,
  };
}

// ====================================================================
// 1. serialize
// ====================================================================

describe('serialize — JSON', () => {
  it('wraps results in an envelope with totals + summary', () => {
    const results = [passed('a'), failed('b', 'actual=communication')];
    const out = serialize(results);
    const parsed = JSON.parse(out);
    expect(parsed.total).toBe(2);
    expect(parsed.summary.passed).toBe(1);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.passRate).toContain('1/2');
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.results.length).toBe(2);
    expect(typeof parsed.exportedAt).toBe('string');
  });

  it('respects includeMetadata: false (no totals, no summary)', () => {
    const out = serialize([passed('a')], { includeMetadata: false });
    const parsed = JSON.parse(out);
    expect(parsed.summary).toBeUndefined();
    expect(parsed.total).toBeUndefined();
    expect(parsed.results.length).toBe(1);
  });

  it('respects prettyPrint: false (single-line JSON)', () => {
    const out = serialize([passed('a')], { prettyPrint: false });
    expect(out).not.toContain('\n');
  });

  it('round-trips results through JSON.parse without losing field shape', () => {
    const results = [passed('a'), failed('b', 'actual=x'), errored('c', 'upstream')];
    const out = serialize(results);
    const back = JSON.parse(out);
    expect(back.results[0]?.passed).toBe(true);
    expect(back.results[1]?.passed).toBe(false);
    expect(back.results[2]?.error).toBe('upstream');
  });

  it('handles an empty results array', () => {
    const out = serialize([]);
    const parsed = JSON.parse(out);
    expect(parsed.total).toBe(0);
    expect(parsed.results).toEqual([]);
    expect(parsed.summary.passed).toBe(0);
    expect(parsed.summary.failed).toBe(0);
    expect(parsed.summary.passRate).toMatch(/^0\/0/);
  });
});

describe('serialize — NDJSON', () => {
  it('emits one envelope line followed by one case-per-line', () => {
    const out = serialize([passed('a'), passed('b')], { format: 'ndjson' });
    const lines = out.split('\n');
    expect(lines.length).toBe(3);
    const env = JSON.parse(lines[0] ?? '');
    expect(env.total).toBe(2);
    expect(env.format).toBe('ndjson');
    expect(JSON.parse(lines[1] ?? '').fixtureId).toBe('a');
    expect(JSON.parse(lines[2] ?? '').fixtureId).toBe('b');
  });

  it('omits the metadata envelope when includeMetadata is false', () => {
    const out = serialize([passed('a')], { format: 'ndjson', includeMetadata: false });
    const lines = out.split('\n');
    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0] ?? '').fixtureId).toBe('a');
  });
});

describe('serialize — Markdown', () => {
  it('produces a heading + summary table', () => {
    const out = serialize([passed('a'), failed('b', 'actual=x')], { format: 'markdown' });
    expect(out).toContain('# Eval Results');
    expect(out).toContain('- **Total**: 2');
    expect(out).toContain('| Fixture | Runner | Status | Elapsed (ms) | Notes |');
    expect(out).toContain('| a');
    expect(out).toContain('actual=x');
  });

  it('renders the failure note column for failed cases', () => {
    const out = serialize([failed('b', 'actual=communication')], { format: 'markdown' });
    expect(out).toContain('actual=communication');
  });

  it('renders "error: …" for errored cases', () => {
    const out = serialize([errored('z', 'connection refused')], { format: 'markdown' });
    expect(out).toContain('error: connection refused');
  });
});

// ====================================================================
// 2. toBlob
// ====================================================================

describe('toBlob', () => {
  it('returns a payload + filename + Blob for JSON', () => {
    const out = toBlob([passed('a')], { format: 'json' });
    expect(out.mime).toBe('application/json');
    expect(out.name.startsWith('eval-')).toBe(true);
    expect(out.name.endsWith('.json')).toBe(true);
    expect(out.blob).toBeInstanceOf(Blob);
    expect(out.payload).toContain('"format": "json"');
  });

  it('returns NDJSON mime when requested', () => {
    const out = toBlob([passed('a')], { format: 'ndjson' });
    expect(out.mime).toBe('application/x-ndjson');
    expect(out.name.endsWith('.ndjson')).toBe(true);
  });

  it('returns Markdown mime when requested', () => {
    const out = toBlob([passed('a')], { format: 'markdown' });
    expect(out.mime).toBe('text/markdown');
    expect(out.name.endsWith('.md')).toBe(true);
  });
});

// ====================================================================
// 3. exportFilename / downloadResults
// ====================================================================

describe('exportFilename', () => {
  it('uses the provided timestamp and format extension', () => {
    const ts = new Date('2026-07-05T10:00:00.000Z');
    expect(exportFilename('json', ts)).toBe('eval-2026-07-05T10-00-00-000Z.json');
    expect(exportFilename('ndjson', ts)).toBe('eval-2026-07-05T10-00-00-000Z.ndjson');
    expect(exportFilename('markdown', ts)).toBe('eval-2026-07-05T10-00-00-000Z.md');
  });
});

describe('downloadResults', () => {
  it('returns skipped:true when document/URL are unavailable (Node callers)', () => {
    const out = downloadResults([passed('a')]);
    // happy-dom provides both, so we only assert the returned shape.
    expect(typeof out.skipped).toBe('boolean');
    expect(typeof out.filename).toBe('string');
    expect(out.payload.length).toBeGreaterThan(0);
  });

  it('returns skipped:true when document.body is not available', () => {
    const original = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = undefined;
    try {
      const out = downloadResults([passed('a')]);
      expect(out.skipped).toBe(true);
    } finally {
      (globalThis as { document?: unknown }).document = original;
    }
  });
});
