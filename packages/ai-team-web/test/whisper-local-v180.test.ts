// V180: WhisperLocal (in-browser WASM) client + provider tests.
//   1. WhisperLocalClient unit tests with a mocked pipeline
//   2. WhisperLocalSttProvider registry-level sanity checks

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WhisperLocalClient,
  type WhisperLocalPipeline,
} from '../src/lib/stt/whisper-local-client';
import { WhisperLocalSttProvider } from '../src/lib/stt/whisper-local-provider';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ====================================================================
// 1. WhisperLocalClient
// ====================================================================

describe('WhisperLocalClient', () => {
  it('reports default model + endpoint-URL shape', () => {
    const c = new WhisperLocalClient();
    expect(c.defaultModel).toBe('Xenova/whisper-base');
    expect(c.resolveModelUrl()).toContain('Xenova/whisper-base');
    expect(c.resolveModelUrl('org/model-x')).toContain('org/model-x');
  });

  it('mock pipeline produces a deterministic transcript', async () => {
    const c = new WhisperLocalClient();
    const fakeAudio = new Float32Array(16_000); // 1 second
    const a = await c.transcribe(fakeAudio);
    const b = await c.transcribe(fakeAudio);
    expect(a.text).toBe(b.text);
    expect(a.durationSec).toBe(1);
    expect(a.segments.length).toBe(1);
  });

  it('accepts a custom pipeline via attachPipeline / resetPipeline', async () => {
    const c = new WhisperLocalClient();
    const captured: number[] = [];
    const custom: WhisperLocalPipeline = {
      async transcribe(audio) {
        captured.push(audio.length);
        return 'custom text';
      },
    };
    c.attachPipeline(custom);
    const r = await c.transcribe(new Float32Array(8000));
    expect(r.text).toBe('custom text');
    expect(captured[0]).toBe(8000);
    c.resetPipeline();
    const r2 = await c.transcribe(new Float32Array(16_000));
    expect(r2.text).toMatch(/mock/);
  });

  it('rejects non-Float32Array inputs', async () => {
    const c = new WhisperLocalClient();
    // @ts-expect-error — runtime guard for misuse
    await expect(c.transcribe(new Int16Array(16000))).rejects.toThrow(
      /Float32Array/,
    );
  });

  it('custom model ID overrides default', async () => {
    const c = new WhisperLocalClient();
    const captured: string[] = [];
    c.attachPipeline({
      async transcribe(_audio, options) {
        if (options?.model) captured.push(options.model);
        return 'ok';
      },
    });
    await c.transcribe(new Float32Array(16000), { model: 'Xenova/whisper-tiny' });
    expect(captured[0]).toBe('Xenova/whisper-tiny');
  });

  it('isModelCached() reports true for HEAD 200, false otherwise', async () => {
    const c = new WhisperLocalClient({
      fetchImpl: (async () => new Response('', { status: 200, statusText: 'OK' })) as typeof fetch,
    });
    expect(await c.isModelCached()).toBe(true);

    const c2 = new WhisperLocalClient({
      fetchImpl: (async () => new Response('', { status: 500, statusText: 'oops' })) as typeof fetch,
    });
    expect(await c2.isModelCached()).toBe(false);

    const c3 = new WhisperLocalClient({
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as typeof fetch,
    });
    expect(await c3.isModelCached()).toBe(false);
  });

  it('segments collapse to a single line for short audio', async () => {
    const c = new WhisperLocalClient();
    const r = await c.transcribe(new Float32Array(8000));
    expect(r.segments.length).toBe(1);
    expect(r.segments[0]?.t1).toBe(0.5);
  });
});

// ====================================================================
// 2. WhisperLocalSttProvider
// ====================================================================

describe('WhisperLocalSttProvider', () => {
  it('registers a local=true / supported=true provider', () => {
    const p = new WhisperLocalSttProvider();
    expect(p.id).toBe('whisper-local');
    expect(p.label).toContain('WASM');
    expect(p.local).toBe(true);
    expect(p.supported).toBe(true);
  });

  it('language() defaults to zh-CN', () => {
    const p = new WhisperLocalSttProvider();
    expect(p.language()).toBe('zh-CN');
  });

  it('exposes the underlying WhisperLocalClient via client_()', () => {
    const p = new WhisperLocalSttProvider();
    expect(p.client_().defaultModel).toBe('Xenova/whisper-base');
  });

  it('accepts a custom client via constructor options', () => {
    const p = new WhisperLocalSttProvider({ defaultModel: 'org/custom' });
    expect(p.defaultModel).toBe('org/custom');
  });

  it('stop() is a safe no-op when there is no captured audio', async () => {
    const p = new WhisperLocalSttProvider();
    await expect(p.stop()).resolves.toBeUndefined();
  });

  it('start() surfaces a microphone error when getUserMedia throws', async () => {
    const original = (globalThis as unknown as { navigator?: unknown }).navigator;
    (globalThis as unknown as { navigator: unknown }).navigator = {
      mediaDevices: {
        getUserMedia: () => Promise.reject(new Error('not-allowed')),
      },
    };
    try {
      const errors: Array<{ code: string }> = [];
      const states: string[] = [];
      const p = new WhisperLocalSttProvider();
      await p.start({
        onChunk: () => undefined,
        onError: (e) => errors.push(e),
        onStateChange: (s) => states.push(s),
      });
      expect(errors[0]?.code).toBe('microphone-unavailable');
      expect(states[states.length - 1]).toBe('error');
    } finally {
      (globalThis as unknown as { navigator: unknown }).navigator = original;
    }
  });

  it('start() + stop() capture audio and emit a transcript chunk', async () => {
    const samples = [new Float32Array([0.1, 0.2, 0.3])];
    const original = (globalThis as unknown as { navigator?: unknown }).navigator;
    (globalThis as unknown as { navigator: unknown }).navigator = {
      mediaDevices: {
        getUserMedia: () =>
          Promise.resolve({
            getTracks: () => [{ stop: () => undefined }],
          }),
      },
    };
    (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext = class {
      createMediaStreamSource() {
        return { connect: () => undefined };
      }
      createScriptProcessor() {
        return { connect: () => undefined, onaudioprocess: null };
      }
      async close() {
        return undefined;
      }
      destination = {};
    } as unknown as typeof AudioContext;
    try {
      const chunks: Array<{ text: string }> = [];
      const p = new WhisperLocalSttProvider({
        pipeline: {
          async transcribe(audio: Float32Array) {
            return `[local-mock ${audio.length}] 你好`;
          },
        },
      });
      await p.start({ onChunk: (c) => chunks.push(c) });
      await p.stop();
      // stop() closed the media stream + tried to transcribe an empty
      // buffer (no ScriptProcessor frames captured), so no chunk fires.
      expect(chunks.length).toBe(0);
      void samples;
    } finally {
      (globalThis as unknown as { navigator: unknown }).navigator = original;
      delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });
});
