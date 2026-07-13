// V205: NoiseStatsLabPage — wires the V204 NoiseStatsPanel into the SPA
// at /noise-stats-lab. Pure interactive demo page that owns a
// NoiseSlidingWindow + 4 push-buttons (quiet / normal / loud / clipping)
// so reviewers can see the meter react live without a real microphone.
//
// The page uses 200 sample synth chunks (~12.5ms @ 16 kHz) so the
// sliding window (default size 16) gets several pushes per click.
// Generated chunks carry the same shape as V192's AudioSource emits.

import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { NoiseStatsPanel } from '../components/audio/NoiseStatsPanel';
import {
  NoiseSlidingWindow,
  summariseNoise,
  type NoiseSummary,
} from '../lib/audio/noise-stats';
import type { AudioChunk } from '../lib/stt/audio-source';

const SAMPLE_RATE = 16_000;
const WINDOW_SIZE = 16;

function makeChunk(amplitude: number, freq: number): AudioChunk {
  const n = 200;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return {
    samples,
    sampleRate: SAMPLE_RATE,
    startMs: 0,
  };
}

function makeClippingChunk(): AudioChunk {
  const n = 200;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = i % 2 === 0 ? 1 : -1;
  }
  return {
    samples,
    sampleRate: SAMPLE_RATE,
    startMs: 0,
  };
}

const WINDOW = new NoiseSlidingWindow(WINDOW_SIZE, {
  silenceThreshold: 0.01,
});

export function NoiseStatsLabPage(): ReactElement {
  const [, setTick] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [summary, setSummary] = useState<NoiseSummary>(() =>
    summariseNoise([], { silenceThreshold: 0.01 }),
  );

  const push = useCallback((chunk: AudioChunk) => {
    WINDOW.push(chunk);
    setHistory((prev) => [...prev, summariseNoise(WINDOW.snapshot()).rmsMean]);
    setSummary(summariseNoise(WINDOW.snapshot()));
    setTick((t) => t + 1);
  }, []);

  const reset = useCallback(() => {
    WINDOW.reset();
    setHistory([]);
    setSummary(summariseNoise([], { silenceThreshold: 0.01 }));
    setTick((t) => t + 1);
  }, []);

  const pushQuiet = useCallback(() => push(makeChunk(0.005, 220)), [push]);
  const pushNormal = useCallback(() => push(makeChunk(0.15, 440)), [push]);
  const pushLoud = useCallback(() => push(makeChunk(0.95, 660)), [push]);
  const pushClipping = useCallback(() => push(makeClippingChunk()), [push]);

  const controls = useMemo(
    () => [
      { label: 'Push quiet', handler: pushQuiet, testId: 'ns-lab-push-quiet' },
      {
        label: 'Push normal',
        handler: pushNormal,
        testId: 'ns-lab-push-normal',
      },
      { label: 'Push loud', handler: pushLoud, testId: 'ns-lab-push-loud' },
      {
        label: 'Push clipping',
        handler: pushClipping,
        testId: 'ns-lab-push-clipping',
      },
      { label: 'Reset', handler: reset, testId: 'ns-lab-reset' },
    ],
    [pushQuiet, pushNormal, pushLoud, pushClipping, reset],
  );

  return (
    <div className="p-6 space-y-3" data-testid="noise-stats-lab-page">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Noise Stats Lab
        </h2>
        <span
          className="text-xs font-mono text-slate-500"
          data-testid="ns-lab-window-info"
        >
          window={WINDOW_SIZE} sr={SAMPLE_RATE}
        </span>
      </header>

      <NoiseStatsPanel
        testId="ns-lab-panel"
        summary={summary}
        history={history}
        title="Live Capture"
        subtitle={`${history.length} pushes`}
      />

      <div
        className="flex flex-wrap gap-2"
        data-testid="ns-lab-controls"
      >
        {controls.map((c) => (
          <button
            key={c.testId}
            type="button"
            className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={c.handler}
            data-testid={c.testId}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        Synthetic chunks push into a {WINDOW_SIZE}-chunk sliding window.
        Click <strong>Push loud</strong> → meter fills amber.{' '}
        <strong>Push clipping</strong> → meter turns red (peak ≥ 0.99).{' '}
        <strong>Reset</strong> clears the window.
      </p>
    </div>
  );
}

export default NoiseStatsLabPage;
