// V178: EvalFixture JSON loader.
//
// `loadFixturesFromJson()` accepts a string (raw JSON), an object
// (already-parsed JSON), or a `{ fixtures: ... }` envelope. It validates
// every entry against the EvalFixture shape (V175) and surfaces
// problems in a structured `LoadResult` so callers can decide whether
// to log + skip or fail loudly.
//
// Designed for two flows:
//   * Browser: paste a `fixtures.json` blob from clipboard / IndexedDB.
//   * Node / CI: read fixtures from disk, then call `loadFixturesFromJson(text)`.

import type { EvalFixture } from './eval-harness';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface LoadError {
  /** Zero-based index of the offending entry in the original payload. */
  readonly index: number;
  /** Path within the offending entry that failed validation. */
  readonly path: string;
  /** Human-readable error message. */
  readonly message: string;
}

export interface LoadResult {
  readonly fixtures: ReadonlyArray<EvalFixture>;
  readonly errors: ReadonlyArray<LoadError>;
  /** Counts for diagnostics. */
  readonly total: number;
  readonly accepted: number;
}

/** Accepted top-level shapes. */
export interface RootJson {
  fixtures?: unknown;
}

export interface FixtureJson {
  id?: unknown;
  label?: unknown;
  input?: unknown;
  expected?: unknown;
}

export interface InputJson {
  sessionId?: unknown;
  position?: unknown;
  candidateName?: unknown;
  previousQuestions?: unknown;
  recentTranscript?: unknown;
  evaluationHistory?: unknown;
  trigger?: unknown;
}

export interface TriggerJson {
  kind?: unknown;
  elapsedMs?: unknown;
}

export interface ExpectedJson {
  questionEquals?: unknown;
  questionContains?: unknown;
  questionMatches?: unknown;
  focusTag?: unknown;
  difficulty?: unknown;
  rationaleContains?: unknown;
  similarityAtLeast?: unknown;
  baselineQuestion?: unknown;
}

