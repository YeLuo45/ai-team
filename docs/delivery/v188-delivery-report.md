V188 ships the PrivacyOverrideLog module — durable audit trail of
every consent decision that released a privacy-sensitive operation.
Persisted via pluggable storage adapter, optional in-memory only.

Components (lib/privacy/override-log.ts, 115 lines, 100% lines, 94.28%
branches, 100% funcs):
  - PrivacyOverrideLog class:
      * record(event) — upsert by id, returns the snapshot.
      * list() — read-only snapshot of current events.
      * filter({ sinceMs, outcome, op }) — scoped query.
      * prune(cutoffMs) — drop entries older than cutoff.
      * countByOutcome(outcome) — quick audit counter.
  - Storage adapter support — bring-your-own getItem/setItem. We
    auto-rehydrate from the supplied adapter when the log
    constructs, and gracefully ignore corrupt JSON payloads.
  - `makeOverrideId(decidedAtMs, actor?)` — stable id helper.
  - `formatOverrideLine(event)` — TSV pretty-print, used by tests +
    the future Privacy dashboard.

Domain types:
  - PrivacyOpKind: 'export-audio' | 'export-interview' |
    'clipboard-copy' | 'remote-stream'.
  - PrivacyOutcome: 'allowed' | 'denied' | 'timeout'.
  - PrivacyOverrideEvent: id, op, reason, outcome, decidedAtMs,
    actor?, expiresAtMs?.

Tests (11):
  - record / list (3): insert, upsert, retention trimming.
  - filter / count / prune (3): op + outcome + time-since scoping;
    countByOutcome; prune keeping the recent ones.
  - storage adapter (3): persists to adapter, rehydrates on
    construction, gracefully handles corrupt JSON.
  - helpers (2): makeOverrideId stable, formatOverrideLine shape.

tsc --noEmit clean. verify:readme 40/40.

NEXT: V196 LiveCapture Noise Stats, V197 SubtitleEditor.
