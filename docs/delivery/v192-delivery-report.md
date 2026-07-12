V192 ships the live STT subtitle pipeline — a small audio-source
abstraction plus a React component that wires it to the V185
SubtitleAccumulator so captions can stream onto the screen as the
microphone (or any other AudioSource) produces them.

Components:

  lib/stt/audio-source.ts (95 lines, 100% lines, 71.42% branches, 100% funcs):
    - AudioSource / AudioChunk shapes.
    - BufferedAudioSource: test-friendly in-memory queue source.
    - chunkDurationMs / chunkRms / isSilent / mergeChunks /
      totalDurationMs helpers.

  components/stt/LiveSubtitlePanel.tsx (152 lines):
    - AudioSource in, captions out — pulls chunks via `audio.next()`,
      gates transcription on a configurable emitIntervalMs so we
      don't call out to the model for every 16ms frame.
    - skipSilence flag + silenceThreshold drop silent chunks to save
      model calls.
    - Internal SubtitleAccumulator (V185) keeps a monotonically
      growing cue list so the caption pane can render the most
      recent cue and a cue log table.
    - data-testid + data-status + data-cue-count attributes for
      stable selectors + downstream tools.

Test coverage: 7 + 3 = 10 tests, all green. tsc --noEmit clean.
verify:readme 40/40.

NEXT: V193 Cross-Session Suggestion Reuse, V194 Readme Sync.
