V193 ships the cross-session reuse helpers that let the question
suggestion UI surface questions the same candidate already
adopted for the same focus area across past interviews. Everything
runs against the V169 history storage — the helpers are pure
functions so they slot into candidates' reactions / search panels
with no extra wiring.

Components:

  lib/question-suggestion/reuse.ts (115 lines, 100% lines, 100% funcs):
    - `groupByQuestionId(history)` — roll adoptions up to one entry
      per questionId and remember first / last adopted timestamps.
    - `reuseScore(entry, { nowMs, focusTag })` — compute a 0..N
      score combining recency, focus-tag match, and adoption count.
    - `findReuseCandidates(history, { nowMs, focusTag, limit,
      minAdoptions })` — return ranked reusable candidates.
    - `deriveScore({ adoptionCount, ageDays, tagMatches })` —
      preview helper for "how would this rank?"-style calculations.

  Scoring formula:
    score = recency · tagMatch · adoptionBoost
    recency = 1 - log10(ageDays + 1) / 2 (clamped to [0, 1])
    tagMatch = 1 if focusTag matches, 0.4 otherwise
    adoptionBoost = min(1, adoptionCount · 0.2)

Tests (11 tests, all green):
  - groupByQuestionId roll-up (1)
  - reuseScore factors (3): focus tag, recency, adoption count
  - findReuseCandidates (4): limit, minAdoptions, focusTag filter,
    rolled adoption ranking
  - deriveScore previews (3)

tsc --noEmit clean. reuse.ts coverage 100% lines / 100% funcs /
100% branches / 100% statements — exceeds the 95% target.
verify:readme 40/40.

NEXT: V191 EvalSummary Dashboard, V188 Privacy Override Log.
