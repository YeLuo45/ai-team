V190 ships the React UI component that visualises the V184
WaveformDiff layer. It pairs the pure waveform helpers with a small
presentational card so AI-team's reviews, dashboards, and the future
record/replay V184/V188 tools have a concrete comparison surface.

Component (components/audio/WaveformDiffView.tsx, 167 lines):
  - Pure presentational component; zero side-effects, zero network
    calls.
  - Accepts two Float32Arrays / array-like buffers + an optional
    sampleRate (default 16 kHz) + optional frameSize + barCount
    (default 80) + labels for each clip.
  - Computes the V184 diff internally with `useMemo` to keep
    rendering snappy even when the parent passes the same buffers
    across multiple re-renders.
  - Renders:
      * A header chip strip with similarity %, energy Δ %, and the
        louder-clip label.
      * Two stacked horizontal bar rows — clip A coloured sky,
        clip B coloured violet. Each row is `barCount` segments
        tall, with bar height proportional to per-frame RMS.
      * Per-row labels ("orig" / "re-recorded" / "Clip A" / etc.).
  - Adds `defaultFrameSizeForSampleRate(sampleRate)` to the V184
    helpers so consumers can ask "what's a sensible 16 ms frame at
    this rate?" without having to know the convention.

Test coverage: 3 active tests — all green. Component is intentionally
simple so we can rely on React Testing Library's DOM querying and
skip the happy-dom timing bites seen with V186.

Components tested:
  - mount + data-testid root element exposes similarity/energy
  - renders similarity/energy header chips
  - identical clips -> similarity close to 1

tsc --noEmit clean. verify:readme 40/40.
