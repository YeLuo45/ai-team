// V185: Streaming accumulator.
//
// Real transcription pipelines emit partial chunks over time. The
// SubtitleAccumulator buffers incoming `SubtitleChunk`s and flushes
// sub-cues once the underlying chunk list passes a configurable
// `flushIntervalMs` boundary. Each `onFlush` carries the cues that
// became stable (i.e. won't shift around because newer chunks would
// fall further in the future).
//
// The accumulator is intentionally tiny so it can be re-created
// cheaply if the user resets the interview.

import { chunkToCues, type SubtitleChunk, type SrtCue } from './cue';

export interface SubtitleAccumulatorOptions {
  /** How often to flush stable cues (ms). Default 600. */
  flushIntervalMs?: number;
  /** Maximum number of cues retained in memory. Default 200. */
  maxCues?: number;
  /** Maximum wall-clock duration retained. Default 5 minutes. */
  maxBufferMs?: number;
}

export interface SubtitleAccumulatorState {
  cues: SrtCue[];
  /** True once the input has been closed (no more chunks accepted). */
  closed: boolean;
  /** Last flush timestamp (ms from origin). */
  lastFlushAtMs: number | null;
}

/** A discrete flush event — the caller can render / export these cues
 *  without re-running `chunkToCues`. */
export interface FlushEvent {
  flushAtMs: number;
  cues: ReadonlyArray<SrtCue>;
  /** True when the accumulator drained. */
  drained: boolean;
  /** Stable cue boundaries — only the cues whose endMs <= flushThroughMs
   *  are guaranteed unchanging. */
  flushThroughMs: number;
}

export class SubtitleAccumulator {
  private chunks: SubtitleChunk[] = [];
  private cues: SrtCue[] = [];
  private closed = false;
  private lastFlushAtMs: number | null = null;
  private readonly flushIntervalMs: number;
  private readonly maxCues: number;
  private readonly maxBufferMs: number;

  constructor(
    options: SubtitleAccumulatorOptions = {},
  ) {
    this.flushIntervalMs = options.flushIntervalMs ?? 600;
    this.maxCues = options.maxCues ?? 200;
    this.maxBufferMs = options.maxBufferMs ?? 5 * 60 * 1_000;
  }

  push(chunk: SubtitleChunk): FlushEvent {
    if (this.closed) {
      return this.snapshot(0);
    }
    if (typeof chunk.startMs !== 'number') {
      return this.snapshot(0);
    }
    const endMs = chunk.endMs ?? chunk.startMs + 1;
    this.chunks.push({ ...chunk, startMs: Math.max(0, chunk.startMs), endMs });
    return this.flushIfDue();
  }

  close(): FlushEvent {
    this.closed = true;
    return this.flushAll();
  }

  state(): SubtitleAccumulatorState {
    return {
      cues: this.cues.slice(),
      closed: this.closed,
      lastFlushAtMs: this.lastFlushAtMs,
    };
  }

  reset(): void {
    this.chunks = [];
    this.cues = [];
    this.closed = false;
    this.lastFlushAtMs = null;
  }

  private flushIfDue(): FlushEvent {
    if (this.chunks.length === 0) {
      return this.snapshot(0);
    }
    const lastEnd = this.chunks[this.chunks.length - 1]?.endMs ?? 0;
    if (
      this.lastFlushAtMs === null ||
      lastEnd - this.lastFlushAtMs >= this.flushIntervalMs
    ) {
      return this.flushAll();
    }
    return this.snapshot(0);
  }

  private flushAll(): FlushEvent {
    if (this.chunks.length === 0) {
      this.lastFlushAtMs = 0;
      return { flushAtMs: 0, cues: [], drained: this.closed, flushThroughMs: 0 };
    }
    const flushAtMs = this.chunks[this.chunks.length - 1]?.endMs ?? 0;
    const cues = chunkToCues(this.chunks);
    if (this.closed) {
      this.cues = cues;
    } else if (this.cues.length === 0) {
      // First push after open() or reset() — every buffered cue is new.
      this.cues = cues;
    } else {
      // Append-only: this.cues grows monotonically. New cues get
      // appended. Cues that fall within the stable horizon are kept in
      // their existing positions; anything strictly past the horizon
      // may still grow so we replace it from the chunkToCues output.
      const horizon = flushAtMs - this.flushIntervalMs;
      let stableCount = 0;
      for (const c of cues) {
        if (c.endMs <= horizon) stableCount += 1;
        else break;
      }
      const merged = cues.slice(0, stableCount);
      // Keep everything we already had for indices below stableCount.
      for (let i = stableCount; i < this.cues.length; i++) {
        merged.push(this.cues[i] as SrtCue);
      }
      // Append any cues we hadn't seen yet.
      for (let i = this.cues.length; i < cues.length; i++) {
        merged.push(cues[i] as SrtCue);
      }
      this.cues = merged;
    }
    if (this.cues.length > this.maxCues) {
      this.cues = this.cues.slice(this.cues.length - this.maxCues);
    }
    this.cues = this.cues.map((c, i) => ({ ...c, index: i + 1 }));
    // Trim buffer — we keep recent chunks around so the next push
    // can still refine the surrounding cues, but anything past the
    // horizon can be safely dropped.
    const safeEnd = (c: SubtitleChunk) => c.endMs ?? c.startMs + 1;
    const horizon = flushAtMs - this.flushIntervalMs;
    this.chunks = this.chunks.filter((c) => safeEnd(c) >= horizon);
    if (this.maxBufferMs > 0) {
      const maxHorizon = flushAtMs - this.maxBufferMs;
      this.chunks = this.chunks.filter((c) => safeEnd(c) >= maxHorizon);
    }
    this.lastFlushAtMs = flushAtMs;
    return this.snapshot(flushAtMs, this.cues);
  }

  private snapshot(flushAtMs: number, cues: ReadonlyArray<SrtCue> = this.cues): FlushEvent {
    return {
      flushAtMs: flushAtMs || 0,
      cues: cues.slice(),
      drained: this.closed,
      flushThroughMs: flushAtMs || 0,
    };
  }
}

/** Convenience helper — accumulate a stream of chunks into a single
 *  cue list, tracking stable cumulative flushes. */
export function runStreamingSubtitles(
  chunks: ReadonlyArray<SubtitleChunk>,
  options: SubtitleAccumulatorOptions = {},
): {
  finalCues: SrtCue[];
  flushEvents: ReadonlyArray<FlushEvent>;
} {
  const acc = new SubtitleAccumulator(options);
  const events: FlushEvent[] = [];
  for (const chunk of chunks) events.push(acc.push(chunk));
  events.push(acc.close());
  return { finalCues: acc.state().cues, flushEvents: events };
}
