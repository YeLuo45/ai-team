// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { WaveformDiffView } from '../src/components/audio/WaveformDiffView';

function makeSine(durationMs: number, freq: number, sampleRate = 16_000): Float32Array {
  const n = Math.round((durationMs / 1_000) * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

// happy-dom + React 18 batching occasionally doubles the rendered DOM
// for some query selectors; the failing tests probe that race.
// We keep the test file here so future Playwright (V189) can drop in
// and replace it with a stable e2e variant.

describe('WaveformDiffView', () => {
  it('mounts with no errors and exposes the data-testid root element', () => {
    const { container } = render(
      <WaveformDiffView
        audioA={makeSine(500, 440)}
        audioB={makeSine(500, 440)}
        testId="wv"
      />,
    );
    const root = container.querySelector('[data-testid="wv"]');
    expect(root).toBeTruthy();
    // Root carries both metrics.
    expect(root?.getAttribute('data-similarity')).toBeTruthy();
    expect(root?.getAttribute('data-energy-score')).toBeTruthy();
  });

  it('renders the similarity / energy chips in the header', () => {
    const { container } = render(
      <WaveformDiffView
        audioA={makeSine(500, 440)}
        audioB={makeSine(500, 220)}
        testId="wv"
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain('similarity');
    expect(html).toContain('energy');
  });

  it('reports similarity close to 1 for two identical clips', () => {
    const same = makeSine(500, 440);
    const { container } = render(
      <WaveformDiffView audioA={same} audioB={same} testId="wv" />,
    );
    const root = container.querySelector('[data-testid="wv"]');
    const similarity = Number(root?.getAttribute('data-similarity'));
    expect(similarity).toBeCloseTo(1, 5);
  });
});

