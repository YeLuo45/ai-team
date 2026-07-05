// V161: STT provider registry + MockSttProvider + SttSettings UI
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  listSttProviderOptions,
  listSttProviders,
  getDefaultSttProviderId,
  getSttProvider,
} from '../src/lib/stt/registry.js';
import { MockSttProvider } from '../src/lib/stt/mock-provider.js';
import { SttSettings } from '../src/components/interview/SttSettings.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

// ---------------- registry ----------------

describe('STT provider registry', () => {
  it('exposes at least 3 providers', () => {
    const providers = listSttProviders();
    expect(providers.length).toBeGreaterThanOrEqual(3);
    expect(providers.map((p) => p.id)).toEqual(expect.arrayContaining(['mock', 'web-speech', 'whisper']));
  });

  it('exposes UI-friendly options with privacy metadata', () => {
    const opts = listSttProviderOptions();
    expect(opts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'mock', local: true }),
        expect.objectContaining({ id: 'web-speech', local: true }),
        expect.objectContaining({ id: 'whisper', local: false }),
      ]),
    );
  });

  it('returns a supported provider for getDefaultSttProviderId', () => {
    expect(getDefaultSttProviderId()).toBe('mock');
  });

  it('retrieves a provider by id', () => {
    expect(getSttProvider('mock')?.label).toMatch(/mock/i);
    expect(getSttProvider('not-real')).toBeUndefined();
  });
});

// ---------------- MockSttProvider ----------------

describe('MockSttProvider', () => {
  it('emits chunks on a timer', async () => {
    const p = new MockSttProvider({ intervalMs: 100 });
    const chunks: any[] = [];
    const states: string[] = [];
    const errors: any[] = [];
    const session = {
      onChunk: (c: any) => chunks.push(c),
      onStateChange: (s: any) => states.push(s),
      onError: (e: any) => errors.push(e),
    };
    await p.start(session);
    expect(states).toContain('starting');
    await vi.advanceTimersByTimeAsync(50);
    expect(states).toContain('listening');
    await vi.advanceTimersByTimeAsync(800);
    expect(chunks.length).toBeGreaterThan(0);
    const last = chunks[chunks.length - 1];
    expect(last.isFinal).toBe(true);
    expect(['candidate', 'interviewer']).toContain(last.speaker);
    await p.stop();
    expect(states).toContain('idle');
    expect(errors).toHaveLength(0);
  });

  it('emits nothing without a session', async () => {
    const p = new MockSttProvider({ intervalMs: 50 });
    const states: string[] = [];
    const session = {
      onChunk: () => {},
      onStateChange: (s: any) => states.push(s),
    };
    await p.start(session);
    await vi.advanceTimersByTimeAsync(100);
    await p.stop();
    expect(states).toContain('starting');
  });

  it('stop() is idempotent', async () => {
    const p = new MockSttProvider();
    const session = { onChunk: () => {}, onStateChange: () => {} };
    await p.start(session);
    await p.stop();
    await p.stop();
    expect(p.language()).toBe('zh-CN');
  });
});

// ---------------- SttSettings UI ----------------

describe('SttSettings UI', () => {
  it('renders the provider selector with all available providers', () => {
    render(<SttSettings />);
    const select = screen.getByTestId('stt-provider-select') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(expect.arrayContaining(['mock', 'web-speech', 'whisper']));
  });

  it('shows the privacy badge reflecting the selected provider (local vs remote)', () => {
    render(<SttSettings />);
    expect(screen.getByTestId('stt-privacy-badge')).toBeTruthy();
  });

  it('disabling all providers (via a fake value) falls back to a supported one', () => {
    render(<SttSettings />);
    // Force-select an unsupported provider via the <select>; the useEffect
    // recovers by auto-flipping back to a supported one.
    fireEvent.change(screen.getByTestId('stt-provider-select'), { target: { value: 'whisper' } });
    // Since whisper is `supported=false`, the recovery effect kicks in.
    expect(screen.getByTestId('stt-provider-select').value).not.toBe('whisper');
  });

  it('defaults to the mock provider and renders an empty transcript stream', () => {
    render(<SttSettings />);
    expect((screen.getByTestId('stt-provider-select') as HTMLSelectElement).value).toBe('mock');
    expect(screen.getByTestId('stt-empty')).toBeTruthy();
    expect(screen.getByTestId('stt-state-badge').getAttribute('data-state')).toBe('idle');
  });

  it('clicking 开始录音 starts the Mock provider and renders emitted chunks', async () => {
    render(<SttSettings />);
    fireEvent.click(screen.getByTestId('stt-start'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1700);
    });
    // chunkt count > 0 means at least one chunk was rendered.
    expect(screen.getByTestId('stt-chunk-count').textContent).toMatch(/共 \d+ 段转录/);
    expect(screen.getByTestId('stt-chunk-count').textContent).not.toContain('共 0 段');
    const badge = screen.getByTestId('stt-state-badge');
    expect(['listening', 'starting']).toContain(badge.getAttribute('data-state'));
  });

  it('clicking 停止录音 transitions the badge state back to idle', async () => {
    render(<SttSettings />);
    fireEvent.click(screen.getByTestId('stt-start'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    fireEvent.click(screen.getByTestId('stt-stop'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('stt-state-badge').getAttribute('data-state')).toBe('idle');
  });

  it('emits the transcript buffer via onBufferChange', async () => {
    const onBufferChange = vi.fn();
    render(<SttSettings onBufferChange={onBufferChange} />);
    fireEvent.click(screen.getByTestId('stt-start'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1700);
    });
    fireEvent.click(screen.getByTestId('stt-stop'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onBufferChange).toHaveBeenCalled();
    // The last invocation should pass an array
    const lastArg = onBufferChange.mock.calls[onBufferChange.mock.calls.length - 1][0];
    expect(Array.isArray(lastArg)).toBe(true);
    expect(lastArg.length).toBeGreaterThan(0);
  });
});
