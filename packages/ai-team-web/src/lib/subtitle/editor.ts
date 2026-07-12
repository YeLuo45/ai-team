// V197: SubtitleEditor helpers — edit / correct / delete cues from
// V185's streaming pipeline. Pure functions so the UI component
// stays presentational.

import {
  chunkToCues,
  type SubtitleChunk,
  type SrtCue,
} from './cue';

/** Apply a transcription correction to a cue list. */
export interface CueEdit {
  /** Cue index to apply the edit to. */
  cueIndex: number;
  /** New text for the cue. */
  text?: string;
  /** New start time in ms (optional). */
  startMs?: number;
  /** New end time in ms (optional). */
  endMs?: number;
  /** If true, drop the cue entirely. */
  drop?: boolean;
}

export interface EditResult {
  cues: ReadonlyArray<SrtCue>;
  /** Indices that were dropped in this edit. */
  droppedIndices: ReadonlyArray<number>;
}

/** Pure edit application — does not mutate the input array. */
export function applyEdits(
  cues: ReadonlyArray<SrtCue>,
  edits: ReadonlyArray<CueEdit>,
): EditResult {
  const byIndex = new Map<number, CueEdit>();
  for (const e of edits) byIndex.set(e.cueIndex, e);
  const dropped: number[] = [];
  const out: SrtCue[] = [];
  for (const cue of cues) {
    const edit = byIndex.get(cue.index);
    if (!edit) {
      out.push(cue);
      continue;
    }
    if (edit.drop) {
      dropped.push(cue.index);
      continue;
    }
    out.push({
      index: cue.index,
      startMs: edit.startMs ?? cue.startMs,
      endMs: edit.endMs ?? cue.endMs,
      text: edit.text ?? cue.text,
    });
  }
  // After editing, re-number cues 1..N so the indices stay contiguous.
  const renumbered = out.map((c, i) => ({ ...c, index: i + 1 }));
  return { cues: renumbered, droppedIndices: dropped };
}

/** Re-chunk subtitle chunks and re-emit the cue list. Useful after
 *  large deletions leave the cue list sparse. */
export function rebuildFromChunks(
  chunks: ReadonlyArray<SubtitleChunk>,
  options?: { maxCueChars?: number; maxCueDurationMs?: number },
): ReadonlyArray<SrtCue> {
  return chunkToCues(chunks, options);
}

/** Highlight suggested corrections. Two cues are "suspicious" when
 *  they overlap each other (start time of the second is before the
 *  first's end). Returns the cue indices that need attention. */
export function suspiciousOverlaps(
  cues: ReadonlyArray<SrtCue>,
): ReadonlyArray<number> {
  const flagged: number[] = [];
  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const cur = cues[i];
    if (prev && cur && cur.startMs < prev.endMs) flagged.push(cur.index);
  }
  return flagged;
}

/** Mark a cue as "edited" — surfaces metadata we can later persist in
 *  an audit log without changing the cue shape. */
export interface CuedEditsLog {
  cueIndex: number;
  editedAtMs: number;
  before: string;
  after: string;
}

export function appendEditLog(
  current: ReadonlyArray<CuedEditsLog>,
  cueIndex: number,
  before: string,
  after: string,
  nowMs: number,
): ReadonlyArray<CuedEditsLog> {
  if (before === after) return current;
  return [
    ...current,
    { cueIndex, editedAtMs: nowMs, before, after },
  ];
}
