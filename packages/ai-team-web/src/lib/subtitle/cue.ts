// V185: Subtitle cue helpers + SRT/VTT formatters.
//
// We accept `SttChunk`-shaped input (timestamp + text + speaker) and
// produce both SRT and VTT subtitle outputs. Time chunks are
// guaranteed to be ordered with monotonically non-decreasing startMs.
//
//   * `chunkToCues(chunks, options)` — slices the chunk list into
//     cues bounded by `maxCueDurationMs` (default 4000 ms) and a
//     soft cap on character count per cue (default 80 chars) so the
//     result is readable on screen.
//   * `formatSrtTimestamp(ms)` / `formatVttTimestamp(ms)` —
//     per-spec serialisations.
//   * `chunksToSrt(chunks, options)` / `chunksToVtt(chunks, options)` —
//     the full encoded strings ready to hand to the browser.

export interface SubtitleChunk {
  /** When the chunk starts, in milliseconds from interview start. */
  startMs: number;
  /** When the chunk ends, in milliseconds from interview start. Defaults
   *  to startMs + 1 if the source omits it. */
  endMs?: number;
  /** Transcript text. May contain speaker tags already, or raw text. */
  text: string;
  /** Optional speaker label. When set, prefixed in the cue. */
  speaker?: string;
}

export interface SrtCue {
  /** 1-indexed cue number. */
  index: number;
  /** Start time in milliseconds. */
  startMs: number;
  /** End time in milliseconds. */
  endMs: number;
  /** Cue text including optional speaker prefix. */
  text: string;
}

export interface VttCue {
  startMs: number;
  endMs: number;
  id?: string;
  text: string;
  /** Optional WEBVTT placement hint (`line`, `position`, etc.). */
  settings?: string;
}

