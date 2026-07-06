// V167: Suggestion cache — per-candidate and per-position in localStorage.
//
// The adoption history (V165) tracks *adopted* suggestions across sessions
// for the interviewer to re-use. The suggestion cache is different — it
// tracks what the *agent* generated for each candidate / position so that
// switching between candidates restores the latest in-flight suggestion
// without re-running the LLM (which is the slow path).
//
// Storage shape (localStorage key = CACHE_KEY):
//   {
//     version: 1,
//     candidates: { [candidateId]: QuestionSuggestion[] },  // newest first, cap = PER_KEY_CAP
//     positions: { [position]:  QuestionSuggestion[] },
//   }

import type { QuestionSuggestion } from './types';

export const PER_KEY_CAP = 10;
export const POSITION_KEY_CAP = 30;
export const CACHE_KEY = 'ai-team-qs-cache';

export interface SuggestionCache {
  readonly version: 1;
  readonly candidates: Readonly<Record<string, ReadonlyArray<QuestionSuggestion>>>;
  readonly positions: Readonly<Record<string, ReadonlyArray<QuestionSuggestion>>>;
}

export const EMPTY_CACHE: SuggestionCache = Object.freeze({
  version: 1,
  candidates: Object.freeze({}),
  positions: Object.freeze({}),
});

/** Build an empty cache (use this when storage is unavailable). */
export function emptyCache(): SuggestionCache {
  return { version: 1, candidates: {}, positions: {} };
}

/**
 * Try to read the persisted cache. Returns the empty cache when storage is
 * missing, or when JSON is malformed. Skips entries that don't look like
 * valid QuestionSuggestion objects.
 */
export function readCache(storage: { getItem(k: string): string | null } | null): SuggestionCache {
  if (!storage) return emptyCache();
  const raw = storage.getItem(CACHE_KEY);
  if (!raw) return emptyCache();
  try {
    const parsed = JSON.parse(raw) as Partial<SuggestionCache>;
    if (parsed.version !== 1) return emptyCache();
    const candidates = sanitizeIndex(parsed.candidates);
    const positions = sanitizeIndex(parsed.positions);
    return { version: 1, candidates, positions };
  } catch {
    return emptyCache();
  }
}

/** Persist the cache. Returns the cache so callers can update state in one round-trip. */
export function writeCache(
  storage: { setItem(k: string, v: string): void } | null,
  cache: SuggestionCache,
): SuggestionCache {
  if (!storage) return cache;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(cache));
    return cache;
  } catch {
    return cache;
  }
}

function sanitizeIndex(
  src: Readonly<Record<string, ReadonlyArray<unknown>>> | undefined,
): Record<string, ReadonlyArray<QuestionSuggestion>> {
  const out: Record<string, ReadonlyArray<QuestionSuggestion>> = {};
  if (!src || typeof src !== 'object') return out;
  for (const [k, list] of Object.entries(src)) {
    if (!Array.isArray(list)) continue;
    const filtered = list.filter(isQuestionSuggestionShape);
    if (filtered.length > 0) out[k] = filtered;
  }
  return out;
}

function isQuestionSuggestionShape(v: unknown): v is QuestionSuggestion {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string'
    && typeof o.question === 'string'
    && typeof o.rationale === 'string'
    && typeof o.difficulty === 'string'
    && typeof o.generatedAt === 'number'
    && (o.focusTag === undefined || typeof o.focusTag === 'string')
    && (o.followUpHints === undefined || Array.isArray(o.followUpHints))
  );
}

/** Prepend a candidate-specific suggestion into the cache. Caps at PER_KEY_CAP. */
export function rememberCandidate(
  cache: SuggestionCache,
  candidateId: string,
  suggestion: QuestionSuggestion,
): SuggestionCache {
  const list = (cache.candidates[candidateId] ?? []).slice(0, PER_KEY_CAP - 1);
  const next = [suggestion, ...list];
  return {
    ...cache,
    candidates: { ...cache.candidates, [candidateId]: next },
  };
}

/** Prepend a position-specific suggestion into the cache. Caps at POSITION_KEY_CAP. */
export function rememberPosition(
  cache: SuggestionCache,
  position: string,
  suggestion: QuestionSuggestion,
): SuggestionCache {
  const list = (cache.positions[position] ?? []).slice(0, POSITION_KEY_CAP - 1);
  const next = [suggestion, ...list];
  return {
    ...cache,
    positions: { ...cache.positions, [position]: next },
  };
}

/**
 * Combined: remember the same suggestion under both keys.
 *
 * V169: pass `{ adoptedAt }` to mark this entry as "adopted" — useful when
 * the cache is invoked from an adopt flow (so future readers can tell at
 * a glance whether the latest cached suggestion was also adopted). The
 * timestamp mirror is purely informational; it does NOT change recall
 * semantics (recallCandidate still returns list[0]).
 */
export function remember(
  cache: SuggestionCache,
  args: {
    candidateId: string;
    position: string;
    suggestion: QuestionSuggestion;
    adoptedAt?: number;
  },
): SuggestionCache {
  const suggestion: QuestionSuggestion = args.adoptedAt
    ? { ...args.suggestion, generatedAt: args.adoptedAt }
    : args.suggestion;
  return rememberPosition(
    rememberCandidate(cache, args.candidateId, suggestion),
    args.position,
    suggestion,
  );
}

/** Latest suggestion for a candidate, or null if none cached. */
export function recallCandidate(
  cache: SuggestionCache,
  candidateId: string,
): QuestionSuggestion | null {
  const list = cache.candidates[candidateId];
  return list && list.length > 0 ? (list[0] as QuestionSuggestion) : null;
}

/** Latest suggestion for a position, or null if none cached. */
export function recallPosition(
  cache: SuggestionCache,
  position: string,
): QuestionSuggestion | null {
  const list = cache.positions[position];
  return list && list.length > 0 ? (list[0] as QuestionSuggestion) : null;
}

/**
 * Cleanly forget a candidate's cached suggestions (e.g. when the candidate
 * is removed from the roster).
 */
export function forgetCandidate(
  cache: SuggestionCache,
  candidateId: string,
): SuggestionCache {
  if (!(candidateId in cache.candidates)) return cache;
  const next = { ...cache.candidates };
  delete next[candidateId];
  return { ...cache, candidates: next };
}

/**
 * Count the total number of cached suggestions (useful for compact UI like
 * "12 suggestions cached").
 */
export function countCached(cache: SuggestionCache): { candidates: number; positions: number; total: number } {
  let cand = 0;
  for (const list of Object.values(cache.candidates)) cand += list.length;
  let pos = 0;
  for (const list of Object.values(cache.positions)) pos += list.length;
  return { candidates: cand, positions: pos, total: cand + pos };
}

/**
 * Pretty-print the cache as JSON (used by the optional export button).
 */
export function exportCacheJson(cache: SuggestionCache): string {
  return JSON.stringify(cache, null, 2);
}
