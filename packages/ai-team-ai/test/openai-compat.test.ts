// OpenAI-compatible client tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAICompatClient } from '../src/providers/openai-compat.js';

describe('OpenAICompatClient', () => {
  let client: OpenAICompatClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = new OpenAICompatClient({
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      defaultModel: 'gpt-test',
    });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('chat sends POST with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: '1',
        model: 'gpt-test',
        choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }), { headers: { 'Content-Type': 'application/json' } })
    );
    global.fetch = mockFetch as any;

    const r = await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.5,
      maxTokens: 100,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        }),
      })
    );
    expect(r.content).toBe('hello');
    expect(r.model).toBe('gpt-test');
    expect(r.usage?.totalTokens).toBe(15);
  });

  it('throws on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Server error', { status: 500 })
    ) as any;
    await expect(client.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/500/);
  });

  it('throws on empty choices', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { headers: { 'Content-Type': 'application/json' } })
    ) as any;
    await expect(client.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/no choices/);
  });

  it('includes organization header if set', async () => {
    const orgClient = new OpenAICompatClient({
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'k',
      defaultModel: 'm',
      organization: 'org-123',
    });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: 'stop' }] }))
    );
    global.fetch = mockFetch as any;
    await orgClient.chat({ messages: [{ role: 'user', content: 'x' }] });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['OpenAI-Organization']).toBe('org-123');
  });

  it('uses default model when not specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: 'stop' }] }))
    );
    global.fetch = mockFetch as any;
    await client.chat({ messages: [{ role: 'user', content: 'x' }] });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-test');
  });

  it('overrides model when specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: 'stop' }] }))
    );
    global.fetch = mockFetch as any;
    await client.chat({ messages: [{ role: 'user', content: 'x' }], model: 'gpt-override' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-override');
  });

  it('chatStream skips malformed SSE lines and returns final', async () => {
    const sseBody = [
      'data: this is not json{{{',
      'data: {"choices":[{"delta":{"content":"ok"}}]}',
      'data: [DONE]',
      '',
    ].join('\n');
    global.fetch = vi.fn().mockResolvedValue(
      new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
    ) as any;
    const r = await client.chatStream({ messages: [{ role: 'user', content: 'x' }] }, () => {});
    expect(r.content).toBe('ok');
  });

  it('chatStream updates model from stream', async () => {
    const sseBody = [
      'data: {"model":"gpt-stream-model","choices":[{"delta":{"content":"hi"}}]}',
      'data: [DONE]',
      '',
    ].join('\n');
    global.fetch = vi.fn().mockResolvedValue(
      new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
    ) as any;
    const r = await client.chatStream({ messages: [{ role: 'user', content: 'x' }] }, () => {});
    expect(r.model).toBe('gpt-stream-model');
  });

  it('chatStream handles finish_reason from stream', async () => {
    const sseBody = [
      'data: {"choices":[{"finish_reason":"length"}]}',
      'data: [DONE]',
      '',
    ].join('\n');
    global.fetch = vi.fn().mockResolvedValue(
      new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
    ) as any;
    const r = await client.chatStream({ messages: [{ role: 'user', content: 'x' }] }, () => {});
    expect(r.finishReason).toBe('length');
  });

  it('chatStream returns final on [DONE] marker', async () => {
    const sseBody = 'data: [DONE]\n';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
    ) as any;
    const r = await client.chatStream({ messages: [{ role: 'user', content: 'x' }] }, () => {});
    expect(r.content).toBe('');
  });

  it('chatStream returns final when stream ends without [DONE]', async () => {
    const sseBody = 'data: {"choices":[{"delta":{"content":"hi"}}]}\n';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(sseBody, { headers: { 'Content-Type': 'text/event-stream' } })
    ) as any;
    const r = await client.chatStream({ messages: [{ role: 'user', content: 'x' }] }, () => {});
    expect(r.content).toBe('hi');
    expect(r.finishReason).toBe('stop');
  });

  it('chatStream handles errors', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Bad', { status: 400 })
    ) as any;
    await expect(
      client.chatStream({ messages: [{ role: 'user', content: 'x' }] }, () => {})
    ).rejects.toThrow();
  });
});
