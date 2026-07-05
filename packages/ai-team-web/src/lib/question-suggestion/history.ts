// V165: Question suggestion adoption history — pure helper.
//
// The RealtimeQuestionSuggester (V164) shows the *current* suggestion. This
// module tracks which suggestions were actually adopted by the interviewer
// across sessions, so they can be reviewed/exported in a History panel.
//
// Storage shape (localStorage key = STORAGE_KEY):
//   { version: 1, entries: AdoptedSuggestion[] }
//
// Newest-first ordering is enforced on read so the UI never has to sort.

import type { QuestionSuggestion } from './types';

export interface AdoptedSuggestion {
  /** Mirrors QuestionSuggestion.id for easy cross-reference. */
  readonly suggestionId: string;
  readonly question: string;
  readonly rationale: string;
  readonly focusTag?: QuestionSuggestion['focusTag'];
  readonly difficulty: QuestionSuggestion['difficulty'];
  /** Epoch ms when the interviewer clicked ✅ Adopt. */
  readonly adoptedAt: number;
  /** Session this was adopted in (CandidateInterviewPanel candidateId). */
  readonly sessionId: string;
  readonly candidateName: string;
  /** Position applied to the input when the suggestion was generated. */
  readonly position: string;
}

export interface HistoryFile {
  readonly version: 1;
  readonly entries: ReadonlyArray<AdoptedSuggestion>;
}

export const STORAGE_KEY = 'ai-team-qs-history';

/**
 * Try to read the persisted history. Returns `{ ok: false }` on parse error
 * or missing storage (SSR / private mode) — callers should fall back to an
 * empty array.
 */
export function readHistory(storage: { getItem(k: string): string | null } | null): HistoryFile {
  if (!storage) return { version: 1, entries: [] };
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { version: 1, entries: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<HistoryFile>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return { version: 1, entries: [] };
    }
    const entries = parsed.entries.filter(isAdoptedSuggestion);
    return { version: 1, entries };
  } catch {
    return { version: 1, entries: [] };
  }
}

/**
 * Persist a new history file. Returns the updated file (so callers can
 * sync state in one round-trip). Silently no-ops when storage is unavailable.
 */
export function writeHistory(
  storage: { setItem(k: string, v: string): void } | null,
  file: HistoryFile,
): HistoryFile {
  if (!storage) return file;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(file));
    return file;
  } catch {
    return file;
  }
}

/**
 * Build a new history file with the suggestion prepended. Newest-first.
 * Caps entries at MAX_ENTRIES to keep localStorage under quota.
 */
export function appendAdopted(
  prev: HistoryFile,
  adoption: AdoptedSuggestion,
): HistoryFile {
  const entries = [adoption, ...prev.entries].slice(0, MAX_ENTRIES);
  return { version: 1, entries };
}

/** Drop all entries — used by the "Clear history" button. */
export function clearHistory(): HistoryFile {
  return { version: 1, entries: [] };
}

/** Drop a single entry by suggestionId. Returns the updated file. */
export function removeAdopted(
  prev: HistoryFile,
  suggestionId: string,
): HistoryFile {
  return {
    version: 1,
    entries: prev.entries.filter((e) => e.suggestionId !== suggestionId),
  };
}

/** Build an AdoptedSuggestion from a QuestionSuggestion + session metadata. */
export function buildAdoption(args: {
  suggestion: QuestionSuggestion;
  sessionId: string;
  candidateName: string;
  position: string;
  adoptedAt?: number;
}): AdoptedSuggestion {
  return {
    suggestionId: args.suggestion.id,
    question: args.suggestion.question,
    rationale: args.suggestion.rationale,
    focusTag: args.suggestion.focusTag,
    difficulty: args.suggestion.difficulty,
    adoptedAt: args.adoptedAt ?? Date.now(),
    sessionId: args.sessionId,
    candidateName: args.candidateName,
    position: args.position,
  };
}

/**
 * Format the adoption history as a JSON string for the "Export JSON" button.
 * Pretty-printed (2-space indent) so the file is human-readable.
 */
export function exportHistoryJson(file: HistoryFile): string {
  return JSON.stringify(file, null, 2);
}

export const MAX_ENTRIES = 200;

function isAdoptedSuggestion(value: unknown): value is AdoptedSuggestion {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.suggestionId === 'string'
    && typeof v.question === 'string'
    && typeof v.rationale === 'string'
    && typeof v.difficulty === 'string'
    && typeof v.adoptedAt === 'number'
    && typeof v.sessionId === 'string'
    && typeof v.candidateName === 'string'
    && typeof v.position === 'string'
    && (v.focusTag === undefined || typeof v.focusTag === 'string')
  );
}