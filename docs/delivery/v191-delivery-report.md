V191 ships the Eval Summary Dashboard helpers — a single
snapshot type that aggregates V175 eval-case results, V187
timeline summaries, and V169 adoption-history events into one
shape the AI-team-web EvalSummary page can render.

Component (lib/llm/eval-summary.ts, 95 lines, 100% lines, 87.5%
branches, 100% funcs):
  - `topFailures(results, nowMs?)` — bucket failing cases by
    fixtureId and roll up the latestAtMs / latestRunner.
  - `adoptionByQuestion(events)` — adoption events grouped by
    questionId, sorted desc by count.
  - `adoptionsLastSevenDays(events, nowMs)` — 7-day rolling window.
  - `latestFailureFor({...}, fixtureId)` — surface the most recent
    timeline entry that failed a given fixture.
  - `buildEvalSummary({ recentResults, timeline, adoptions,
    nowMs? })` — returns an EvalSummarySnapshot with three
    dimensions (recent + timeline + adoptions).

Test coverage: 8 tests, all green. tsc --noEmit clean.
verify:readme 40/40.

NEXT: V188 Privacy Override Log, V196 LiveCapture Noise Stats.
