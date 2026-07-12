// V193: Cross-Session Suggestion Reuse helpers.
//
// Looks at V169-style history (the QuestionSuggestionHistoryEntry[] list
// persisted by appendAdopted) and surfaces suggestions the same
// candidate accepted for the same position in past interviews, ranked
// by a simple score = match × recency × adoption-count.

export interface ReuseCandidate {
  questionId: string;
  question: string;
  firstAdoptedMs: number;
  adoptionCount: number;
  lastAdoptedMs: number;
  focusTag?: string;
  rationale?: string;
  difficulty?: string;
  runnerLabel?: string;
  score?: number;
}

export interface HistoryLikeEntry {
  questionId: string;
  question: string;
  adoptedAtMs: number;
  focusTag?: string;
  rationale?: string;
  difficulty?: string;
  runnerLabel?: string;
}

export interface ReuseSearchOptions {
  minAdoptions?: number;
  focusTag?: string;
  limit?: number;
}

interface AccEntry {
  questionId: string;
  question: string;
  focusTag?: string;
  rationale?: string;
  difficulty?: string;
  runnerLabel?: string;
  firstAdoptedMs: number;
  lastAdoptedMs: number;
  adoptionCount: number;
}

/** Group history entries by questionId and roll up adoption counts. */
export function groupByQuestionId(
  history: ReadonlyArray<HistoryLikeEntry>,
): Map<string, AccEntry> {
  const acc = new Map<string, AccEntry>();
  for (const entry of history) {
    const prev = acc.get(entry.questionId);
    if (prev) {
      prev.adoptionCount += 1;
      if (entry.adoptedAtMs < prev.firstAdoptedMs) {
        prev.firstAdoptedMs = entry.adoptedAtMs;
      }
      if (entry.adoptedAtMs > prev.lastAdoptedMs) {
        prev.lastAdoptedMs = entry.adoptedAtMs;
      }
      continue;
    }
    acc.set(entry.questionId, {
      questionId: entry.questionId,
      question: entry.question,
      focusTag: entry.focusTag,
      rationale: entry.rationale,
      difficulty: entry.difficulty,
      runnerLabel: entry.runnerLabel,
      firstAdoptedMs: entry.adoptedAtMs,
      lastAdoptedMs: entry.adoptedAtMs,
      adoptionCount: 1,
    });
  }
  return acc;
}

/** Score a candidate — higher is better. `nowMs` is the current time. */
export function reuseScore(
  entry: AccEntry,
  options: { nowMs: number; focusTag?: string },
): number {
  const ageMs = Math.max(0, options.nowMs - entry.lastAdoptedMs);
  const ageDays = ageMs / 86_400_000;
  const recency = Math.max(0, 1 - Math.log10(ageDays + 1) / 2);
  const tagMatch =
    options.focusTag && entry.focusTag === options.focusTag ? 1 : 0.4;
  const adoptionBoost = Math.min(1, entry.adoptionCount * 0.2);
  return recency * tagMatch * adoptionBoost;
}

/** Top reusable candidates sorted by score desc. */
export function findReuseCandidates(
  history: ReadonlyArray<HistoryLikeEntry>,
  options: ReuseSearchOptions & { nowMs: number },
): ReuseCandidate[] {
  const limit = options.limit ?? 5;
  const minAdoptions = options.minAdoptions ?? 1;
  const grouped = groupByQuestionId(history);
  const scored: Array<{ entry: AccEntry; score: number }> = [];
  for (const entry of grouped.values()) {
    if (entry.adoptionCount < minAdoptions) continue;
    if (options.focusTag && entry.focusTag !== options.focusTag) continue;
    const score = reuseScore(entry, {
      nowMs: options.nowMs,
      focusTag: options.focusTag,
    });
    scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ entry, score }) => ({
    questionId: entry.questionId,
    question: entry.question,
    firstAdoptedMs: entry.firstAdoptedMs,
    lastAdoptedMs: entry.lastAdoptedMs,
    adoptionCount: entry.adoptionCount,
    focusTag: entry.focusTag,
    rationale: entry.rationale,
    difficulty: entry.difficulty,
    runnerLabel: entry.runnerLabel,
    score,
  }));
}

/** Score a single candidate without a history entry — useful for
 *  previews ("how would this rank?"). */
export function deriveScore(opts: {
  adoptionCount: number;
  ageDays: number;
  tagMatches?: boolean;
}): number {
  const recency = Math.max(0, 1 - Math.log10(opts.ageDays + 1) / 2);
  const tag = opts.tagMatches === false ? 0.4 : 1;
  const adoptionBoost = Math.min(1, opts.adoptionCount * 0.2);
  return recency * tag * adoptionBoost;
}
