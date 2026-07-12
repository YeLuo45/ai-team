V195 ships a one-click subtitle export button and the helpers that
back it, fusing V185's chunks with V182's formatting know-how.

Components:

  lib/subtitle/export.ts (105 lines, 96.77% lines / 100% funcs):
    - `serializeSubtitles(chunks, { format })` — emits a full file body
      for srt / vtt / json / ndjson formats.
    - `subtitleBlob(body, format)` — wrapped Blob with a per-format
      MIME type.
    - `subtitleMime(format)` — type-guard-driven MIME lookup.
    - `subtitleFilename(baseName, format)` — adds the ISO timestamp
      + extension automatically.
    - `downloadSubtitle(blob, filename)` — browser download helper
      that gracefully returns `{ skipped:true, filename }` when
      document / URL.createObjectURL are unavailable.

  components/stt/SubtitleExportButton.tsx (82 lines):
    - Format selector + disabled-when-empty Export button.
    - `data-testid` / `data-format` / `data-payload-size` /
      `data-last-download` attributes for stable selectors +
      downstream tools.
    - Pure presentational — no network, no internal state besides
      the chosen format.

Tests:
  - 9 helpers tests (subtitle-export-v195.test.ts) — all green.
  - 3 component tests (subtitle-export-button-v195.test.tsx) — all
    green.
  - 12 total. Coverage on lib/subtitle/export.ts ≥95%.

tsc --noEmit clean. verify:readme 40/40.
