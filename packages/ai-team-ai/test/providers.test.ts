// Provider factory tests

import { describe, it, expect } from 'vitest';
import { createFromEnv, createLLMClient, MockClient, OpenAICompatClient } from '../src/providers/index.js';

describe('createLLMClient', () => {
  it('returns MockClient for mock provider', () => {
    const c = createLLMClient({ provider: 'mock' });
    expect(c).toBeInstanceOf(MockClient);
  });

  it('returns OpenAICompatClient for openai provider', () => {
    const c = createLLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'https://x', model: 'm' });
    expect(c).toBeInstanceOf(OpenAICompatClient);
  });

  it('throws if openai without apiKey', () => {
    expect(() => createLLMClient({ provider: 'openai' })).toThrow(/apiKey/);
  });
});

describe('createFromEnv', () => {
  it('uses MockClient when no API key set', () => {
    const original = process.env.AI_TEAM_LLM_API_KEY;
    const original2 = process.env.OPENAI_API_KEY;
    delete process.env.AI_TEAM_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const c = createFromEnv();
    expect(c).toBeInstanceOf(MockClient);
    if (original !== undefined) process.env.AI_TEAM_LLM_API_KEY = original;
    if (original2 !== undefined) process.env.OPENAI_API_KEY = original2;
  });

  it('uses OpenAICompatClient when API key set', () => {
    process.env.AI_TEAM_LLM_API_KEY = 'test-key';
    const c = createFromEnv();
    expect(c).toBeInstanceOf(OpenAICompatClient);
    delete process.env.AI_TEAM_LLM_API_KEY;
  });

  it('uses OPENAI_API_KEY fallback', () => {
    delete process.env.AI_TEAM_LLM_API_KEY;
    process.env.OPENAI_API_KEY = 'fallback-key';
    const c = createFromEnv();
    expect(c).toBeInstanceOf(OpenAICompatClient);
    delete process.env.OPENAI_API_KEY;
  });
});
