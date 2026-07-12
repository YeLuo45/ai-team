// V195: SubtitleExportButton — one-click download for V195 subtitles in
// SRT / VTT / JSON / NDJSON format. Backed by `subtitleBlob` from
// lib/subtitle/export so the formatters are reusable in scripts.

import { type ReactElement, useMemo, useState } from 'react';
import {
  serializeSubtitles,
  subtitleBlob,
  subtitleFilename,
  downloadSubtitle,
  type SubtitleFormat,
} from '../../lib/subtitle/export';
import type { SubtitleChunk } from '../../lib/subtitle';

export interface SubtitleExportButtonProps {
  testId?: string;
  chunks: ReadonlyArray<SubtitleChunk>;
  defaultFormat?: SubtitleFormat;
  baseName?: string;
}

const FORMATS: ReadonlyArray<SubtitleFormat> = ['srt', 'vtt', 'json', 'ndjson'];

export function SubtitleExportButton({
  testId = 'sub-export',
  chunks,
  defaultFormat = 'srt',
  baseName = 'ai-team-subtitles',
}: SubtitleExportButtonProps): ReactElement {
  const [format, setFormat] = useState<SubtitleFormat>(defaultFormat);
  const [lastDownload, setLastDownload] = useState<string | null>(null);
  const payload = useMemo(
    () =>
      chunks.map((c) => ({
        index: 0,
        startMs: c.startMs,
        endMs: c.endMs ?? c.startMs + 1,
        text: c.text,
      })),
    [chunks],
  );
  const handleClick = () => {
    const raw = serializeSubtitles(chunks, { format });
    const blob = subtitleBlob(raw, format);
    const filename = subtitleFilename(baseName, format);
    downloadSubtitle(blob, filename);
    setLastDownload(filename);
  };
  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
      data-testid={testId}
      data-payload-size={payload.length}
    >
      <select
        data-testid={`${testId}-format`}
        className="rounded border border-slate-300 dark:border-slate-700 bg-transparent py-0.5 text-xs"
        value={format}
        onChange={(e) => setFormat(e.target.value as SubtitleFormat)}
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {f.toUpperCase()}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded bg-blue-600 px-2 py-0.5 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
        onClick={handleClick}
        disabled={chunks.length === 0}
        data-testid={`${testId}-button`}
        data-format={format}
      >
        Export
      </button>
      {lastDownload ? (
        <span data-testid={`${testId}-last`} className="text-slate-500">
          {lastDownload}
        </span>
      ) : null}
    </div>
  );
}
