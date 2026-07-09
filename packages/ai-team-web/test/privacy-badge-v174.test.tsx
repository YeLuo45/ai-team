// V174: Privacy summary + PrivacyBadge.
//
// Two surfaces:
//   1. Pure helpers (lib/privacy/summary.ts): summarizePrivacy / shortEndpoint /
//      formatEndpoints
//   2. PrivacyBadge component: renders local/mixed/remote variants

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  summarizePrivacy,
  shortEndpoint,
  formatEndpoints,
  type PrivacyInputs,
  type PrivacyStatus,
} from '../src/lib/privacy/summary';
import { PrivacyBadge } from '../src/components/privacy/PrivacyBadge';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ====================================================================
// 1. Pure helpers
// ====================================================================

describe('summarizePrivacy', () => {
  it('returns full-local when both providers are local', () => {
    const status = summarizePrivacy({
      sttLocal: true,
      llmLocal: true,
      sttEndpoint: 'http://127.0.0.1:8178',
      llmEndpoint: 'http://localhost:11434',
    });
    expect(status.mode).toBe('full-local');
    expect(status.tone).toBe('local');
    expect(status.label).toContain('100% 本地');
    expect(status.sttLocal).toBe(true);
    expect(status.llmLocal).toBe(true);
    expect(status.endpoints.length).toBe(2);
  });

  it('returns partial-local when only the STT is local', () => {
    const status = summarizePrivacy({
      sttLocal: true,
      llmLocal: false,
      sttEndpoint: 'http://127.0.0.1:8178',
      llmEndpoint: 'https://api.openai.com',
    });
    expect(status.mode).toBe('partial-local');
    expect(status.tone).toBe('mixed');
    expect(status.label).toContain('部分');
  });

  it('returns partial-local when only the LLM is local', () => {
    const status = summarizePrivacy({
      sttLocal: false,
      llmLocal: true,
    });
    expect(status.mode).toBe('partial-local');
    expect(status.tone).toBe('mixed');
  });

  it('returns remote when neither provider is local', () => {
    const status: PrivacyStatus = summarizePrivacy({
      sttLocal: false,
      llmLocal: false,
      sttEndpoint: 'https://api.openai.com/whisper',
      llmEndpoint: 'https://api.openai.com',
    });
    expect(status.mode).toBe('remote');
    expect(status.tone).toBe('remote');
    expect(status.label).toContain('远程');
  });

  it('omits endpoints that were not supplied', () => {
    const status = summarizePrivacy({ sttLocal: true, llmLocal: true });
    expect(status.endpoints).toEqual([]);
  });

  it('handles falsy flags by coercing them to `false`', () => {
    const status = summarizePrivacy({
      sttLocal: false,
      llmLocal: undefined as unknown as boolean,
    });
    // undefined treated as false → both non-local → `remote`.
    expect(status.mode).toBe('remote');
    expect(status.llmLocal).toBe(false);
  });

  it('exposes endpoints with the correct kinds', () => {
    const status = summarizePrivacy({
      sttLocal: true,
      llmLocal: true,
      sttEndpoint: 'http://localhost:8178/',
      llmEndpoint: 'http://localhost:11434/',
    });
    expect(status.endpoints).toEqual([
      { kind: 'stt', url: 'http://localhost:8178/' },
      { kind: 'llm', url: 'http://localhost:11434/' },
    ]);
  });
});

describe('shortEndpoint', () => {
  it('strips protocol + trailing slash', () => {
    expect(shortEndpoint('http://127.0.0.1:8178/')).toBe('127.0.0.1:8178');
  });

  it('preserves https endpoints', () => {
    expect(shortEndpoint('https://api.openai.com/whisper')).toBe('api.openai.com/whisper');
  });

  it('returns undefined for undefined input', () => {
    expect(shortEndpoint(undefined)).toBeUndefined();
  });

  it('returns the URL unchanged when no protocol is present', () => {
    expect(shortEndpoint('localhost:11434')).toBe('localhost:11434');
  });
});

