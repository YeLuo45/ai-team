// V202: nav-groups sanity — /eval-dashboard link is wired into the
// intelligence group so V201 is discoverable from the sidebar.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PRIMARY_NAV_GROUPS, findNavItemByPath } from '../src/components/design-system/nav-groups';
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

describe('V202 nav wiring', () => {
  it('registers /eval-dashboard in the intelligence nav group', () => {
    const match = findNavItemByPath('/eval-dashboard');
    expect(match).not.toBeNull();
    expect(match?.group.key).toBe('intelligence');
    expect(match?.item.label).toBe('Eval 仪表盘');
    expect(match?.item.testId).toBe('nav-eval-dashboard');
  });

  it('exposes the new sidebar link via AppShell', () => {
    render(
      <MemoryRouter initialEntries={['/eval-dashboard']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('nav-eval-dashboard')).toBeTruthy();
  });

  it('keeps the intelligence group order intact (orchestration → agents → agent-config → eval-dashboard)', () => {
    const intelligence = PRIMARY_NAV_GROUPS.find((g) => g.key === 'intelligence');
    expect(intelligence).toBeDefined();
    const paths = intelligence!.items.map((i) => i.path);
    const evalIdx = paths.indexOf('/eval-dashboard');
    expect(evalIdx).toBeGreaterThan(paths.indexOf('/agent-config'));
  });
});