/** Format a millisecond value as an SRT timestamp `HH:MM:SS,mmm`. */
export function formatSrtTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.round(ms);
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(millis)}`;
}

/** Format a millisecond value as a WEBVTT timestamp `HH:MM:SS.mmm`. */
export function formatVttTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.round(ms);
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

function pad2(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

function pad3(n: number): string {
  if (n < 10) return '00' + n;
  if (n < 100) return '0' + n;
  return '' + n;
}

export interface ChunkToCuesOptions {
  /** Hard cap on cue duration (defaults to 4000ms). */
  maxCueDurationMs?: number;
  /** Soft cap on cue text length — when a chunk exceeds this we
   *  prefer to split at the nearest punctuation / space. */
  maxCueChars?: number;
  /** If true, prefix the cue text with `<speaker>: `. */
  labelSpeakers?: boolean;
}

const DEFAULT_DURATION_MS = 4000;
const DEFAULT_CHARS = 80;

/** Split a string at the closest whitespace / punctuation to a target
 *  length without going over. Returns the original slice if nothing
 *  fits. */
function splitAtBoundary(text: string, maxChars: number): { head: string; tail: string } {
  if (text.length <= maxChars) {
    return { head: text, tail: '' };
  }
  let cut = maxChars;
  // Prefer splitting at the last whitespace before the cut point, falling
  // back to the cut itself when there's no whitespace.
  for (let i = cut; i > maxChars * 0.6; i--) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      cut = i;
      break;
    }
    if (ch === '。' || ch === '？' || ch === '！' || ch === ',' || ch === '.' || ch === ';' || ch === ':') {
      cut = i + 1;
      break;
    }
  }
  return { head: text.slice(0, cut).trimEnd(), tail: text.slice(cut).trimStart() };
}

function infillEndMs(c: SubtitleChunk): number {
  if (typeof c.endMs === 'number' && Number.isFinite(c.endMs) && c.endMs >= c.startMs) {
    return c.endMs;
  }
  return c.startMs + 1;
}

export interface NormalisedChunk {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
}

/** Pre-process a chunk list: copy text content, ensure endMs, and
 *  sort by startMs. The returned chunks have `endMs` guaranteed. */
export function normaliseChunks(
  input: ReadonlyArray<SubtitleChunk>,
): NormalisedChunk[] {
  const out: NormalisedChunk[] = [];
  for (const c of input) {
    if (typeof c.startMs !== 'number' || !Number.isFinite(c.startMs)) continue;
    if (typeof c.text !== 'string' || c.text.length === 0) continue;
    out.push({
      ...c,
      endMs: infillEndMs(c),
      startMs: Math.max(0, c.startMs),
      speaker: c.speaker ?? undefined,
    });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

/** Convert chunks to SRT/VTT cues with text-length soft cap. */
export function chunkToCues(
  input: ReadonlyArray<SubtitleChunk>,
  options: ChunkToCuesOptions = {},
): SrtCue[] {
  const maxDur = options.maxCueDurationMs ?? DEFAULT_DURATION_MS;
  const maxChars = options.maxCueChars ?? DEFAULT_CHARS;
  const label = options.labelSpeakers ?? true;

  const chunks = normaliseChunks(input);
  const cues: SrtCue[] = [];
  let index = 1;

  for (const c of chunks) {
    let { text } = c;
    text = text.replace(/\s+/g, ' ').trim();
    if (label && c.speaker) {
      text = `${c.speaker}: ${text}`;
    }
    if (!text) continue;
    let cursorMs = c.startMs;
    let safety = 0;
    while (text.length > 0 && safety < 50) {
      safety += 1;
      const { head, tail } = splitAtBoundary(text, maxChars);
      const endMs = Math.min(c.endMs, cursorMs + maxDur);
      if (head.length > 0) {
        cues.push({ index: index++, startMs: cursorMs, endMs, text: head });
      }
      cursorMs = endMs;
      text = tail;
      if (cursorMs >= c.endMs && text.length > 0) {
        // The remaining tail spills past the chunk end. Split it at
        // boundary points so each overflow cue stays readable.
        let spillStart = c.endMs;
        let spillText = text;
        while (spillText.length > 0) {
          const seg = splitAtBoundary(spillText, maxChars);
          if (seg.head.length === 0) break;
          cues.push({
            index: index++,
            startMs: spillStart,
            endMs: spillStart + 1,
            text: seg.head,
          });
          spillStart += 1;
          spillText = seg.tail;
          if (seg.tail.length > maxChars * 2) {
            // Force a hard break for pathological inputs.
            cues.push({
              index: index++,
              startMs: spillStart,
              endMs: spillStart + 1,
              text: seg.tail.slice(0, maxChars),
            });
            spillText = seg.tail.slice(maxChars);
            spillStart += 1;
          }
        }
        text = '';
      }
    }
  }
  return cues;
}

/** Build a complete SRT file from a chunk list. */
export function chunksToSrt(
  chunks: ReadonlyArray<SubtitleChunk>,
  options?: ChunkToCuesOptions,
): string {
  const cues = chunkToCues(chunks, options);
  return cues
    .map((c) => `${c.index}\n${formatSrtTimestamp(c.startMs)} --> ${formatSrtTimestamp(c.endMs)}\n${c.text}`)
    .join('\n\n') + '\n';
}

/** Build a complete WEBVTT file from a chunk list. */
export function chunksToVtt(
  chunks: ReadonlyArray<SubtitleChunk>,
  options?: ChunkToCuesOptions,
): string {
  const cues: VttCue[] = chunkToCues(chunks, options).map((c, i) => ({
    id: `cue-${i + 1}`,
    startMs: c.startMs,
    endMs: c.endMs,
    text: c.text,
  }));
  const body = cues
    .map((c) => {
      const idLine = c.id ? `${c.id}\n` : '';
      return `${idLine}${formatVttTimestamp(c.startMs)} --> ${formatVttTimestamp(c.endMs)}\n${c.text}`;
    })
    .join('\n\n');
  if (body.length === 0) {
    return `WEBVTT\n\n`;
  }
  return `WEBVTT\n\n${body}\n`;
}
