V187 ships the EvalTimeline helper module so consumers (the
EvalRunnerStreaming UI from V186, future cron / dashboard tools, etc.)
can record + prune + summarise a history of V175/EvalSuite runs.

Components (lib/llm/eval-timeline.ts, 175 lines):
  - EvalTimelineEntry / FixtureTrend / TimelineSnapshot shapes.
  - buildEntry(id, { startedAtMs, durationMs, runnerLabel, results }) —
    construct a new entry with auto-rolled pass / fail counts and
    captured per-fixture data.
  - pruneTimeline(entries, nowMs, { newestOlderThanMs, minRetained })
    — TTL-driven cleanup that always preserves the N most recent
    entries regardless of age.
  - summariseTimeline(entries) — collates the entry list into
    pass-rate per fixture (over the last 10 runs), per-run pass-rate
    trend, total runs, and overall pass-rate.
  - latestFailure(entries, fixtureId) — find the most recent run that
    failed a particular fixture.
  - renderTimelineMarkdown(snap) — pretty-printer for dashboards.

Pure functions, no side-effects. The caller decides whether to
persist entries (localStorage / server / etc.) and how to format
their own UI on top.

Test coverage: 12 tests — all green. tsc --noEmit clean.
verify:readme 40/40.
