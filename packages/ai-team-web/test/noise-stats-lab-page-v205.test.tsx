// V205: NoiseStatsLabPage tests — wires V204 NoiseStatsPanel into a
// small interactive SPA page at /noise-stats-lab.
//
// Surfaces:
//   1. Initial render: idle / empty-state meter.
//   2. Pushing "loud" flips the level chip to "loud".
//   3. Pushing "clipping" flips the chip to "clipping".
//   4. Reset clears the window and brings the meter back to quiet.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoiseStatsLabPage } from '../src/pages/NoiseStatsLabPage';

beforeEach(() => {
  cleanup();
});

function mountPage() {
  return render(
    <MemoryRouter>
      <NoiseStatsLabPage />
    </MemoryRouter>,
  );
}

function level(): string | null {
  const root = document.querySelector('[data-testid="ns-lab-panel"]');
  return root?.getAttribute('data-level') ?? null;
}

function chunkCount(): number {
  const root = document.querySelector('[data-testid="ns-lab-panel"]');
  return Number(root?.getAttribute('data-chunk-count') ?? '0');
}

describe('NoiseStatsLabPage', () => {
  it('renders the initial quiet state with empty window', () => {
    mountPage();
    expect(
      screen.getByTestId('noise-stats-lab-page'),
    ).toBeTruthy();
    expect(level()).toBe('quiet');
    // Reset button is wired.
    expect(screen.getByTestId('ns-lab-reset')).toBeTruthy();
  });

  it('flips the level chip to loud after pushing loud samples', () => {
    mountPage();
    fireEvent.click(screen.getByTestId('ns-lab-push-loud'));
    fireEvent.click(screen.getByTestId('ns-lab-push-loud'));
    fireEvent.click(screen.getByTestId('ns-lab-push-loud'));
    expect(chunkCount()).toBeGreaterThan(0);
    expect(['loud', 'clipping']).toContain(level());
  });

  it('flips the level chip to clipping after pushing a saturated chunk', () => {
    mountPage();
    fireEvent.click(screen.getByTestId('ns-lab-push-clipping'));
    expect(level()).toBe('clipping');
  });

  it('reset clears the window back to quiet', () => {
    mountPage();
    fireEvent.click(screen.getByTestId('ns-lab-push-loud'));
    fireEvent.click(screen.getByTestId('ns-lab-push-clipping'));
    expect(['loud', 'clipping']).toContain(level());
    fireEvent.click(screen.getByTestId('ns-lab-reset'));
    expect(level()).toBe('quiet');
    expect(chunkCount()).toBe(0);
  });
});
