// V175: Agent Eval Harness — replay transcripts through QuestionSuggestion-
// Agent-like pipelines and compare outputs to expected fixtures.
//
// Pure, side-effect-free helpers. Use case:
//   * Record a real interview transcript + the suggestion the agent made.
//   * Later, replay the same transcript through a new agent version and
//     check whether the output still matches the recorded expectation
//     (or at least stays inside an acceptable similarity band).
//
// Designed for the LLM-driven real-time suggestion pipeline, but the
// matchers are written against the JSON shape of `QuestionSuggestion`
// so any agent implementation is testable.

import type {
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from '../question-suggestion/types';
import { diffSuggestions } from '../question-suggestion/diff';

/** A single expected outcome, per fixture. */
export interface EvalFixture {
  readonly id: string;
  /** Optional human-readable label for the report. */
  readonly label?: string;
  /** What the input to the agent looks like. */
  readonly input: QuestionSuggestionInput;
  /** What the agent *should* produce (or where it should land). */
  readonly expected: EvalExpectation;
}

/** What to compare against the agent's output. */
export interface EvalExpectation {
  /** Match the suggestion text against this literal string. */
  readonly questionEquals?: string;
  /** Match if the agent's question CONTAINS this substring (Chinese-safe). */
  readonly questionContains?: string;
  /** Match if the agent's question matches this regex source. */
  readonly questionMatches?: string;
  /** Required focus tag (`technical` / `communication` / `problemSolving` / `culture`). */
  readonly focusTag?: NonNullable<QuestionSuggestion['focusTag']>;
  /** Required difficulty (`easy` / `medium` / `hard`). */
  readonly difficulty?: QuestionSuggestion['difficulty'];
  /** Required rationale substring. */
  readonly rationaleContains?: string;
  /** Optional similarity floor (0..1) when comparing against a baseline. */
  readonly similarityAtLeast?: number;
  /** Optional baseline question — used for similarityAtLeast. */
  readonly baselineQuestion?: string;
}

/** A runner that wraps a real agent for the harness to drive. */
export interface AgentRunner {
  /** Wrap an arbitrary question-suggestion agent. */
  build(): Pick<QuestionSuggestionAgent, 'suggest'>;
  /** Optional name used in report rows. */
  readonly label: string;
}

/** Result of a single fixture run. */
export interface EvalCaseResult {
  readonly fixtureId: string;
  readonly label?: string;
  readonly runnerLabel: string;
  /** The actual suggestion the agent produced. `null` when the agent threw. */
  readonly actual: QuestionSuggestion | null;
  /** The supplied expectation. */
  readonly expectation: EvalExpectation;
  /** Pass / fail individual assertions. */
  readonly checks: ReadonlyArray<{ readonly name: string; readonly passed: boolean; readonly detail?: string }>;
  /** When the agent threw an error. */
  readonly error?: string;
  /** Time the call took in milliseconds. */
  readonly elapsedMs: number;
  /** `true` when every check passed. */
  readonly passed: boolean;
}

export interface EvalSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly passRate: number;
  readonly totalElapsedMs: number;
  readonly byRunner: ReadonlyMap<string, { passed: number; failed: number }>;
}

/** Run a single fixture. */
export async function runEvalCase(
  runner: AgentRunner,
  fixture: EvalFixture,
): Promise<EvalCaseResult> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let actual: QuestionSuggestion | null = null;
  let error: string | undefined;
  try {
    const agent = runner.build();
    actual = await agent.suggest(fixture.input);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const checks = actual ? evaluateExpectation(actual, fixture.expected) : [];
  return {
    fixtureId: fixture.id,
    label: fixture.label,
    runnerLabel: runner.label,
    actual,
    expectation: fixture.expected,
    checks,
    error,
    elapsedMs: Math.round(t1 - t0),
    passed: checks.every((c) => c.passed) && !error,
  };
}

/** Run an array of fixtures, sequentially, against one runner. */
export async function runEvalSuite(
  runner: AgentRunner,
  fixtures: ReadonlyArray<EvalFixture>,
): Promise<ReadonlyArray<EvalCaseResult>> {
  const out: EvalCaseResult[] = [];
  for (const f of fixtures) out.push(await runEvalCase(runner, f));
  return out;
}

/** Summarise a list of case results into pass-rate metrics. */
export function summarise(results: ReadonlyArray<EvalCaseResult>): EvalSummary {
  let passed = 0;
  let failed = 0;
  let totalMs = 0;
  const byRunner = new Map<string, { passed: number; failed: number }>();
  for (const r of results) {
    totalMs += r.elapsedMs;
    if (r.passed) passed += 1;
    else failed += 1;
    const cur = byRunner.get(r.runnerLabel) ?? { passed: 0, failed: 0 };
    if (r.passed) cur.passed += 1;
    else cur.failed += 1;
    byRunner.set(r.runnerLabel, cur);
  }
  const total = results.length;
  return {
    total,
    passed,
    failed,
    passRate: total === 0 ? 1 : passed / total,
    totalElapsedMs: totalMs,
    byRunner,
  };
}

