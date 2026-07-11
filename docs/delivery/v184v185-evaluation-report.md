V184V185 / V186 re-enable attempt — conclusion.

The V186 EvalRunnerStreaming timing tests (the two marked `it.skip`
in V186's report) were revisited with the V189 timing-stabiliser
helper. Findings:

  - The stabiliser flushes microtasks + a macrotask inside an
    `act()` wrap, which is exactly the missing piece that the
    happy-dom suite had been starving.
  - When run individually each timing-sensitive test passes.
  - When run in the full V186 suite (8 tests sharing one
    happy-dom VM) the streaming tests still occasionally miss
    the commit. Tests A, E, F remain stable; tests B, C, D, G
    drop rows because the streaming loop's setResult lands one
    microtask too late.
  - The cause is happy-dom's shared microtask queue across
    `render()`s — addresses it would require moving the
    components to a real-browser harness (Playwright, see V189
    follow-ups).

Decision: keep the original 6-active / 2-skip V186 layout as the
shipped behaviour. The V189 helpers remain useful for any future
test that doesn't share a suite. V184V185 was a zero-net-ship
investigation — no source/commit change here.
