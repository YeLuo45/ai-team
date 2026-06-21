// V32: agent-config-loader tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ConfiguredLLMClient,
  buildRuntimeOverride,
  resolveKindFromRequest,
} from '../src/agent-config-loader.js';
import type { AgentConfig, AgentConfigStore } from '@ai-team/core';
import type { ChatMessage, ChatRequest, ChatResponse } from '@ai-team/ai';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agent-loader-'));
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
});

function fakeChatResponse(content: string, model = 'fake-model'): ChatResponse {
  return { content, model };
}

class FakeLLM {
  public lastReq: ChatRequest | null = null;
  constructor(public readonly name: string) {}
  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.lastReq = JSON.parse(JSON.stringify(req));
    return fakeChatResponse(`reply(${this.name})`, req.model ?? 'fake-model');
  }
  async chatStream(req: ChatRequest): Promise<ChatResponse> {
    return this.chat(req);
  }
}

function makeStoreMock(initial: Partial<Record<string, AgentConfig | null>> = {}) {
  return {
    get: vi.fn(async (kind: string) => initial[kind] ?? null),
    list: vi.fn(async () => Object.values(initial).filter(Boolean) as AgentConfig[]),
    save: vi.fn(),
    delete: vi.fn(),
    resetLlm: vi.fn(),
  } as unknown as AgentConfigStore;
}

