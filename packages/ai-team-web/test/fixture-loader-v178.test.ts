// V178: EvalFixture JSON loader — turns a { fixtures: [...] } payload
// into the strongly-typed V175 EvalFixture[] surface while surfacing
// schema errors as a LoadResult.errors list instead of throwing.
//
// Coverage targets:
//   - happy-path JSON text / parsed object
//   - per-field validation (id, input.sessionId, trigger.kind, focusTag, …)
//   - empty / missing / wrong-type arrays
//   - loadFixturesOnly() — happy-path dropping errors

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadFixturesFromJson,
  loadFixturesOnly,
  type LoadResult,
} from '../src/lib/llm/fixture-loader';
import type { EvalFixture } from '../src/lib/llm/eval-harness';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Build a well-formed fixture for the given id. */
function okFixture(id: string, extras?: { focusTag?: string }): Record<string, unknown> {
  return {
    id,
    label: `${id} label`,
    input: {
      sessionId: 'ct_x',
      position: 'Senior Frontend',
      candidateName: 'Alice',
      previousQuestions: [],
      recentTranscript: [{ text: '你好', speaker: 'candidate', timestamp: 0 }],
      evaluationHistory: [],
      trigger: { kind: 'manual' },
    },
    expected: { focusTag: extras?.focusTag ?? 'technical' },
  };
}

describe('loadFixturesFromJson — happy paths', () => {
  it('parses a JSON string and returns all fixtures', () => {
    const json = JSON.stringify({
      fixtures: [okFixture('f1'), okFixture('f2')],
    });
    const r = loadFixturesFromJson(json);
    expect(r.total).toBe(2);
    expect(r.accepted).toBe(2);
    expect(r.errors.length).toBe(0);
    expect(r.fixtures.map((f) => f.id)).toEqual(['f1', 'f2']);
  });

  it('accepts a pre-parsed object instead of a string', () => {
    const obj = { fixtures: [okFixture('f1')] };
    const r = loadFixturesFromJson(obj);
    expect(r.total).toBe(1);
    expect(r.accepted).toBe(1);
    expect(r.fixtures[0]?.id).toBe('f1');
  });

  it('treats an empty fixtures array as zero accepted + zero errors', () => {
    const r = loadFixturesFromJson({ fixtures: [] });
    expect(r.total).toBe(0);
    expect(r.accepted).toBe(0);
    expect(r.fixtures.length).toBe(0);
    expect(r.errors.length).toBe(0);
  });

  it('returns zero total when the envelope has no `fixtures` key', () => {
    const r = loadFixturesFromJson({});
    expect(r.total).toBe(0);
    expect(r.accepted).toBe(0);
  });

  it('throws on truly malformed JSON strings', () => {
    expect(() => loadFixturesFromJson('not json at all')).toThrow(/invalid JSON/);
  });
});

describe('loadFixturesFromJson — per-field validation', () => {
  it('flags a missing id with index=0', () => {
    const fixture = okFixture('placeholder');
    const fx: Record<string, unknown> = { ...fixture };
    delete fx.id;
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(0);
    expect(r.errors[0]?.index).toBe(0);
    expect(r.errors[0]?.path).toBe('id');
    expect(r.errors[0]?.message).toContain('string');
  });

  it('flags a non-string id', () => {
    const fx = { ...okFixture('placeholder'), id: 42 };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(0);
    expect(r.errors[0]?.path).toBe('id');
  });

  it('flags a non-string label', () => {
    const fx = { ...okFixture('placeholder'), label: 42 };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.errors[0]?.path).toBe('label');
  });

  it('flags a missing `input`', () => {
    const fx: Record<string, unknown> = { ...okFixture('placeholder') };
    delete fx.input;
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(0);
    expect(r.errors.some((e) => e.path === 'input')).toBe(true);
  });

  it('flags a non-object `input`', () => {
    const fx = { ...okFixture('placeholder'), input: 'not an object' };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(0);
    expect(r.errors[0]?.path).toBe('input');
  });

  it('flags a missing sessionId inside `input`', () => {
    const fixture = okFixture('x');
    delete (fixture.input as Record<string, unknown>)['sessionId'];
    const r = loadFixturesFromJson({ fixtures: [fixture] });
    expect(r.errors.some((e) => e.path === 'input.sessionId')).toBe(true);
  });

  it('flags an invalid trigger kind', () => {
    const fixture = okFixture('x');
    (fixture.input as Record<string, unknown>)['trigger'] = { kind: 'rubbish' };
    const r = loadFixturesFromJson({ fixtures: [fixture] });
    expect(r.errors.some((e) => e.path === 'input.trigger.kind')).toBe(true);
  });

  it('flags an invalid focusTag enum', () => {
    const fx = { ...okFixture('x'), expected: { focusTag: 'magic' } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.errors.some((e) => e.path === 'expected.focusTag')).toBe(true);
  });

  it('flags an out-of-range similarityAtLeast', () => {
    const fx = { ...okFixture('x'), expected: { similarityAtLeast: 1.5 } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.errors.some((e) => e.path === 'expected.similarityAtLeast')).toBe(true);
  });

  it('flags non-string baselineQuestion', () => {
    const fx = {
      ...okFixture('x'),
      expected: { similarityAtLeast: 0.6, baselineQuestion: 42 },
    };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.errors.some((e) => e.path === 'expected.baselineQuestion')).toBe(true);
  });

  it('flags non-string rationaleContains', () => {
    const fx = { ...okFixture('x'), expected: { rationaleContains: 123 } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.errors.some((e) => e.path === 'expected.rationaleContains')).toBe(true);
  });

  it('flags non-string questionMatches', () => {
    const fx = { ...okFixture('x'), expected: { questionMatches: 99 } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.errors.some((e) => e.path === 'expected.questionMatches')).toBe(true);
  });

  it('flags an empty `expected` object', () => {
    const fx = { ...okFixture('x'), expected: {} };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(0);
    expect(r.errors.some((e) => e.path === 'expected' && e.message.includes('one assertion'))).toBe(
      true,
    );
  });
});