export interface ChunkJson {
  text?: unknown;
  speaker?: unknown;
  timestamp?: unknown;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Top-level entry point. Accepts JSON text or a parsed object.
 * Always returns a `LoadResult`; never throws on schema errors.
 * Throws only on truly malformed JSON (string starting with non-JSON).
 */
export function loadFixturesFromJson(input: string | unknown): LoadResult {
  const root = parseRoot(input);
  const rawList = readFixtures(root);
  const errors: LoadError[] = [];
  const fixtures: EvalFixture[] = [];
  rawList.forEach((entry, index) => {
    const result = normaliseFixture(entry, index);
    if (result.kind === 'ok') fixtures.push(result.fixture);
    else errors.push(...result.errors);
  });
  return {
    fixtures,
    errors,
    total: rawList.length,
    accepted: fixtures.length,
  };
}

/**
 * Return only the accepted fixtures, dropping error entries silently.
 * Useful for happy-path CLI loading.
 */
export function loadFixturesOnly(input: string | unknown): ReadonlyArray<EvalFixture> {
  return loadFixturesFromJson(input).fixtures;
}

function parseRoot(input: string | unknown): RootJson {
  let raw: unknown;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      throw new Error(`invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    raw = input;
  }
  if (raw === null || typeof raw !== 'object') return {};
  return raw as RootJson;
}

function readFixtures(root: RootJson): unknown[] {
  if (!Array.isArray(root.fixtures)) return [];
  return root.fixtures as unknown[];
}

type NormaliseResult =
  | { kind: 'ok'; fixture: EvalFixture }
  | { kind: 'errors'; errors: LoadError[] };

function normaliseFixture(entry: unknown, index: number): NormaliseResult {
  const errors: LoadError[] = [];
  const fixture: { id?: string; label?: string; input?: unknown; expected?: unknown } = {};

  // id — required string
  const idRaw = readProp(entry, 'id');
  if (typeof idRaw === 'string') fixture.id = idRaw;
  else errors.push(mkError(index, 'id', 'must be a string'));

  // label — optional string
  const labelRaw = readProp(entry, 'label');
  if (labelRaw === undefined) fixture.label = undefined;
  else if (typeof labelRaw === 'string') fixture.label = labelRaw;
  else errors.push(mkError(index, 'label', 'when present, must be a string'));

  // input — required object
  const inputRaw = readProp(entry, 'input');
  const inputResult = normaliseInput(inputRaw, index);
  if (inputResult.kind === 'errored') errors.push(...inputResult.errors);
  else if (inputResult.input) fixture.input = inputResult.input;

  // expected — required object
  const expectedRaw = readProp(entry, 'expected');
  const expectedResult = normaliseExpected(expectedRaw, index);
  if (expectedResult.kind === 'errored') errors.push(...expectedResult.errors);
  else if (expectedResult.expected) fixture.expected = expectedResult.expected;

  // Pipeline: missing fields → drop the entry, errors keep their
  // own context so callers can debug.
  if (!fixture.id || !fixture.input || !fixture.expected) {
    // Required-field errors already produced — surface them but skip
    // adding more.
    return { kind: 'errors', errors };
  }

  if (errors.length > 0) return { kind: 'errors', errors };
  return {
    kind: 'ok',
    fixture: {
      id: fixture.id,
      label: fixture.label,
      input: fixture.input,
      expected: fixture.expected,
    } as EvalFixture,
  };
}

type InputResult =
  | { kind: 'ok'; input?: unknown }
  | { kind: 'errored'; errors: LoadError[] };

function normaliseInput(raw: unknown, index: number): InputResult {
  if (raw === undefined || raw === null) {
    return { kind: 'errored', errors: [mkError(index, 'input', 'must be an object')] };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'errored', errors: [mkError(index, 'input', 'must be an object')] };
  }
  const obj = raw as InputJson;
  const errors: LoadError[] = [];
  const input: Record<string, unknown> = {};

  if (typeof obj.sessionId !== 'string') errors.push(mkError(index, 'input.sessionId', 'must be a string'));
  else input['sessionId'] = obj.sessionId;

  if (typeof obj.position !== 'string') errors.push(mkError(index, 'input.position', 'must be a string'));
  else input['position'] = obj.position;

  if (typeof obj.candidateName !== 'string') errors.push(mkError(index, 'input.candidateName', 'must be a string'));
  else input['candidateName'] = obj.candidateName;

  if (!Array.isArray(obj.previousQuestions)) {
    errors.push(mkError(index, 'input.previousQuestions', 'must be an array (may be empty)'));
  } else {
    input['previousQuestions'] = obj.previousQuestions;
  }

  // recentTranscript: array of {text, speaker?, timestamp?}
  if (!Array.isArray(obj.recentTranscript)) {
    errors.push(mkError(index, 'input.recentTranscript', 'must be an array'));
  } else {
    const chunks = obj.recentTranscript as unknown[];
    const valid: unknown[] = [];
    chunks.forEach((chunk, ci) => {
      if (!chunk || typeof chunk !== 'object') {
        errors.push(mkError(index, `input.recentTranscript[${ci}]`, 'must be an object'));
        return;
      }
      const c = chunk as ChunkJson;
      if (typeof c.text !== 'string') {
        errors.push(mkError(index, `input.recentTranscript[${ci}].text`, 'must be a string'));
        return;
      }
      valid.push(chunk);
    });
    input['recentTranscript'] = valid;
  }

  if (!Array.isArray(obj.evaluationHistory)) {
    errors.push(mkError(index, 'input.evaluationHistory', 'must be an array'));
  } else {
    input['evaluationHistory'] = obj.evaluationHistory;
  }

  // trigger
  const triggerRaw = obj.trigger;
  if (!triggerRaw || typeof triggerRaw !== 'object' || Array.isArray(triggerRaw)) {
    errors.push(mkError(index, 'input.trigger', 'must be an object with `kind`'));
  } else {
    const t = triggerRaw as TriggerJson;
    if (t.kind === 'manual' || t.kind === 'content-shift' || t.kind === 'time-based') {
      input['trigger'] = t;
    } else {
      errors.push(mkError(index, 'input.trigger.kind', 'must be manual|content-shift|time-based'));
    }
  }

  if (errors.length > 0) return { kind: 'errored', errors };
  return { kind: 'ok', input };
}

type ExpectedResult =
  | { kind: 'ok'; expected?: unknown }
  | { kind: 'errored'; errors: LoadError[] };

function normaliseExpected(raw: unknown, index: number): ExpectedResult {
  if (raw === undefined || raw === null) {
    return { kind: 'errored', errors: [mkError(index, 'expected', 'must be an object')] };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'errored', errors: [mkError(index, 'expected', 'must be an object')] };
  }
  const obj = raw as ExpectedJson;
  const errors: LoadError[] = [];
  const expected: Record<string, unknown> = {};

  if (obj.questionEquals !== undefined) {
    if (typeof obj.questionEquals !== 'string') {
      errors.push(mkError(index, 'expected.questionEquals', 'must be a string'));
    } else expected['questionEquals'] = obj.questionEquals;
  }

  if (obj.questionContains !== undefined) {
    if (typeof obj.questionContains !== 'string') {
      errors.push(mkError(index, 'expected.questionContains', 'must be a string'));
    } else expected['questionContains'] = obj.questionContains;
  }

  if (obj.questionMatches !== undefined) {
    if (typeof obj.questionMatches !== 'string') {
      errors.push(mkError(index, 'expected.questionMatches', 'must be a regex source string'));
    } else expected['questionMatches'] = obj.questionMatches;
  }

  if (obj.focusTag !== undefined) {
    if (
      obj.focusTag !== 'technical'
      && obj.focusTag !== 'communication'
      && obj.focusTag !== 'problemSolving'
      && obj.focusTag !== 'culture'
    ) {
      errors.push(mkError(index, 'expected.focusTag', 'must be technical|communication|problemSolving|culture'));
    } else expected['focusTag'] = obj.focusTag;
  }

  if (obj.difficulty !== undefined) {
    if (obj.difficulty !== 'easy' && obj.difficulty !== 'medium' && obj.difficulty !== 'hard') {
      errors.push(mkError(index, 'expected.difficulty', 'must be easy|medium|hard'));
    } else expected['difficulty'] = obj.difficulty;
  }

  if (obj.rationaleContains !== undefined) {
    if (typeof obj.rationaleContains !== 'string') {
      errors.push(mkError(index, 'expected.rationaleContains', 'must be a string'));
    } else expected['rationaleContains'] = obj.rationaleContains;
  }

  if (obj.similarityAtLeast !== undefined) {
    if (typeof obj.similarityAtLeast !== 'number' || obj.similarityAtLeast < 0 || obj.similarityAtLeast > 1) {
      errors.push(mkError(index, 'expected.similarityAtLeast', 'must be a number in [0, 1]'));
    } else expected['similarityAtLeast'] = obj.similarityAtLeast;
  }

  if (obj.baselineQuestion !== undefined) {
    if (typeof obj.baselineQuestion !== 'string') {
      errors.push(mkError(index, 'expected.baselineQuestion', 'must be a string'));
    } else expected['baselineQuestion'] = obj.baselineQuestion;
  }

  if (errors.length > 0) return { kind: 'errored', errors };
  if (Object.keys(expected).length === 0) {
    return { kind: 'errored', errors: [mkError(index, 'expected', 'must declare at least one assertion')] };
  }
  return { kind: 'ok', expected };
}

function mkError(index: number, path: string, message: string): LoadError {
  return { index, path, message };
}

function readProp(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}
