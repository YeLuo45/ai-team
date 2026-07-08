// V173: Whisper-server (whisper.cpp / local HTTP) tests.
//
// Two surfaces:
//   1. WhisperServerClient — POST /inference + GET /models + GET / health.
//   2. WhisperServerSttProvider implements SttProvider contract for the
//      STT registry, and exposes batch-mode transcribe() helper.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WhisperServerClient,
  WhisperServerSttProvider,
  type WhisperTranscription,
} from '../src/lib/stt/whisper-provider';
import type { SttSession, SttState } from '../src/lib/stt/types';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function makeFetch(
  responses: Array<{ url: string; status: number; body: string }>,
  requests?: FetchCall[],
): typeof fetch {
  const fetchImpl: typeof fetch = (async (input, init?) => {
    const url =
      typeof input === 'string' ? input : (input as URL).toString();
    if (requests) requests.push({ url, init });
    const r = responses.find((x) => url.endsWith(x.url));
    if (!r) {
      return new Response('not found', { status: 404, statusText: 'Not Found' });
    }
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return fetchImpl;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ====================================================================
// 1. WhisperServerClient
// ====================================================================

describe('WhisperServerClient', () => {
  it('reports local=true + default endpoint at 127.0.0.1:8178 (no trailing slash)', () => {
    const c = new WhisperServerClient({ endpoint: 'http://127.0.0.1:8178/' });
    expect(c.endpoint_()).toBe('http://127.0.0.1:8178');
  });

  it('transcribe() POSTs base64 audio to /inference and parses segments', async () => {
    const requests: FetchCall[] = [];
    const fetchImpl = makeFetch(
      [
        {
          url: '/inference',
          status: 200,
          body: JSON.stringify({
            text: '你好，世界。',
            language: 'zh',
            inference_time_ms: 412,
            segments: [
              { text: '你好，', t0: 0, t1: 0.55 },
              { text: '世界。', t0: 0.55, t1: 1.2 },
            ],
          }),
        },
      ],
      requests,
    );

    const client = new WhisperServerClient({ fetchImpl });
    // 3 bytes → "AQID" in base64
    const audio = new Uint8Array([1, 2, 3]);
    const result = await client.transcribe(audio);
    expect(result.text).toBe('你好，世界。');
    expect(result.language).toBe('zh');
    expect(result.segments.length).toBe(2);
    expect(result.segments[0]?.t1Ms).toBe(550);
    expect(result.segments[1]?.t0Ms).toBe(550);
    expect(result.segments[1]?.t1Ms).toBe(1200);

    const call = requests[0];
    expect(call?.url).toContain('/inference');
    expect(call?.init?.method).toBe('POST');
    const body = JSON.parse(String(call?.init?.body));
    expect(body.audio_data).toBe('AQID');
    expect(body.language).toBe('auto');
    expect(body.translate).toBe(false);
    expect(body.temperature).toBe(0);
    expect(body.response_format).toBe('json');
  });

  it('transcribe() forwards user-supplied options (translate / temperature / language / model)', async () => {
    const requests: FetchCall[] = [];
    const fetchImpl = makeFetch(
      [{ url: '/inference', status: 200, body: JSON.stringify({ text: 'hi' }) }],
      requests,
    );
    const client = new WhisperServerClient({ fetchImpl });
    await client.transcribe(new Uint8Array([0]), {
      language: 'en',
      translate: true,
      temperature: 0.4,
      temperatureIncrement: 0.1,
      responseFormat: 'text',
      model: 'ggml-tiny.en',
    });
    const body = JSON.parse(String(requests[0]?.init?.body));
    expect(body.language).toBe('en');
    expect(body.translate).toBe(true);
    expect(body.temperature).toBe(0.4);
    expect(body.temperature_inc).toBe(0.1);
    expect(body.response_format).toBe('text');
    expect(body.model).toBe('ggml-tiny.en');
  });

  it('transcribe() throws on non-OK status', async () => {
    const fetchImpl = makeFetch([
      { url: '/inference', status: 500, body: 'server broke' },
    ]);
    const client = new WhisperServerClient({ fetchImpl });
    await expect(client.transcribe(new Uint8Array([1]))).rejects.toThrow(
      /inference failed: 500/,
    );
  });

  it('listModels() returns the model id array, or empty on non-OK', async () => {
    const fetchImpl1 = makeFetch([
      { url: '/models', status: 200, body: JSON.stringify({ models: ['ggml-base.en', 'ggml-small'] }) },
    ]);
    const client1 = new WhisperServerClient({ fetchImpl: fetchImpl1 });
    expect(await client1.listModels()).toEqual(['ggml-base.en', 'ggml-small']);

    const fetchImpl2 = makeFetch([{ url: '/models', status: 404, body: 'nope' }]);
    const client2 = new WhisperServerClient({ fetchImpl: fetchImpl2 });
    expect(await client2.listModels()).toEqual([]);
  });

  it('health() returns reachable=true + latencyMs on 200', async () => {
    const fetchImpl = makeFetch([{ url: '/', status: 200, body: '<html>hi</html>' }]);
    const client = new WhisperServerClient({ fetchImpl });
    const h = await client.health();
    expect(h.reachable).toBe(true);
    expect(typeof h.latencyMs).toBe('number');
  });

  it('health() returns reachable=false + error on throw', async () => {
    const fetchImpl: typeof fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    const client = new WhisperServerClient({ fetchImpl });
    const h = await client.health();
    expect(h.reachable).toBe(false);
    expect(h.error).toContain('ECONNREFUSED');
  });

  it('accepts a custom endpoint + default language', () => {
    const c = new WhisperServerClient({
      endpoint: 'http://gpu-host:9999/whisper',
      language: 'zh',
    });
    expect(c.endpoint_()).toBe('http://gpu-host:9999/whisper');
    expect(c.language).toBe('zh');
  });

  it('transcribe() falls back to joining segments when text is omitted', async () => {
    const fetchImpl = makeFetch([
      {
        url: '/inference',
        status: 200,
        body: JSON.stringify({
          language: 'en',
          segments: [
            { text: 'Hello ', t0: 0, t1: 0.4 },
            { text: 'world.', t0: 0.4, t1: 1.0 },
          ],
        }),
      },
    ]);
    const client = new WhisperServerClient({ fetchImpl });
    const out = await client.transcribe(new Uint8Array([0]));
    expect(out.text).toBe('Hello world.');
    expect(out.language).toBe('en');
  });

  it('transcribe() handles a Blob input (browser MicRecorder path)', async () => {
    const audioBytes = new Uint8Array([10, 20, 30, 40]);
    const blob = new Blob([audioBytes], { type: 'audio/wav' });
    const requests: FetchCall[] = [];
    const fetchImpl = makeFetch(
      [{ url: '/inference', status: 200, body: JSON.stringify({ text: 'ok' }) }],
      requests,
    );
    const client = new WhisperServerClient({ fetchImpl });
    const out = await client.transcribe(blob);
    expect(out.text).toBe('ok');
    // base64 of [10,20,30,40] is "ChQeKA==" — verify the audio payload
    // round-trips through Blob.arrayBuffer.
    const body = JSON.parse(String(requests[0]?.init?.body));
    expect(body.audio_data).toBe('ChQeKA==');
  });
});

// ====================================================================
// 2. WhisperServerSttProvider
// ====================================================================

describe('WhisperServerSttProvider', () => {
  it('advertises id + label + local=true + supported=true', () => {
    const fetchImpl = makeFetch([{ url: '/', status: 200, body: 'ok' }]);
    const p = new WhisperServerSttProvider(new WhisperServerClient({ fetchImpl }));
    expect(p.id).toBe('whisper-server');
    expect(p.label).toContain('Whisper.cpp');
    expect(p.local).toBe(true);
    expect(p.supported).toBe(true);
  });

  it('exposes the configured endpoint via endpoint()', () => {
    const fetchImpl = makeFetch([{ url: '/', status: 200, body: 'ok' }]);
    const p = new WhisperServerSttProvider(
      new WhisperServerClient({ endpoint: 'http://gpu:1234/whisper', fetchImpl }),
    );
    expect(p.endpoint()).toBe('http://gpu:1234/whisper');
  });

  it('language() returns the underlying client default', () => {
    const fetchImpl = makeFetch([{ url: '/', status: 200, body: 'ok' }]);
    const p = new WhisperServerSttProvider(
      new WhisperServerClient({ language: 'zh', fetchImpl }),
    );
    expect(p.language()).toBe('zh');
  });

  it('transcribe() round-trips through the client and returns the parsed result', async () => {
    const fetchImpl = makeFetch([
      {
        url: '/inference',
        status: 200,
        body: JSON.stringify({ text: '本地转录', language: 'zh', segments: [{ text: '本地转录', t0: 0, t1: 1 }] }),
      },
    ]);
    const p = new WhisperServerSttProvider(new WhisperServerClient({ fetchImpl }));
    const out: WhisperTranscription = await p.transcribe(new Uint8Array([1, 2, 3]));
    expect(out.text).toBe('本地转录');
    expect(out.segments.length).toBe(1);
  });

  it('start() reports batch-only error since whisper-server lacks a streaming contract', async () => {
    const errors: Array<{ code: string; message: string }> = [];
    const states: SttState[] = [];
    const fetchImpl = makeFetch([{ url: '/', status: 200, body: 'ok' }]);
    const p = new WhisperServerSttProvider(new WhisperServerClient({ fetchImpl }));
    const session: SttSession = {
      onChunk: () => undefined,
      onError: (e) => errors.push(e),
      onStateChange: (s) => states.push(s),
    };
    await p.start(session);
    expect(errors.length).toBe(1);
    expect(errors[0]?.code).toBe('batch-only');
    expect(states[states.length - 1]).toBe('error');
  });

  it('stop() is a no-op (no streaming resources to release)', async () => {
    const fetchImpl = makeFetch([{ url: '/', status: 200, body: 'ok' }]);
    const p = new WhisperServerSttProvider(new WhisperServerClient({ fetchImpl }));
    await expect(p.stop()).resolves.toBeUndefined();
  });
});