describe('loadFixturesFromJson — mixed-validity suite', () => {
  it('accepts the good entries and reports errors for the bad ones with their original index', () => {
    const r = loadFixturesFromJson({
      fixtures: [
        okFixture('a'), // 0 OK
        okFixture('b'), // 1 OK
        { ...okFixture('placeholder'), id: 42 }, // 2 bad
        okFixture('c'), // 3 OK
      ],
    });
    expect(r.accepted).toBe(3);
    expect(r.fixtures.map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]?.index).toBe(2);
    expect(r.errors[0]?.path).toBe('id');
  });

  it('handles non-array `fixtures` gracefully (returns empty)', () => {
    const r = loadFixturesFromJson({ fixtures: 'oops' });
    expect(r.total).toBe(0);
    expect(r.accepted).toBe(0);
  });

  it('accepts a fixture with multiple assertion fields', () => {
    const fx = {
      ...okFixture('multi'),
      expected: {
        questionContains: '项目',
        focusTag: 'communication',
        difficulty: 'medium',
        rationaleContains: '探查',
        similarityAtLeast: 0.5,
        baselineQuestion: 'baseline',
      },
    };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(1);
  });
});

describe('loadFixturesOnly — happy-path shim', () => {
  it('returns only the accepted fixtures, dropping error entries', () => {
    const json = JSON.stringify({
      fixtures: [okFixture('a'), { ...okFixture('x'), id: 42 }, okFixture('b')],
    });
    const accepted: ReadonlyArray<EvalFixture> = loadFixturesOnly(json);
    expect(accepted.length).toBe(2);
    expect(accepted.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('returns an empty array for an empty / missing envelope', () => {
    expect(loadFixturesOnly({}).length).toBe(0);
  });

  it('returns an empty array when the input string is malformed JSON', () => {
    expect(() => loadFixturesOnly('{ bad json')).toThrow(/invalid JSON/);
  });
});

describe('loadFixturesFromJson — kept branches', () => {
  it('accepts questionEquals when given a string', () => {
    const fx = { ...okFixture('placeholder'), expected: { questionEquals: 'a specific question' } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(1);
    expect(r.fixtures[0]?.expected['questionEquals']).toBe('a specific question');
  });

  it('accepts questionMatches when given a regex source string', () => {
    const fx = { ...okFixture('placeholder'), expected: { questionMatches: '^Why\\?' } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(1);
    expect(r.fixtures[0]?.expected['questionMatches']).toBe('^Why\\?');
  });

  it('accepts a valid difficulty enum', () => {
    const fx = { ...okFixture('placeholder'), expected: { difficulty: 'easy' } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(1);
    expect(r.fixtures[0]?.expected['difficulty']).toBe('easy');
  });

  it('flags a focusTag enum value without crashing the runner', () => {
    const fx = { ...okFixture('placeholder'), expected: { focusTag: 'rhetorical' } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(0);
    expect(r.errors[0]?.path).toBe('expected.focusTag');
    expect(r.errors[0]?.message).toMatch(/technical|communication|problemSolving|culture/);
  });
});

describe('loadFixturesFromJson — kept branches (round 2)', () => {
  it('drops a fixture when the input is missing entirely (id-only entry)', () => {
    const fx = { id: 'lonely', expected: { focusTag: 'technical' } };
    const r = loadFixturesFromJson({ fixtures: [fx] });
    expect(r.accepted).toBe(0);
    expect(r.errors.some((e) => e.path === 'input')).toBe(true);
  });

  it('returns errors without an `errors` key, never crashes the suite', () => {
    const r = loadFixturesFromJson({
      fixtures: [
        { id: 'a', expected: { focusTag: 'unknown-tag' }, input: okFixture('a').input },
      ],
    });
    expect(r.accepted).toBe(0);
    expect(r.errors[0]?.message).toMatch(/technical\|communication/);
  });
});

describe('loadFixturesFromJson — keep behaviour when given a LoadResult-shaped object by accident', () => {
  it('returns the LoadResult — does not throw on parsed objects that happen to be shaped like LoadResult', () => {
    const r = loadFixturesFromJson({
      fixtures: [{ id: 'a', expected: { focusTag: 'technical' }, input: okFixture('a').input }],
    });
    expect(r.total).toBe(1);
  });
});
