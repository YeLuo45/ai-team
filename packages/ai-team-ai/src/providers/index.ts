// Provider factory — selects the right LLM client based on env vars

import { OpenAICompatClient } from './openai-compat.js';
import { MockClient } from './mock.js';
import type { LLMClient } from '../types.js';

export interface ProviderConfig {
  /** 'openai' | 'mock' | 'custom' */
  provider: 'openai' | 'mock' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export function createLLMClient(config: ProviderConfig = { provider: 'mock' }): LLMClient {
  if (config.provider === 'mock') {
    return new MockClient();
  }
  if (!config.apiKey) {
    throw new Error(`Provider '${config.provider}' requires apiKey`);
  }
  return new OpenAICompatClient({
    baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
    apiKey: config.apiKey,
    defaultModel: config.model ?? 'gpt-4o-mini',
  });
}

export function createFromEnv(): LLMClient {
  const apiKey = process.env.AI_TEAM_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_TEAM_LLM_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.AI_TEAM_LLM_MODEL ?? 'gpt-4o-mini';

  if (!apiKey) {
    return new MockClient();
  }
  return new OpenAICompatClient({
    baseUrl,
    apiKey,
    defaultModel: model,
  });
}

export { OpenAICompatClient, MockClient };
