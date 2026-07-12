// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SubtitleExportButton } from '../src/components/stt/SubtitleExportButton';

describe('SubtitleExportButton', () => {
  it('renders disabled when no chunks are provided', () => {
    const { container } = render(
      <SubtitleExportButton chunks={[]} testId="bx" />,
    );
    const btn = container.querySelector(
      '[data-testid="bx-button"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.disabled).toBe(true);
  });

  it('exposes a format selector with all four formats', () => {
    const { container } = render(
      <SubtitleExportButton
        chunks={[
          { startMs: 0, endMs: 1_000, text: 'hi' },
        ]}
        testId="bx"
      />,
    );
    const sel = container.querySelector(
      '[data-testid="bx-format"]',
    ) as HTMLSelectElement | null;
    expect(sel).toBeTruthy();
    const opts = Array.from(sel?.querySelectorAll('option') ?? []).map(
      (o) => o.getAttribute('value'),
    );
    expect(opts).toEqual(['srt', 'vtt', 'json', 'ndjson']);
  });

  it('reports the chunk count + payload size', () => {
    const { container } = render(
      <SubtitleExportButton
        chunks={[
          { startMs: 0, endMs: 500, text: 'a' },
          { startMs: 600, endMs: 1_000, text: 'b' },
        ]}
        testId="bx"
      />,
    );
    const root = container.querySelector('[data-testid="bx"]');
    expect(root?.getAttribute('data-payload-size')).toBe('2');
  });
});
