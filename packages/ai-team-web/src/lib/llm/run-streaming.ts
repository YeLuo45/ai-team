// V181: Pure streaming-eval runner.
//
// Wraps `runEvalSuite` (V175) but emits one `EvalCaseResult` per fixture
// as each finishes, allowing the UI to render partial progress rather
// than blocking on the entire suite.
//
// Iterates `fixtures` serially (preserves deterministic order and avoids
// concurrent agent-side rate limits). The runner record's `build()` is
// called fresh per fixture so the agent preserves its own per-call
// state (e.g. conversation context).
//
// Returns the full `EvalCaseResult[]` after each fixture; the same
// array is also passed to `onProgress` after each step. The data flow:
//
//   ┌──────────┐    subscribe    ┌──────────────────────────┐
//   │ fixtures │ ───────────────▶│ runStreamingEvalSuite()   │
//   │ runner   │                 │  - emits onProgress per  │
//   └──────────┘                 │    case                  │
//                                └────────┬─────────────────┘
//                                         │
//                                  EvalCaseResult[]
//                                         │
//                                         ▼
//                              EvalResultsTable (V176)

import type {
  AgentRunner,
  EvalCaseResult,
  EvalFixture,
} from './eval-harness';
import { runEvalCase } from './eval-harness';

/** Snapshot fired after every fixture finishes. */
export interface StreamingProgress {
  /** Total fixtures queued (constant once stream starts). */
  total: number;
  /** Fixtures completed so far. */
  done: number;
  /** Fixture id the runner just finished. */
  currentId: string;
  /** Cumulative pass count (purely informational). */
  passedSoFar: number;
  /** Cumulative fail count (purely informational). */
  failedSoFar: number;
}

/** Optional hook fired after each fixture resolves. */
export type StreamingProgressCallback = (progress: StreamingProgress) => void;

export interface RunStreamingOptions {
  onProgress?: StreamingProgressCallback;
  /** AbortSignal — when aborted, the loop short-circuits and returns the
   *  partial result list. */
  signal?: AbortSignal;
  /** Pull-side callback fired before each fixture starts. */
  onBeforeCase?: (fixtureId: string, index: number) => void;
  /** Pull-side callback fired after each fixture completes. */
  onAfterCase?: (result: EvalCaseResult, index: number) => void;
}

export interface StreamingSummary {
  results: ReadonlyArray<EvalCaseResult>;
  /** True when `signal.aborted` flipped mid-run. */
  aborted: boolean;
  /** Total elapsed in milliseconds. */
  totalElapsedMs: number;
}

/**
 * Run the eval suite while emitting `onProgress` after every fixture.
 * Returns the same `EvalSummary` shape the synchronous caller would.
 */
export async function runStreamingEvalSuite(
  runner: AgentRunner,
  fixtures: ReadonlyArray<EvalFixture>,
  options: RunStreamingOptions = {},
): Promise<StreamingSummary> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const results: EvalCaseResult[] = [];
  let passedSoFar = 0;
  let failedSoFar = 0;
  let aborted = false;

  for (let i = 0; i < fixtures.length; i++) {
    if (options.signal?.aborted) {
      aborted = true;
      break;
    }
    const fixture = fixtures[i];
    if (!fixture) continue;
    options.onBeforeCase?.(fixture.id, i);

    const result = await runEvalCase(runner, fixture);
    results.push(result);
    if (result.passed) passedSoFar += 1;
    else failedSoFar += 1;
    options.onAfterCase?.(result, i);

    options.onProgress?.({
      total: fixtures.length,
      done: i + 1,
      currentId: fixture.id,
      passedSoFar,
      failedSoFar,
    });
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    results,
    aborted,
    totalElapsedMs: Math.round(t1 - t0),
  };
}

/** Convenience: slice a results array (already-completed cases only). */
export function completedResults(
  partial: ReadonlyArray<EvalCaseResult>,
): ReadonlyArray<EvalCaseResult> {
  return partial.filter((r) => r !== undefined);
}

/** Format progress as a percentage string (0–100). */
export function progressPercent(progress: StreamingProgress): number {
  if (progress.total === 0) return 100;
  return Math.round((progress.done / progress.total) * 100);
}