// ====================================================================
// Assertion helpers
// ====================================================================

/**
 * Apply every assertion in `expectation` against `actual` and return
 * one row per check. Failures get a short `detail` for the report.
 */
export function evaluateExpectation(
  actual: QuestionSuggestion,
  expectation: EvalExpectation,
): Array<{ name: string; passed: boolean; detail?: string }> {
  const out: Array<{ name: string; passed: boolean; detail?: string }> = [];

  if (expectation.questionEquals !== undefined) {
    const passed = actual.question === expectation.questionEquals;
    out.push({
      name: 'question equals',
      passed,
      detail: passed ? undefined : summarizeMismatch(actual.question, expectation.questionEquals),
    });
  }
  if (expectation.questionContains !== undefined) {
    const passed = actual.question.includes(expectation.questionContains);
    out.push({
      name: 'question contains',
      passed,
      detail: passed ? undefined : truncated(actual.question),
    });
  }
  if (expectation.questionMatches !== undefined) {
    let passed = false;
    let detail: string | undefined = undefined;
    try {
      const re = new RegExp(expectation.questionMatches);
      passed = re.test(actual.question);
    } catch (e) {
      passed = false;
      detail = `invalid regex: ${e instanceof Error ? e.message : String(e)}`;
    }
    out.push({
      name: 'question matches regex',
      passed,
      detail: passed ? undefined : detail ?? truncated(actual.question),
    });
  }
  if (expectation.focusTag !== undefined) {
    const passed = actual.focusTag === expectation.focusTag;
    out.push({
      name: 'focus tag',
      passed,
      detail: passed ? undefined : `actual=${actual.focusTag ?? 'undefined'}`,
    });
  }
  if (expectation.difficulty !== undefined) {
    const passed = actual.difficulty === expectation.difficulty;
    out.push({
      name: 'difficulty',
      passed,
      detail: passed ? undefined : `actual=${actual.difficulty ?? 'undefined'}`,
    });
  }
  if (expectation.rationaleContains !== undefined) {
    const passed = actual.rationale.includes(expectation.rationaleContains);
    out.push({
      name: 'rationale contains',
      passed,
      detail: passed ? undefined : truncated(actual.rationale),
    });
  }
  if (expectation.similarityAtLeast !== undefined) {
    if (expectation.baselineQuestion === undefined) {
      out.push({
        name: 'similarity floor',
        passed: false,
        detail: 'baselineQuestion not provided alongside similarityAtLeast',
      });
    } else {
      const diff = diffSuggestions(
        {
          ...actual,
          question: expectation.baselineQuestion,
        } as QuestionSuggestion,
        actual,
      );
      const sim = importSimilarity(diff);
      const passed = sim >= expectation.similarityAtLeast;
      out.push({
        name: 'similarity floor',
        passed,
        detail: `sim=${sim.toFixed(2)} floor=${expectation.similarityAtLeast.toFixed(2)}`,
      });
    }
  }
  return out;
}

/**
 * Compute pass-rate from a `EvalSummary`, returning a fraction in [0, 1].
 */
export function passRate(summary: EvalSummary): number {
  return summary.total === 0 ? 1 : summary.passed / summary.total;
}

/**
 * Format pass-rate as `NN/100 (NN.N%)` for a single-line report.
 */
export function formatPassRate(summary: EvalSummary): string {
  const pct = (passRate(summary) * 100).toFixed(1);
  return `${summary.passed}/${summary.total} (${pct}%)`;
}

// ====================================================================
// Internals
// ====================================================================

function summarizeMismatch(actual: string, expected: string): string {
  return `actual=${truncated(actual)} expected=${truncated(expected)}`;
}

function truncated(s: string, n = 60): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function importSimilarity(diff: ReturnType<typeof diffSuggestions>): number {
  // The diff module is intentionally lightweight — it doesn't export
  // `similarity` to avoid cycle against helpers. Inline a minimal
  // computation here using the diff's counters.
  let added = 0;
  let removed = 0;
  for (const seg of diff.questionDiff) {
    if (seg.op === 'insert') added += seg.value.trim().split(/\s+/).filter(Boolean).length;
    if (seg.op === 'delete') removed += seg.value.trim().split(/\s+/).filter(Boolean).length;
  }
  const total = added + removed;
  if (total === 0 && !diff.focusTagChanged && !diff.difficultyChanged) return 1;
  const penalty = total + (diff.focusTagChanged ? 1 : 0) + (diff.difficultyChanged ? 1 : 0);
  return Math.max(0, 1 - penalty / 10);
}
