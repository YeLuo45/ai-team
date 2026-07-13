// V203: PrivacyOverrideLogPage tests — wires V200 PrivacyOverrideLogView
// into the SPA route /privacy-override-log.
//
// Three surfaces:
//   1. Empty state when no localStorage events
//   2. Render events pulled from the V188 STORAGE_KEY
//   3. Highlight-op chips surface all 4 PrivacyOpKind values

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyOverrideLogPage } from '../src/pages/PrivacyOverrideLogPage';
import type { PrivacyOverrideEvent } from '../src/lib/privacy/override-log';

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
const STORAGE_KEY = 'ai-team:privacy-override-log';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function writeEvents(events: PrivacyOverrideEvent[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events }));
}

describe('PrivacyOverrideLogPage', () => {
  it('renders the empty state when localStorage has no events', () => {
    render(
      <MemoryRouter>
        <PrivacyOverrideLogPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('privacy-override-log-page')).toBeTruthy();
    expect(screen.getByTestId('polp')).toBeTruthy();
    expect(screen.getByTestId('polp-empty')).toBeTruthy();
  });

  it('surfaces stored events to the V200 view', () => {
    writeEvents([
      {
        id: 'ev-1',
        op: 'export-audio',
        outcome: 'allowed',
        reason: 'demo',
        decidedAtMs: NOW - 5 * 60_000,
        actor: 'alice',
      },
      {
        id: 'ev-2',
        op: 'export-interview',
        outcome: 'denied',
        reason: 'no consent',
        decidedAtMs: NOW - 2 * 60 * 60_000,
        actor: 'bob',
      },
    ]);
    render(
      <MemoryRouter>
        <PrivacyOverrideLogPage />
      </MemoryRouter>,
    );
    const root = screen.getByTestId('polp');
    expect(root.getAttribute('data-total')).toBe('2');
    expect(root.getAttribute('data-allowed')).toBe('1');
    expect(root.getAttribute('data-denied')).toBe('1');
    expect(screen.getByTestId('polp-row-ev-1')).toBeTruthy();
    expect(screen.getByTestId('polp-row-ev-2')).toBeTruthy();
  });

  it('falls back gracefully on corrupt localStorage payloads', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    render(
      <MemoryRouter>
        <PrivacyOverrideLogPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('polp-empty')).toBeTruthy();
  });

  it('renders the 4 highlight-op chips even when no events exist', () => {
    render(
      <MemoryRouter>
        <PrivacyOverrideLogPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('polp-op-export-audio')).toBeTruthy();
    expect(screen.getByTestId('polp-op-export-interview')).toBeTruthy();
    expect(screen.getByTestId('polp-op-clipboard-copy')).toBeTruthy();
    expect(screen.getByTestId('polp-op-remote-stream')).toBeTruthy();
  });
});