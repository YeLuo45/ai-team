// V187: EvalTimeline — pure helpers for tracking the history of
// V175/V181/V179 eval-suite runs and summarising regressions.
//
// Persisting runs is the caller's job (localStorage, server, etc.).
// We expose pure shape definitions + helpers for:
//   * Recording a new run entry
//   * Computing a trend per-fixture across runs
//   * Pruning runs older than a TTL
//   * Generating a markdown roll-up of recent regressions

export interface EvalTimelineEntry {
  /** Stable id (caller-defined: timestamp/UUID/etc.). */
  id: string;
  /** Wall-clock start of the suite, ms epoch. */
  startedAtMs: number;
  /** Total wall-clock duration of the suite. */
  durationMs: number;
  /** Runner label that produced the entry. */
  runnerLabel: string;
  /** Number of fixtures the suite ran. */
  totalCases: number;
  /** Pass / fail counts. */
  passed: number;
  /** Failed count. */
  failed: number;
  /** Optional notes — runner commit, user comment, etc. */
  notes?: string;
  /** Per-fixture results — optional, used for trend analysis. */
  perFixture?: ReadonlyArray<{
    fixtureId: string;
    passed: boolean;
    elapsedMs?: number;
  }>;
}

export interface FixtureTrend {
  fixtureId: string;
  /** Pass-rate over the last N runs, [0, 1]. */
  passRate: number;
  /** Stale runs — count of runs where the fixture wasn't present. */
  stale: number;
  /** Last few results, newest first. */
  recent: ReadonlyArray<{ passed: boolean; runId: string }>;
}

export interface TimelineSnapshot {
  /** Latest entry (or null if empty). */
  latest: EvalTimelineEntry | null;
  /** Total runs recorded. */
  totalRuns: number;
  /** Total pass-rate over the recorded window. */
  overallPassRate: number;
  /** Per-fixture trends. */
  trends: ReadonlyArray<FixtureTrend>;
  /** Pass-rate per entry, chronological (oldest-first). */
  perRunPassRate: ReadonlyArray<{ runId: string; passRate: number; atMs: number }>;
}

export interface PruneOptions {
  /** Keep entries newer than this (ms epoch). */
  newestOlderThanMs?: number;
  /** Always keep at least this many recent entries. */
  minRetained?: number;
}

/** Construct a new entry from a run's results. */
export function buildEntry(
  id: string,
  args: {
    startedAtMs: number;
    durationMs: number;
    runnerLabel: string;
    results: ReadonlyArray<{ fixtureId: string; passed: boolean; elapsedMs?: number }>;
    notes?: string;
  },
): EvalTimelineEntry {
  const passed = args.results.filter((r) => r.passed).length;
  const failed = args.results.length - passed;
  return {
    id,
    startedAtMs: args.startedAtMs,
    durationMs: args.durationMs,
    runnerLabel: args.runnerLabel,
    totalCases: args.results.length,
    passed,
    failed,
    notes: args.notes,
    perFixture: args.results.map((r) => ({
      fixtureId: r.fixtureId,
      passed: r.passed,
      elapsedMs: r.elapsedMs,
    })),
  };
}

/** Drop entries older than the cutoff, retaining at least N recent. */
export function pruneTimeline(
  entries: ReadonlyArray<EvalTimelineEntry>,
  nowMs: number,
  options: PruneOptions = {},
): EvalTimelineEntry[] {
  const cut = nowMs - (options.newestOlderThanMs ?? 0);
  const min = Math.max(0, options.minRetained ?? 0);
  // Sort newest-first.
  const sorted = [...entries].sort((a, b) => b.startedAtMs - a.startedAtMs);
  const result: EvalTimelineEntry[] = [];
  for (const e of sorted) {
    if (e.startedAtMs < cut && result.length >= min) {
      continue;
    }
    result.push(e);
  }
  // Restore chronological order for consumers.
  result.sort((a, b) => a.startedAtMs - b.startedAtMs);
  return result;
}

