// V172: Speaker diarization helpers — turn a flat stream of STT chunks
// (each carrying an optional `speaker` + `timestamp`) into a structured
// timeline of speaker turns.
//
// Pure functions, no React. The UI component imports the timeline and
// paints it as a colour-coded bar.
//
// Conventions:
//   * Chunks without a timestamp land at the previous chunk's timestamp + 1s.
//   * Chunks without a speaker are tagged as `unknown`.
//   * Consecutive chunks with the same speaker collapse into one turn.
//   * Turn endMs defaults to startMs + (text length × 50 ms) when the
//     chunk has no explicit timestamp — good enough for visualisation.

import type { SttSpeaker, SttTranscriptChunk } from './types';

export type SpeakerLabel = NonNullable<SttSpeaker> | 'unknown';

export interface SpeakerTurn {
  readonly speaker: SpeakerLabel;
  /** Inclusive start (ms since epoch). */
  readonly startMs: number;
  /** Exclusive end (ms since epoch). */
  readonly endMs: number;
  /** Concatenated chunk text in arrival order. */
  readonly text: string;
  /** Number of chunks merged into this turn. */
  readonly chunkCount: number;
}

/** Default per-character duration when a chunk has no timestamp. */
const FALLBACK_CHUNK_MS = 1500;
const FALLBACK_PER_CHAR_MS = 50;
const GAP_BACKFILL_MS = 1000;

const SPEAKER_ORDER: ReadonlyArray<SpeakerLabel> = [
  'interviewer',
  'candidate',
  'unknown',
];

function normalizeSpeaker(s: SttSpeaker | undefined): SpeakerLabel {
  if (s === 'candidate' || s === 'interviewer' || s === 'unknown') return s;
  return 'unknown';
}

function inferTimestamps(
  chunks: ReadonlyArray<SttTranscriptChunk>,
): Array<{
  speaker: SpeakerLabel;
  text: string;
  startMs: number;
  endMs: number;
  hasExplicitTs: boolean;
}> {
  const out: Array<{ speaker: SpeakerLabel; text: string; startMs: number; endMs: number; hasExplicitTs: boolean }> = [];
  let prevEnd = 0;
  for (const chunk of chunks) {
    const speaker = normalizeSpeaker(chunk.speaker);
    const text = chunk.text.trim();
    if (!text) continue;
    const hasExplicitTs = typeof chunk.timestamp === 'number';
    const startMs = hasExplicitTs
      ? (chunk.timestamp as number)
      : prevEnd + GAP_BACKFILL_MS;
    const endMs = startMs + Math.max(FALLBACK_CHUNK_MS, text.length * FALLBACK_PER_CHAR_MS);
    out.push({ speaker, text, startMs, endMs, hasExplicitTs });
    prevEnd = endMs;
  }
  return out;
}

/**
 * Build a speaker-turn timeline. Consecutive chunks with the same
 * speaker (timestamp gap ≤ `GAP_BACKFILL_MS`) merge into a single turn.
 * Chunks without an explicit timestamp are kept as separate turns so
 * inference doesn't accidentally collapse unrelated utterances.
 * Returns turns sorted by `startMs`.
 */
export function buildSpeakerTimeline(
  chunks: ReadonlyArray<SttTranscriptChunk>,
): SpeakerTurn[] {
  const points = inferTimestamps(chunks);
  const turns: SpeakerTurn[] = [];
  for (const p of points) {
    const last = turns[turns.length - 1];
    if (
      last
      && last.speaker === p.speaker
      && p.hasExplicitTs
      && p.startMs <= last.endMs + GAP_BACKFILL_MS
    ) {
      turns[turns.length - 1] = {
        speaker: last.speaker,
        startMs: last.startMs,
        endMs: Math.max(last.endMs, p.endMs),
        text: (last.text + ' ' + p.text).trim(),
        chunkCount: last.chunkCount + 1,
      };
    } else {
      turns.push({
        speaker: p.speaker,
        startMs: p.startMs,
        endMs: p.endMs,
        text: p.text,
        chunkCount: 1,
      });
    }
  }
  // Chronological order regardless of input arrival order.
  turns.sort((a, b) => a.startMs - b.startMs);
  return turns;
}

/** Aggregate counts per speaker (used for the legend). */
export interface SpeakerStats {
  readonly speaker: SpeakerLabel;
  readonly turns: number;
  readonly chunks: number;
  readonly textChars: number;
  readonly totalMs: number;
}

export function countSpeakers(turns: ReadonlyArray<SpeakerTurn>): ReadonlyArray<SpeakerStats> {
  const acc = new Map<SpeakerLabel, { turns: number; chunks: number; chars: number; ms: number }>();
  for (const t of turns) {
    const a = acc.get(t.speaker) ?? { turns: 0, chunks: 0, chars: 0, ms: 0 };
    a.turns += 1;
    a.chunks += t.chunkCount;
    a.chars += t.text.length;
    a.ms += Math.max(0, t.endMs - t.startMs);
    acc.set(t.speaker, a);
  }
  // Stable order: interviewer → candidate → unknown
  return SPEAKER_ORDER.filter((s) => acc.has(s)).map((speaker) => {
    const a = acc.get(speaker)!;
    return {
      speaker,
      turns: a.turns,
      chunks: a.chunks,
      textChars: a.chars,
      totalMs: a.ms,
    };
  });
}

/** Total ms spanned by a turn timeline. */
export function totalSpanMs(turns: ReadonlyArray<SpeakerTurn>): number {
  if (turns.length === 0) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (const t of turns) {
    if (t.startMs < min) min = t.startMs;
    if (t.endMs > max) max = t.endMs;
  }
  return Math.max(0, max - min);
}

/** Returns the speaker with the most talk time, or null if no turns. */
export function dominantSpeaker(
  turns: ReadonlyArray<SpeakerTurn>,
): SpeakerLabel | null {
  const stats = countSpeakers(turns);
  if (stats.length === 0) return null;
  return stats.reduce((best, s) => (s.totalMs > best.totalMs ? s : best)).speaker;
}

/** Format ms as `MM:SS` (negative or NaN becomes `00:00`). */
export function formatMmSs(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
