// V171: Ollama provider tests — local LLM with no cloud relay.
//
// Two surfaces:
//   1. OllamaProvider HTTP behaviour (mocked fetch)
//   2. Registry helpers (listLlmProviders / getLlmProvider / etc.)

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OllamaProvider,
  listLlmProviderOptions,
  listLlmProviders,
  getLlmProvider,
  getDefaultLlmProviderId,
} from '../src/lib/llm';
import type { LlmHealth } from '../src/lib/llm/types';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function makeFetch(responses: Array<{
  url: string;
  status: number;
  body: string;
  contentType?: string;
}>): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = (async (input, init?) => {
    const url =
      typeof input === 'string' ? input : (input as URL).toString();
    calls.push({ url, init });
    const r = responses.find((x) => url.endsWith(x.url));
    if (!r) {
      return new Response('not found', { status: 404, statusText: 'Not Found' });
    }
    return new Response(r.body, {
      status: r.status,
      headers: { 'Content-Type': r.contentType ?? 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
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
// 1. OllamaProvider HTTP behaviour
// ====================================================================

describe('OllamaProvider', () => {
  it('reports local=true and the configured endpoint is normalised (no trailing slash)', () => {
    const p = new OllamaProvider({ endpoint: 'http://localhost:11434/' });
    expect(p.local).toBe(true);
    expect(p.endpoint_()).toBe('http://localhost:11434');
  });

  it('list() returns the model names from /api/tags', async () => {
    const { fetchImpl, calls } = makeFetch([
      { url: '/api/tags', status: 200, body: JSON.stringify({ models: [
        { name: 'llama3.2:latest' },
        { name: 'qwen2.5:7b' },
      ] }) },
    ]);
    const p = new OllamaProvider({ fetchImpl });
    const names = await p.list();
    expect(names).toEqual(['llama3.2:latest', 'qwen2.5:7b']);
    expect(calls.length).toBe(1);
    expect(calls[0]?.url).toContain('/api/tags');
  });

  it('list() throws when /api/tags returns non-OK', async () => {
    const { fetchImpl } = makeFetch([
      { url: '/api/tags', status: 500, body: 'boom' },
    ]);
    const p = new OllamaProvider({ fetchImpl });
    await expect(p.list()).rejects.toThrow(/list failed: 500/);
  });

  it('generate() POSTs to /api/generate with stream=false and parses the response', async () => {
    const { fetchImpl, calls } = makeFetch([
      {
        url: '/api/generate',
        status: 200,
        body: JSON.stringify({
          model: 'llama3.2',
          response: '本地回答',
          eval_count: 12,
          prompt_eval_count: 4,
          total_duration: 5_000_000_000,
        }),
      },
    ]);
    const p = new OllamaProvider({ fetchImpl });
    const out = await p.generate('问题：什么是装饰器？');
    expect(out.text).toBe('本地回答');
    expect(out.model).toBe('llama3.2');
    expect(out.tokens).toBe(16);
    expect(out.durationMs).toBe(5000);

    const call = calls[0];
    expect(call?.url).toContain('/api/generate');
    expect(call?.init?.method).toBe('POST');
    const sentBody = JSON.parse(String(call?.init?.body));
    expect(sentBody.model).toBe('llama3.2');
    expect(sentBody.prompt).toBe('问题：什么是装饰器？');
    expect(sentBody.stream).toBe(false);
    expect(sentBody.options.temperature).toBeUndefined();
  });

  it('generate() forwards temperature, num_predict, and stop sequences when set', async () => {
    const { fetchImpl, calls } = makeFetch([
      { url: '/api/generate', status: 200, body: JSON.stringify({ model: 'm', response: 'r' }) },
    ]);
    const p = new OllamaProvider({ fetchImpl });
    await p.generate('问 A', {
      temperature: 0.42,
      num_predict: 200,
      stop: ['\n\n', '###'],
    });
    const sentBody = JSON.parse(String(calls[0]?.init?.body));
    expect(sentBody.options).toEqual({
      temperature: 0.42,
      num_predict: 200,
      stop: ['\n\n', '###'],
    });
  });

  it('generate() throws on non-OK status', async () => {
    const { fetchImpl } = makeFetch([
      { url: '/api/generate', status: 404, body: 'model not found' },
    ]);
    const p = new OllamaProvider({ fetchImpl });
    await expect(p.generate('q')).rejects.toThrow(/generate failed: 404/);
  });

  it('generateStream() feeds NDJSON chunks to the callback', async () => {
    const chunks: string[] = [];
    const streamBody =
      JSON.stringify({ model: 'm', response: '你好', done: false }) + '\n'
      + JSON.stringify({ model: 'm', response: '世界', done: false }) + '\n'
      + JSON.stringify({ model: 'm', response: '!', done: true, eval_count: 3, total_duration: 2_500_000_000 });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        for (const piece of streamBody.split('\n')) {
          controller.enqueue(encoder.encode(piece + '\n'));
        }
        controller.close();
      },
    });

    const fetchImpl: typeof fetch = (async () => {
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
    }) as typeof fetch;

    const p = new OllamaProvider({ fetchImpl });
    const result = await p.generateStream('hi', (c) => chunks.push(c));
    expect(chunks.join('')).toBe('你好世界!');
    expect(result.text).toBe('你好世界!');
    expect(result.tokens).toBe(3);
    expect(result.durationMs).toBe(2500);
  });

  it('generateStream() falls back to text() when the response has no body stream', async () => {
    const textBody = JSON.stringify({ model: 'm', response: 'only-one', done: true });
    const fetchImpl: typeof fetch = (async () => {
      return new Response(textBody, { status: 200 }) as unknown as Response;
    }) as typeof fetch;
    const p = new OllamaProvider({ fetchImpl });
    const chunks: string[] = [];
    const result = await p.generateStream('hi', (c) => chunks.push(c));
    expect(chunks).toEqual(['only-one']);
    expect(result.text).toBe('only-one');
  });

  it('health() returns reachable=true + latencyMs on 200', async () => {
    const { fetchImpl } = makeFetch([
      { url: '/', status: 200, body: 'Ollama is running' },
    ]);
    const p = new OllamaProvider({ fetchImpl });
    const h = await p.health();
    expect(h.reachable).toBe(true);
    expect(typeof h.latencyMs).toBe('number');
  });

  it('health() returns reachable=false on throw', async () => {
    const fetchImpl: typeof fetch = (async () => {
        throw new Error('ECONNREFUSED');
      }) as typeof fetch;
    const p = new OllamaProvider({ fetchImpl });
    const h: LlmHealth = await p.health();
    expect(h.reachable).toBe(false);
    expect(h.error).toContain('ECONNREFUSED');
  });

  it('accepts a custom endpoint + default model', () => {
    const p = new OllamaProvider({ endpoint: 'http://gpu-host:9999/ollama', defaultModel: 'qwen2.5:7b' });
    expect(p.endpoint_()).toBe('http://gpu-host:9999/ollama');
    expect(p.defaultModel).toBe('qwen2.5:7b');
  });

  it('default options resolve to llama3.2 / localhost:11434', () => {
    const p = new OllamaProvider();
    expect(p.endpoint_()).toBe('http://localhost:11434');
    expect(p.defaultModel).toBe('llama3.2');
  });
});

// ====================================================================
// 2. Registry
// ====================================================================

describe('llm registry', () => {
  it('listLlmProviders exposes ollama as the default local provider', () => {
    const all = listLlmProviders();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]?.id).toBe('ollama');
    expect(all[0]?.local).toBe(true);
  });

  it('listLlmProviderOptions() mirrors providers with descriptions', () => {
    const opts = listLlmProviderOptions();
    expect(opts[0]?.id).toBe('ollama');
    expect(opts[0]?.description).toContain('本地处理');
  });

  it('getLlmProvider(ollama) returns the OllamaProvider instance', () => {
    const p = getLlmProvider('ollama');
    expect(p?.id).toBe('ollama');
  });

  it('getLlmProvider(<unknown>) returns undefined', () => {
    expect(getLlmProvider('does-not-exist')).toBeUndefined();
  });

  it("getDefaultLlmProviderId() returns the first supported provider's id", () => {
    expect(getDefaultLlmProviderId()).toBe('ollama');
  });
});
