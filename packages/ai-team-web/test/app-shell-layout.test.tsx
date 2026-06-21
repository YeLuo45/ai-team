// V30: App shell centered responsive layout tests
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.js';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })) as any;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('V30 App shell layout', () => {
  it('keeps header, main, and footer centered with the same shell width', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('app-header-shell').className).toContain('mx-auto');
    expect(screen.getByTestId('app-header-shell').className).toContain('max-w-7xl');
    expect(screen.getByTestId('app-main-shell').className).toContain('mx-auto');
    expect(screen.getByTestId('app-main-shell').className).toContain('max-w-7xl');
    expect(screen.getByTestId('app-footer-shell').className).toContain('mx-auto');
    expect(screen.getByTestId('app-footer-shell').className).toContain('max-w-7xl');
  });

  it('wraps navigation symmetrically instead of overflowing on narrow screens', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    const header = screen.getByTestId('app-header-shell');
    const nav = screen.getByTestId('app-primary-nav');
    expect(header.className).toContain('flex-wrap');
    expect(header.className).toContain('justify-center');
    expect(nav.className).toContain('flex-wrap');
    expect(nav.className).toContain('justify-center');
    expect(nav.className).toContain('max-w-full');
  });
});