/** Aggregate entries into a TimelineSnapshot. */
export function summariseTimeline(
  entries: ReadonlyArray<EvalTimelineEntry>,
): TimelineSnapshot {
  if (entries.length === 0) {
    return {
      latest: null,
      totalRuns: 0,
      overallPassRate: 0,
      trends: [],
      perRunPassRate: [],
    };
  }
  const sorted = [...entries].sort((a, b) => a.startedAtMs - b.startedAtMs);
  const latest = sorted[sorted.length - 1] ?? null;
  let totalCases = 0;
  let totalPassed = 0;
  for (const e of sorted) {
    totalCases += e.totalCases;
    totalPassed += e.passed;
  }
  const overallPassRate = totalCases === 0 ? 0 : totalPassed / totalCases;

  // Per-fixture trends.
  const fixtureStats = new Map<
    string,
    { recent: Array<{ passed: boolean; runId: string }>; stale: number }
  >();
  for (const e of sorted) {
    const fixtureIdsThisRun = new Set<string>();
    if (e.perFixture) {
      for (const pf of e.perFixture) {
        fixtureIdsThisRun.add(pf.fixtureId);
        const slot = fixtureStats.get(pf.fixtureId) ?? { recent: [], stale: 0 };
        slot.recent.push({ passed: pf.passed, runId: e.id });
        fixtureStats.set(pf.fixtureId, slot);
      }
    }
    // Count fixtures we *had* before this run as "stale".
    for (const [, slot] of fixtureStats) {
      const had = slot.recent.length > 0;
      if (had) slot.stale = 0; // reset — will be incremented below
      if (had) slot.stale += 1;
    }
  }

  const trends: FixtureTrend[] = [];
  for (const [fixtureId, slot] of fixtureStats) {
    const recent = slot.recent.slice(-10).reverse();
    const passRate = slot.recent.length === 0
      ? 0
      : slot.recent.filter((r) => r.passed).length / slot.recent.length;
    trends.push({ fixtureId, passRate, stale: slot.stale, recent });
  }
  trends.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));

  const perRunPassRate = sorted.map((e) => ({
    runId: e.id,
    atMs: e.startedAtMs,
    passRate: e.totalCases === 0 ? 0 : e.passed / e.totalCases,
  }));

  return {
    latest,
    totalRuns: sorted.length,
    overallPassRate,
    trends,
    perRunPassRate,
  };
}

/** Find the latest run that failed a particular fixture. */
export function latestFailure(
  entries: ReadonlyArray<EvalTimelineEntry>,
  fixtureId: string,
): EvalTimelineEntry | null {
  const sorted = [...entries].sort((a, b) => b.startedAtMs - a.startedAtMs);
  for (const e of sorted) {
    if (!e.perFixture) continue;
    const match = e.perFixture.find((pf) => pf.fixtureId === fixtureId);
    if (match && !match.passed) return e;
  }
  return null;
}

/** Pretty-print a TimelineSnapshot as a Markdown roll-up. */
export function renderTimelineMarkdown(snap: TimelineSnapshot): string {
  const lines: string[] = [];
  lines.push('# Eval Timeline');
  lines.push('');
  lines.push(`Total runs: **${snap.totalRuns}**`);
  lines.push(`Overall pass-rate: **${(snap.overallPassRate * 100).toFixed(1)}%**`);
  if (snap.latest) {
    lines.push(`Latest run: \`${snap.latest.id}\` (${snap.latest.totalCases} cases, ${snap.latest.passed} pass, ${snap.latest.failed} fail)`);
  } else {
    lines.push('No runs recorded.');
  }
  if (snap.trends.length > 0) {
    lines.push('');
    lines.push('## Per-fixture');
    for (const t of snap.trends) {
      lines.push(
        `- \`${t.fixtureId}\` — ${(t.passRate * 100).toFixed(1)}% (stale: ${t.stale})`,
      );
    }
  }
  if (snap.perRunPassRate.length > 0) {
    lines.push('');
    lines.push('## Runs');
    for (const r of snap.perRunPassRate) {
      lines.push(`- ${new Date(r.atMs).toISOString()} — \`${r.runId}\` — ${(r.passRate * 100).toFixed(1)}%`);
    }
  }
  return lines.join('\n') + '\n';
}
