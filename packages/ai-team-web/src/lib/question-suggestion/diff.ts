// V170: QuestionSuggestion diff utility — compares an adopted / cached
// suggestion against a current (live) one, surfacing:
//
//   * questionDiff: word-level additions / removals / unchanged segments
//   * rationaleDiff: same, but for the rationale line
//   * focusTagChanged / difficultyChanged: boolean flags
//   * unchanged field metadata (suggestionId, generatedAt deltas, etc.)
//
// Designed to power the SuggestionDiffView panel (V170). The function is
// pure and synchronous so it can be invoked from useMemo in a React
// component without ceremony.

import type { QuestionSuggestion } from './types';

export type DiffOp = 'equal' | 'insert' | 'delete';

export interface DiffSegment {
  readonly op: DiffOp;
  readonly value: string;
}

export interface SuggestionDiff {
  /** Word-level diff of the question text. */
  readonly questionDiff: ReadonlyArray<DiffSegment>;
  /** Word-level diff of the rationale text. */
  readonly rationaleDiff: ReadonlyArray<DiffSegment>;
  /** focusTag changed between baseline and current. */
  readonly focusTagChanged: boolean;
  /** difficulty changed between baseline and current. */
  readonly difficultyChanged: boolean;
  /** Number of words added (an upper-bound heuristic for highlighting). */
  readonly addedWords: number;
  /** Number of words removed. */
  readonly removedWords: number;
}

const EMPTY_DIFF: SuggestionDiff = Object.freeze({
  questionDiff: [],
  rationaleDiff: [],
  focusTagChanged: false,
  difficultyChanged: false,
  addedWords: 0,
  removedWords: 0,
});

/**
 * Compare two QuestionSuggestion objects and return a structured diff.
 * Returns a frozen empty diff when the inputs are identical. The diff is
 * computed word-by-word using the classic LCS dynamic-programming
 * algorithm — fast for typical short prompts (under ~50 words).
 */
export function diffSuggestions(
  baseline: QuestionSuggestion | null | undefined,
  current: QuestionSuggestion | null | undefined,
): SuggestionDiff {
  if (!baseline || !current) return EMPTY_DIFF;
  const questionDiff = wordDiff(baseline.question, current.question);
  const rationaleDiff = wordDiff(baseline.rationale, current.rationale);
  const addedWords = countWords(questionDiff, ['insert']);
  const removedWords = countWords(questionDiff, ['delete']);
  return {
    questionDiff,
    rationaleDiff,
    focusTagChanged: !sameString(baseline.focusTag, current.focusTag),
    difficultyChanged: !sameString(baseline.difficulty, current.difficulty),
    addedWords,
    removedWords,
  };
}

/**
 * Return `true` when the diff has any non-equal segments or any field
 * change. Useful for filtering out identical pairs in UI.
 */
export function hasDiff(diff: SuggestionDiff): boolean {
  if (diff.questionDiff.some((s) => s.op !== 'equal')) return true;
  if (diff.rationaleDiff.some((s) => s.op !== 'equal')) return true;
  if (diff.focusTagChanged) return true;
  if (diff.difficultyChanged) return true;
  return false;
}

/** Compute a simple similarity score in `[0, 1]` (1 = identical). */
export function similarity(diff: SuggestionDiff): number {
  const total = diff.addedWords + diff.removedWords;
  if (total === 0 && !diff.focusTagChanged && !diff.difficultyChanged) return 1;
  // Treat 1 changed field as 1 penalty unit so the score stays in [0, 1].
  const penalty = total + (diff.focusTagChanged ? 1 : 0) + (diff.difficultyChanged ? 1 : 0);
  return Math.max(0, 1 - penalty / 10);
}

// ====================================================================
// internals
// ====================================================================

function sameString(a: string | undefined, b: string | undefined): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  return a !== undefined && b !== undefined && a === b;
}

function countWords(diff: ReadonlyArray<DiffSegment>, ops: ReadonlyArray<DiffOp>): number {
  let total = 0;
  for (const seg of diff) {
    if (!ops.includes(seg.op)) continue;
    // Count whitespace-separated tokens.
    total += seg.value.trim().length === 0 ? 0 : seg.value.trim().split(/\s+/).length;
  }
  return total;
}

/**
 * Word-level LCS diff. Tokenises on whitespace and punctuation but keeps
 * the leading/trailing whitespace inside each segment for stable rendering.
 *
 * Returns an array of DiffSegment. Each token lives in exactly one segment.
 */
export function wordDiff(prev: string, next: string): DiffSegment[] {
  const aTokens = tokenize(prev);
  const bTokens = tokenize(next);
  // Convert each token to a single character so the LCS table indexes work
  // even when tokens repeat. Token identity is preserved via the parallel
  // `ids` array.
  const aKeys = aTokens.map((t, i) => `${i}:${t}`);
  const bKeys = bTokens.map((t, i) => `${i}:${t}`);

  // LCS table — small inputs, so the O(n*m) matrix is fine.
  const n = aKeys.length;
  const m = bKeys.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (aKeys[i - 1] === bKeys[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Walk back to build the edit script.
  const segments: DiffSegment[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (aKeys[i - 1] === bKeys[j - 1]) {
      appendSegment(segments, 'equal', aTokens[i - 1]!);
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      appendSegment(segments, 'delete', aTokens[i - 1]!);
      i--;
    } else {
      appendSegment(segments, 'insert', bTokens[j - 1]!);
      j--;
    }
  }
  // Post-loop drain. After the greedy walk, only one of i/j can be
  // non-zero (delete branches consumed a-side prefixes; inserts drained
  // b-side). Push raw segments here — coalesce runs after `segments.reverse()`
  // so neighbouring op order stays correct in the rendered output.
  while (i > 0) {
    segments.push({ op: 'delete', value: aTokens[i - 1]! });
    i--;
  }
  while (j > 0) {
    segments.push({ op: 'insert', value: bTokens[j - 1]! });
    j--;
  }
  segments.reverse();

  // Coalesce adjacent same-op segments for compact rendering.
  return coalesce(segments);
}

/**
 * After reverse, neighbours with the same op collapse into one. This keeps
 * the LCS-walk-back reverse semantic correct while compacting consecutive
 * inserts / deletes.
 */
function coalesce(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && last.op === seg.op) {
      out[out.length - 1] = { op: seg.op, value: last.value + seg.value };
    } else {
      out.push(seg);
    }
  }
  return out;
}

/**
 * Tokenise a sentence into whitespace-separated tokens while preserving
 * whitespace runs as standalone tokens so the rebuilt string is identical
 * to the input.
 */
function tokenize(s: string): string[] {
  // Split but keep the separator as part of the result.
  const out: string[] = [];
  let buf = '';
  for (const ch of s) {
    if (/\s/.test(ch)) {
      if (buf.length > 0) {
        out.push(buf);
        buf = '';
      }
      // Glue adjacent whitespace into a single token so diff segments stay
      // compact.
      if (out.length > 0 && out[out.length - 1]!.match(/\s$/)) {
        out[out.length - 1]! += ch;
      } else {
        out.push(ch);
      }
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0) out.push(buf);
  return out.length === 0 ? [] : out;
}

function appendSegment(arr: DiffSegment[], op: DiffOp, value: string): void {
  const last = arr[arr.length - 1];
  if (last && last.op === op) {
    arr[arr.length - 1] = { op, value: last.value + value };
  } else {
    arr.push({ op, value });
  }
}
