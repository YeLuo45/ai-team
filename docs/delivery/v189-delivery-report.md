V189 ships a small test-infrastructure module so future code can
drain microtasks + React-18 commits reliably when assertions follow
an async click or a streaming transition.

Component (lib/test/timing-stabilizer.ts, 70 lines):
  - flushUntil(predicate?, maxIterations=5, innerDelayMs=1)
      Drains microtasks + a macrotask inside an `act` block until
      predicate() returns truthy OR maxIterations exhausted.
  - commit()
      Awaits a single microtask inside `act`, useful after
      `fireEvent` to let React 18 finish the synchronous render phase
      before reading the DOM.

Why it exists
-------------
V186 EvalRunnerStreaming and V190 WaveformDiffView both flush the
streaming harness or the per-frame renderer asynchronously. In
jsdom + happy-dom under fake timers, the timer queue is starved
between `await act(async => {})` blocks, so the React commit can
land after the assertion read — making the test flaky. flushUntil
sidesteps this by exiting an act block only when the queue is quiet.

Tests (4):
  - flushUntil no-predicate resolves
  - flushUntil stops early when predicate satisfied
  - flushUntil respects maxIterations
  - commit single-microtask

These tests use real timers so the microtask + macrotask queue
actually runs (fake timers would starve setImmediate()).

tsc --noEmit clean. verify:readme 40/40.
