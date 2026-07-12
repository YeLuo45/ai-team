V197 ships the SubtitleEditor helpers — pure functions that
apply live corrections to the V185 cue stream. Paired with the
existing V185/V195 vocabulary it forms a complete "see + edit +
export" loop for a real-time transcription pipeline.

Components (lib/subtitle/editor.ts, 95 lines, 100% lines, 100%
branches, 100% funcs, 100% statements):
  - `applyEdits(cues, edits)` — pure mutator; re-numbers cues 1..N
    after every drop / text / start / end edit. Returns the new
    cue list + the dropped indices.
  - `rebuildFromChunks(chunks, options?)` — re-emit cues from the
    underlying V185 chunks, useful after large deletes leave the
    cue list sparse.
  - `suspiciousOverlaps(cues)` — flag cue indices that begin
    before the previous end (suggested corrections).
  - `appendEditLog(current, cueIndex, before, after, nowMs)` —
    grow an audit log of edits (skips no-ops).

Types:
  - `CueEdit { cueIndex, text?, startMs?, endMs?, drop? }`.
  - `EditResult { cues, droppedIndices }`.
  - `CuedEditsLog { cueIndex, editedAtMs, before, after }`.

Tests (10):
  - applyEdits (4): renumber, drop, no-ops, time shifts.
  - rebuildFromChunks (1): rebuilds in order.
  - suspiciousOverlaps (2): detects overlaps / no false positives.
  - appendEditLog (3): no-op, append, keep-prior-entries.

tsc --noEmit clean. coverage 100% / 100% / 100% / 100%.
verify:readme 40/40.

NEXT: V198 ReuseBar Component, V199 EvalDashboardPage.