describe('formatEndpoints', () => {
  it('joins kinds + hosts with one line per provider', () => {
    expect(
      formatEndpoints([
        { kind: 'stt', url: 'http://127.0.0.1:8178' },
        { kind: 'llm', url: 'http://localhost:11434' },
      ]),
    ).toBe('STT: 127.0.0.1:8178\nLLM: localhost:11434');
  });

  it('returns empty string when no endpoints are supplied', () => {
    expect(formatEndpoints([])).toBe('');
  });

  it('falls back to the raw URL when shortEndpoint yields undefined', () => {
    expect(formatEndpoints([{ kind: 'stt', url: '' }])).toBe('STT: ');
  });
});

// ====================================================================
// 2. PrivacyBadge component
// ====================================================================

describe('PrivacyBadge', () => {
  it('renders the full-local chip with green-tone class + data-mode', () => {
    const { container } = render(
      <PrivacyBadge
        sttLocal={true}
        llmLocal={true}
        sttEndpoint="http://127.0.0.1:8178"
        llmEndpoint="http://localhost:11434"
        testId="p"
      />,
    );
    const root = container.querySelector('[data-testid="p"]') as HTMLElement;
    expect(root.getAttribute('data-mode')).toBe('full-local');
    expect(root.className).toMatch(/bg-emerald/);
    expect(root.getAttribute('title')).toContain('STT:');
    expect(root.getAttribute('title')).toContain('LLM:');
    expect(container.querySelector('[data-testid="p-label"]')?.textContent).toContain(
      '100% 本地',
    );
  });

  it('renders the partial-local chip with amber-tone class', () => {
    const { container } = render(
      <PrivacyBadge sttLocal={true} llmLocal={false} testId="p" />,
    );
    const root = container.querySelector('[data-testid="p"]') as HTMLElement;
    expect(root.getAttribute('data-mode')).toBe('partial-local');
    expect(root.className).toMatch(/bg-amber/);
    expect(container.querySelector('[data-testid="p-label"]')?.textContent).toContain(
      '部分',
    );
  });

  it('renders the remote chip with rose-tone class', () => {
    const { container } = render(
      <PrivacyBadge sttLocal={false} llmLocal={false} testId="p" />,
    );
    const root = container.querySelector('[data-testid="p"]') as HTMLElement;
    expect(root.getAttribute('data-mode')).toBe('remote');
    expect(root.className).toMatch(/bg-rose/);
    expect(container.querySelector('[data-testid="p-label"]')?.textContent).toContain(
      '远程',
    );
  });

  it('hides the endpoints line when both are absent', () => {
    const { container } = render(
      <PrivacyBadge sttLocal={true} llmLocal={true} testId="p" />,
    );
    expect(container.querySelector('[data-testid="p-endpoints"]')).toBeNull();
  });

  it('surfaces compact host:port when an endpoint is supplied', () => {
    const { container } = render(
      <PrivacyBadge
        sttLocal={true}
        llmLocal={true}
        sttEndpoint="http://127.0.0.1:8178"
        llmEndpoint="http://localhost:11434"
        testId="p"
      />,
    );
    const ep = container.querySelector('[data-testid="p-endpoints"]');
    expect(ep?.textContent).toContain('stt:127.0.0.1:8178');
    expect(ep?.textContent).toContain('llm:localhost:11434');
    expect(ep?.textContent).toContain(' · ');
  });

  it('exposes role=status + aria-label with the current mode', () => {
    const { container } = render(
      <PrivacyBadge sttLocal={true} llmLocal={true} testId="p" />,
    );
    const root = container.querySelector('[data-testid="p"]') as HTMLElement;
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.getAttribute('aria-label')).toBe('privacy mode: full-local');
  });

  it('passes through inputs to summarizePrivacy unchanged', () => {
    const inputs: PrivacyInputs = {
      sttLocal: true,
      llmLocal: false,
      sttEndpoint: 'http://localhost:8178',
    };
    const { container } = render(<PrivacyBadge {...inputs} testId="p" />);
    const root = container.querySelector('[data-testid="p"]') as HTMLElement;
    expect(root.getAttribute('data-mode')).toBe('partial-local');
  });
});
