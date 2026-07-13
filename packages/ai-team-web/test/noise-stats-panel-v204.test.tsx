// V204: NoiseStatsPanel tests — presentational UI on top of V196's
// NoiseStats helpers (summariseNoise + classifyNoise + noiseFillPercent).
//
// Three surfaces:
//   1. Default empty state — level="quiet", fill=0, no history block
//   2. Chunks path — synthesises a sine buffer and verifies the panel
//      picks up the non-quiet level via summariseNoise
//   3. History sparkline — renders downsampled bars when history given
//   4. Pre-computed summary path — explicit `summary` prop wins
//   5. Clipping path — peak >= 0.99 triggers the clipping tone

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NoiseStatsPanel } from '../src/components/audio/NoiseStatsPanel';
import { summariseNoise, type NoiseSummary } from '../src/lib/audio/noise-stats';
import type { AudioChunk } from '../src/lib/stt/audio-source';

function makeSine(
  durationMs: number,
  freq: number,
  amplitude = 0.6,
  sampleRate = 16_000,
): Float32Array {
  const n = Math.round((durationMs / 1_000) * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

function makeChunk(samples: Float32Array, sampleRate = 16_000): AudioChunk {
  return {
    samples,
    sampleRate,
    channelCount: 1,
    capturedAtMs: 1_700_000_000_000,
  };
}

describe('NoiseStatsPanel (V204)', () => {
  it('renders the empty-state shell with level="quiet" and fill=0', () => {
    const { container } = render(<NoiseStatsPanel testId="ns" />);
    const root = container.querySelector('[data-testid="ns"]');
    expect(root).toBeTruthy();
    expect(root?.getAttribute('data-level')).toBe('quiet');
    expect(root?.getAttribute('data-fill')).toBe('0');
    expect(root?.getAttribute('data-chunk-count')).toBe('0');
    expect(root?.querySelector('[data-testid="ns-level"]')).toBeTruthy();
    // No history block by default.
    expect(
      container.querySelector('[data-testid="ns-history"]'),
    ).toBeNull();
  });

  it('auto-summarises raw chunks via summariseNoise', () => {
    // Amplitude near 0.95 so the per-frame RMS exceeds the 0.6 loud
    // threshold used by V196's classifyNoise helper.
    const chunks: AudioChunk[] = [
      makeChunk(makeSine(500, 440, 0.95)),
      makeChunk(makeSine(500, 660, 0.95)),
    ];
    const { container } = render(
      <NoiseStatsPanel testId="ns" chunks={chunks} />,
    );
    const root = container.querySelector('[data-testid="ns"]');
    expect(root?.getAttribute('data-level')).toBe('loud');
    // 2 chunks → summary must record them.
    expect(root?.getAttribute('data-chunk-count')).toBe('2');
    // Loud fill bar at least 1px wide.
    const fill = container.querySelector('[data-testid="ns-bar-fill"]');
    expect(Number(fill?.getAttribute('data-fill-percent'))).toBeGreaterThan(
      0,
    );
  });

  it('classifies a saturated signal as clipping', () => {
    const saturation = new Float32Array(16_000);
    for (let i = 0; i < saturation.length; i++) {
      saturation[i] = i % 2 === 0 ? 1 : -1;
    }
    const summary: NoiseSummary = summariseNoise([
      makeChunk(saturation),
    ]);
    expect(summary.peak).toBeGreaterThanOrEqual(0.99);
    const { container } = render(
      <NoiseStatsPanel testId="ns" summary={summary} />,
    );
    expect(
      container.querySelector('[data-testid="ns"]')?.getAttribute('data-level'),
    ).toBe('clipping');
  });

  it('renders a downsampled history sparkline when history given', () => {
    const history = Array.from({ length: 50 }, (_, i) =>
      // Smooth ramp 0 → 1 → 0
      Math.sin((i / 50) * Math.PI),
    );
    const { container } = render(
      <NoiseStatsPanel testId="ns" history={history} historyBars={20} />,
    );
    const historyEl = container.querySelector('[data-testid="ns-history"]');
    expect(historyEl).toBeTruthy();
    const bars = container.querySelectorAll(
      '[data-testid^="ns-history-bar-"]',
    );
    expect(bars.length).toBe(20);
  });

  it('surfaces the pre-computed summary stats in the dl grid', () => {
    const summary: NoiseSummary = {
      rmsMean: 0.12,
      rmsMax: 0.45,
      peak: 0.8,
      signalToSilenceRatio: 6,
      silentRatio: 0.25,
      chunkCount: 8,
    };
    const { container } = render(
      <NoiseStatsPanel testId="ns" summary={summary} />,
    );
    expect(
      container.querySelector('[data-testid="ns-rms-mean"]')?.textContent,
    ).toContain('0.12');
    expect(
      container.querySelector('[data-testid="ns-rms-max"]')?.textContent,
    ).toContain('0.45');
    expect(
      container.querySelector('[data-testid="ns-snr"]')?.textContent,
    ).toContain('6.00');
    expect(
      container.querySelector('[data-testid="ns-silent"]')?.textContent,
    ).toContain('25%');
    expect(
      container.querySelector('[data-testid="ns-chunks"]')?.textContent,
    ).toContain('8');
  });
});
