// V189: Test timing stabiliser — helpers for flushing microtask
// queues and React-18 commits reliably across jsdom + happy-dom
// without depending on real time advancing.
//
// Why this exists
// ---------------
// React 18's automatic batching queues microtask-launched setState
// calls and flushes them inside one commit. In jsdom and happy-dom,
// the timer queue is sometimes starved between `await act(async)`
// blocks, which makes timing-sensitive UI tests flaky. A
// `fireEvent.click(start)` followed by `await act(async () => {})`
// can exit before the streaming harness (or whatever async code the
// component kicked off) has had a chance to update state and commit
// the DOM.
//
// This module ships a single helper, `flushUntil`, that drains
// pending microtasks + a few macrotask ticks until either the caller
// specifies it's done, or the supplied predicate returns true.
//
// Usage
// -----
//   import { act, flushUntil } from '@testing-library/react';
//   import { flushUntil } from '../../../src/lib/test/timing-stabilizer';
//
//   await act(async () => {
//     fireEvent.click(start);
//     // drain: microtasks → DOM commit → microtasks → DOM commit ...
//     await flushUntil(() =>
//       !!container.querySelector('[data-testid="es-done"]'),
//     );
//   });

import { act as actImpl } from '@testing-library/react';

/** Yield repeatedly to drain React 18's microtask queue + DOM commit
 *  cycle. We stop early when the supplied predicate returns true.
 *
 *  @param predicate  optional. When provided, loop until predicate()
 *                   returns truthy OR after `maxIterations` attempts.
 *  @param maxIterations  upper bound on flush cycles; defaults to 5.
 *  @param innerDelayMs  micro-delay between iterations; defaults to 0.
 *
 *  In practice 5 iterations is enough for a 2-3 step rendering chain.
 */
export async function flushUntil(
  predicate?: () => boolean,
  maxIterations = 5,
  innerDelayMs = 1,
): Promise<void> {
  let iterations = 0;
  while (iterations < maxIterations) {
    iterations += 1;
    // Run inside an `act` block so React commits happen promptly.
    await actImpl(async () => {
      // Yield to scheduled microtasks multiple times so setState
      // chains nest fully.
      await new Promise<void>((resolve) => {
        if (typeof setImmediate === 'function') {
          setImmediate(resolve);
        } else {
          setTimeout(resolve, innerDelayMs);
        }
      });
      // Two more microtasks for state updates spawned inside the
      // prior step.
      await Promise.resolve();
      await Promise.resolve();
    });
    if (predicate && predicate()) {
      return;
    }
  }
}

/** Force a single DOM commit. Useful after `fireEvent` to let React
 *  finish the synchronous render phase. */
export async function commit(): Promise<void> {
  await actImpl(async () => {
    await Promise.resolve();
  });
}
