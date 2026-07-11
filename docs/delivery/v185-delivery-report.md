V185 ships the realtime subtitle pipeline AI-team needs to surface
interview transcripts as SRT/VTT files. It complements V180/V183
audio capture and V177/V174 privacy + STT provider work by exposing
pure helpers that turn chunked transcripts into standard subtitle
artifacts.

Components:

  lib/subtitle/cue.ts (245 lines):
    - SubtitleChunk / SrtCue / VttCue / NormalisedChunk types
    - formatSrtTimestamp / formatVttTimestamp (canonical SRT/VTT)
    - normaliseChunks (sort + fill endMs + drop invalid)
    - chunkToCues (chunk list -> cue array, maxCueDurationMs / maxCueChars)
    - chunksToSrt / chunksToVtt (full file bodies)

  lib/subtitle/stream.ts (160 lines):
    - SubtitleAccumulator class: push() / close() / state() / reset()
    - FlushEvent (per-flush snapshot of stable cues + flushThroughMs)
    - Append-only semantics — cues grow monotonically
    - flushIntervalMs gates the rate of intermediate flushes
    - maxCues + maxBufferMs caps prevent memory growth
    - runStreamingSubtitles convenience helper for batched chunks

  lib/subtitle/index.ts (barrel) re-exports everything above.

Test coverage: 23 tests (15 cue.ts + 8 stream.ts) — all green.
tsc --noEmit clean. verify:readme 40/40 still passing.
docs/delivery/v185-delivery-report.md + index updated.

NEXT: V187 EvalTimeline, V190 WaveformDiffView Component.
