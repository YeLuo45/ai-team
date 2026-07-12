V196 ships the NoiseStats helpers — per-chunk RMS + sliding-window
SNR meter for V192's LiveSubtitlePanel. Paired with V184's
waveform diff helpers, the noise meter can light up whenever the
captured audio drifts into clipping / loud / normal / quiet.

Components (lib/audio/noise-stats.ts, 130 lines, 98.52% lines,
92.1% branches, 100% funcs):
  - `summariseNoise(chunks, { silenceThreshold? })` — returns a
    NoiseSummary across an explicit list of chunks (rmsMean,
    rmsMax, peak, signalToSilenceRatio, silentRatio, chunkCount).
  - `NoiseSlidingWindow(windowSize, options)` — push / snapshot /
    reset; rolling window of the most recent chunks.
  - `classifyNoise(summary) → 'quiet' | 'normal' | 'loud' |
    'clipping'` — UI band classifier.
  - `noiseFillPercent(summary)` — convenience for a 0..100 noise
    meter percentage.

Tests (8):
  - summariseNoise empty / homogeneous / silent detection / SNR
    divergence.
  - NoiseSlidingWindow rolling buffer + reset.
  - classifyNoise + noiseFillPercent edge cases.

tsc --noEmit clean. Verify:readme 40/40.

NEXT: V197 SubtitleEditor, V198 ReuseBar Component.
