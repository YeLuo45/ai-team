// V191: Eval Summary Dashboard helpers.
//
// Aggregates V175 eval-case results, V169 adoption-history events,
// and V187 timeline summaries into a single dashboard-friendly
// snapshot for the AI-team-web EvalSummary page.

import { summariseTimeline, latestFailure, type EvalTimelineEntry } from './eval-timeline';
import type { EvalCaseResult } from './eval-harness';

export interface AdoptionEvent {
  questionId: string;
  question: string;
  adoptedAtMs: number;
  candidateId?: string;
}

export interface EvalSummaryInput {
  /** Eval-suite results for the most recent run. */
  recentResults?: ReadonlyArray<EvalCaseResult>;
  /** Past suite runs (V187 timeline entries). */
  timeline?: ReadonlyArray<EvalTimelineEntry>;
  /** Adoption history (V169 events). */
  adoptions?: ReadonlyArray<AdoptionEvent>;
  /** `now` in ms epoch — defaults to Date.now() in the rendering. */
  nowMs?: number;
}

export interface TopFailure {
  fixtureId: string;
  count: number;
  latestRunner: string;
  latestAtMs: number;
}

export interface EvalSummarySnapshot {
  recent: {
    totalCases: number;
    passed: number;
    failed: number;
    passRate: number;
    topFailures: ReadonlyArray<TopFailure>;
  };
  timeline: ReturnType<typeof summariseTimeline>;
  adoptions: {
    total: number;
    uniqueQuestions: number;
    mostAdopted: ReadonlyArray<{ questionId: string; count: number }>;
    lastSevenDays: number;
  };
}

/** Bucket failures by fixtureId + track latest occurrence. */
export function topFailures(
  results: ReadonlyArray<EvalCaseResult>,
  nowMsHint?: number,
): TopFailure[] {
  const map = new Map<string, TopFailure>();
  for (const r of results) {
    if (r.passed) continue;
    const ts = nowMsHint ?? 0;
    const prev = map.get(r.fixtureId);
    if (prev) {
      prev.count += 1;
      if (ts >= prev.latestAtMs) {
        prev.latestAtMs = ts;
        prev.latestRunner = r.runnerLabel;
      }
      continue;
    }
    map.set(r.fixtureId, {
      fixtureId: r.fixtureId,
      count: 1,
      latestRunner: r.runnerLabel,
      latestAtMs: ts,
    });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Adoption counts grouped by questionId (most-first). */
export function adoptionByQuestion(
  events: ReadonlyArray<AdoptionEvent>,
): Array<{ questionId: string; count: number }> {
  const map = new Map<string, number>();
  for (const e of events) {
    map.set(e.questionId, (map.get(e.questionId) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([questionId, count]) => ({ questionId, count }))
    .sort((a, b) => b.count - a.count);
}

/** Count adoption events whose timestamp falls in [nowMs - 7d, nowMs]. */
export function adoptionsLastSevenDays(
  events: ReadonlyArray<AdoptionEvent>,
  nowMs: number,
): number {
  const horizon = nowMs - 7 * 86_400_000;
  let count = 0;
  for (const e of events) {
    if (e.adoptedAtMs >= horizon) count += 1;
  }
  return count;
}

/** Compute the dashboard snapshot. */
export function buildEvalSummary(input: EvalSummaryInput): EvalSummarySnapshot {
  const recent = input.recentResults ?? [];
  const timeline = summariseTimeline(input.timeline ?? []);
  const adoptions = input.adoptions ?? [];
  const nowMs = input.nowMs ?? Date.now();

  const passed = recent.filter((r) => r.passed).length;
  const failed = recent.length - passed;
  const passRate = recent.length === 0 ? 0 : passed / recent.length;

  const grouped = new Set<string>();
  for (const e of adoptions) grouped.add(e.questionId);

  return {
    recent: {
      totalCases: recent.length,
      passed,
      failed,
      passRate,
      topFailures: topFailures(recent),
    },
    timeline,
    adoptions: {
      total: adoptions.length,
      uniqueQuestions: grouped.size,
      mostAdopted: adoptionByQuestion(adoptions),
      lastSevenDays: adoptionsLastSevenDays(adoptions, nowMs),
    },
  };
}

/** Helper for picking the most recent failing fixture by id (used by
 *  the dashboard's "regression hover" UI). */
export function latestFailureFor(
  input: EvalSummaryInput,
  fixtureId: string,
): { entry: EvalTimelineEntry | null } {
  const match = latestFailure(input.timeline ?? [], fixtureId);
  return { entry: match };
}