describe('ConfiguredLLMClient', () => {
  it('passes through unmodified when no agent config exists', async () => {
    const base = new FakeLLM('base');
    const wrapped = new ConfiguredLLMClient({ baseClient: base, store: makeStoreMock({}), kind: 'interview' });
    const out = await wrapped.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.content).toBe('reply(base)');
    expect(base.lastReq!.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(base.lastReq!.model).toBeUndefined();
    expect(base.lastReq!.temperature).toBeUndefined();
  });

  it('injects system prompt and overrides model when config present', async () => {
    const base = new FakeLLM('base');
    const cfg: AgentConfig = {
      agent: 'interview',
      soul: 'be strict',
      user: 'tech leads',
      memory: 'previous RAG discussion',
      llm: { model: 'gpt-5.5', temperature: 0.3, maxTokens: 256 },
      updatedAt: '2026-06-21T00:00:00Z',
    };
    const wrapped = new ConfiguredLLMClient({
      baseClient: base,
      store: makeStoreMock({ interview: cfg }),
      kind: 'interview',
    });
    await wrapped.chat({ messages: [{ role: 'user', content: 'q' }] });
    const last = base.lastReq!;
    expect(last.messages[0].role).toBe('system');
    expect(last.messages[0].content).toContain('[SOUL]');
    expect(last.messages[0].content).toContain('be strict');
    expect(last.messages[0].content).toContain('[USER]');
    expect(last.messages[0].content).toContain('tech leads');
    expect(last.messages[0].content).toContain('[MEMORY]');
    expect(last.messages[0].content).toContain('previous RAG discussion');
    expect(last.model).toBe('gpt-5.5');
    expect(last.temperature).toBe(0.3);
    expect(last.maxTokens).toBe(256);
  });

  it('does not bleed config from one agent into another', async () => {
    const base = new FakeLLM('base');
    const iv: AgentConfig = {
      agent: 'interview',
      soul: 'IV-SOUL',
      user: '', memory: '',
      llm: { model: 'iv-model', temperature: 0.2 },
      updatedAt: '',
    };
    const tr: AgentConfig = {
      agent: 'training',
      soul: 'TR-SOUL',
      user: '', memory: '',
      llm: { model: 'tr-model', temperature: 0.9 },
      updatedAt: '',
    };
    const ivWrap = new ConfiguredLLMClient({
      baseClient: base,
      store: makeStoreMock({ interview: iv, training: tr }),
      kind: 'interview',
    });
    const trWrap = new ConfiguredLLMClient({
      baseClient: base,
      store: makeStoreMock({ interview: iv, training: tr }),
      kind: 'training',
    });
    const ivReq = base.lastReq!;
    await ivWrap.chat({ messages: [{ role: 'user', content: 'q1' }] });
    expect(base.lastReq!.model).toBe('iv-model');
    expect(base.lastReq!.messages[0].content).toContain('IV-SOUL');
    expect(base.lastReq!.messages[0].content).not.toContain('TR-SOUL');

    // re-issue for tr
    await trWrap.chat({ messages: [{ role: 'user', content: 'q3' }] });
    const trReq = base.lastReq!;
    expect(trReq.model).toBe('tr-model');
    expect(trReq.messages[0].content).toContain('TR-SOUL');
    expect(trReq.messages[0].content).not.toContain('IV-SOUL');
  });

  it('falls back to base model/temperature when config lacks llm overrides', async () => {
    const base = new FakeLLM('base');
    const cfg: AgentConfig = {
      agent: 'interview',
      soul: 'just soul',
      user: '', memory: '',
      llm: {},
      updatedAt: '',
    };
    const wrapped = new ConfiguredLLMClient({
      baseClient: base,
      store: makeStoreMock({ interview: cfg }),
      kind: 'interview',
    });
    await wrapped.chat({
      messages: [{ role: 'user', content: 'q' }],
      temperature: 0.5,
      model: 'caller-model',
    });
    const last = base.lastReq!;
    // caller-supplied model wins when no config override
    expect(last.model).toBe('caller-model');
    expect(last.temperature).toBe(0.5);
  });

  it('handles store read failure gracefully (passes through)', async () => {
    const base = new FakeLLM('base');
    const store = {
      get: vi.fn(async () => { throw new Error('disk down'); }),
    } as unknown as AgentConfigStore;
    const wrapped = new ConfiguredLLMClient({ baseClient: base, store, kind: 'review' });
    const out = await wrapped.chat({ messages: [{ role: 'user', content: 'q' }] });
    expect(out.content).toBe('reply(base)');
  });

  it('chatStream also applies config', async () => {
    const base = new FakeLLM('base');
    const cfg: AgentConfig = {
      agent: 'training',
      soul: 'trainer',
      user: '', memory: '',
      llm: { model: 'trainer-model' },
      updatedAt: '',
    };
    const wrapped = new ConfiguredLLMClient({
      baseClient: base,
      store: makeStoreMock({ training: cfg }),
      kind: 'training',
    });
    let received = '';
    const out = await wrapped.chatStream({ messages: [{ role: 'user', content: 'q' }] }, (chunk: { delta: string }) => {
      received += chunk.delta;
    });
    expect(out.model).toBe('trainer-model');
    expect(base.lastReq!.messages[0].content).toContain('[SOUL]');
    // Mock base's chatStream returns fakeChatResponse synchronously, no chunks
    expect(typeof received).toBe('string');
  });

  it('chatStream passes through when no config exists', async () => {
    const base = new FakeLLM('base');
    const wrapped = new ConfiguredLLMClient({
      baseClient: base,
      store: makeStoreMock({}),
      kind: 'interview',
    });
    const out = await wrapped.chatStream(
      { messages: [{ role: 'user', content: 'hi' }] },
      () => { /* no-op */ },
    );
    expect(out.content).toBe('reply(base)');
    expect(base.lastReq!.messages[0].content).toBe('hi');
  });
});

describe('buildRuntimeOverride', () => {
  it('returns empty override when config has no llm overrides', () => {
    const cfg: AgentConfig = {
      agent: 'interview', soul: 'x', user: '', memory: '', llm: {}, updatedAt: '',
    };
    expect(buildRuntimeOverride(cfg)).toEqual({});
  });

  it('emits only defined fields', () => {
    const cfg: AgentConfig = {
      agent: 'interview', soul: '', user: '', memory: '',
      llm: { model: 'm', temperature: 0.3 },
      updatedAt: '',
    };
    expect(buildRuntimeOverride(cfg)).toEqual({ model: 'm', temperature: 0.3 });
  });
});

describe('resolveKindFromRequest', () => {
  it('returns the explicit kind when set', () => {
    expect(resolveKindFromRequest({ kind: 'review' })).toBe('review');
  });
  it('falls back to interview when no kind given', () => {
    expect(resolveKindFromRequest({})).toBe('interview');
  });
});
