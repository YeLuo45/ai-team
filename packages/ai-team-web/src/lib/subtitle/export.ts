// V195: Pure subtitle export helpers — wraps the V185 cue pipeline
// in the same shape V182 exposes for eval results.

import {
  chunksToSrt,
  chunksToVtt,
  chunkToCues,
  normaliseChunks,
  type SubtitleChunk,
  type SrtCue,
} from './cue';

export type SubtitleFormat = 'srt' | 'vtt' | 'json' | 'ndjson';

export interface SubtitleExportOptions {
  format: SubtitleFormat;
  /** Format-specific overrides — pause, max CueDurationMs, etc. */
  maxCueChars?: number;
  maxCueDurationMs?: number;
}

export interface SubtitleEnvelope {
  format: SubtitleFormat;
  exportedAt: string;
  count: number;
  cues: Array<{ index: number; startMs: number; endMs: number; text: string }>;
}

/** Flatten V185 chunks to SRT-cue list. */
export function subtitleToCues(
  chunks: ReadonlyArray<SubtitleChunk>,
): SrtCue[] {
  return chunkToCues(chunks);
}

/** Serialize subtitle chunks into the requested format. */
export function serializeSubtitles(
  chunks: ReadonlyArray<SubtitleChunk>,
  opts: SubtitleExportOptions,
): string {
  switch (opts.format) {
    case 'srt':
      return chunksToSrt(chunks, {
        maxCueChars: opts.maxCueChars,
        maxCueDurationMs: opts.maxCueDurationMs,
      });
    case 'vtt':
      return chunksToVtt(chunks, {
        maxCueChars: opts.maxCueChars,
        maxCueDurationMs: opts.maxCueDurationMs,
      });
    case 'json': {
      const cues = subtitleToCues(normaliseChunks(chunks));
      const env: SubtitleEnvelope = {
        format: 'json',
        exportedAt: new Date().toISOString(),
        count: cues.length,
        cues: cues.map((c) => ({
          index: c.index,
          startMs: c.startMs,
          endMs: c.endMs,
          text: c.text,
        })),
      };
      return JSON.stringify(env, null, 2) + '\n';
    }
    case 'ndjson': {
      const cues = subtitleToCues(normaliseChunks(chunks));
      return (
        cues
          .map((c) =>
            JSON.stringify({
              index: c.index,
              startMs: c.startMs,
              endMs: c.endMs,
              text: c.text,
            }),
          )
          .join('\n') + '\n'
      );
    }
  }
}

/** MIME type per format — used for the downloader to set the right
 *  charset / extension when the host environment chooses. */
export function subtitleMime(format: SubtitleFormat): string {
  switch (format) {
    case 'srt':
      return 'application/x-subrip';
    case 'vtt':
      return 'text/vtt';
    case 'json':
      return 'application/json';
    case 'ndjson':
      return 'application/x-ndjson';
  }
}

/** Create a Blob with the given text and format. */
export function subtitleBlob(
  body: string,
  format: SubtitleFormat,
): Blob {
  return new Blob([body], { type: subtitleMime(format) + ';charset=utf-8' });
}

/** Suggested filename for an export. Falls back to .md / .srt / .vtt
 *  suffixes for cue-based formats. */
export function subtitleFilename(
  baseName: string,
  format: SubtitleFormat,
): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  const ext = format;
  return `${baseName}-${stamp}.${ext}`;
}

/** Trigger a download in the browser. No-op outside a window context. */
export function downloadSubtitle(
  blob: Blob,
  filename: string,
): { skipped: boolean; filename: string } {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return { skipped: true, filename };
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { skipped: false, filename };
}
