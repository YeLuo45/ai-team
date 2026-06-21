// V32: Per-agent LLM runtime wrapper — applies agent-specific configuration
// (soul/user/memory + model/temperature/maxTokens) to outgoing chat() calls.
// Configurations are stored per-agent via AgentConfigStore, so each agent's
// overrides are fully isolated.

import type {
  AgentConfig,
  AgentConfigStore,
  AgentKind,
} from '@ai-team/core';
import {
  mergeRequest,
  buildSystemPrompt,
  type RequestOverride,
} from '@ai-team/core';
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  LLMClient,
} from '@ai-team/ai';

export interface ConfiguredLLMClientDeps {
  baseClient: LLMClient;
  store: AgentConfigStore;
  kind: AgentKind;
}

export function buildRuntimeOverride(config: AgentConfig): RequestOverride {
  const override: RequestOverride = {};
  if (config.llm.model !== undefined) override.model = config.llm.model;
  if (config.llm.temperature !== undefined) override.temperature = config.llm.temperature;
  if (config.llm.maxTokens !== undefined) override.maxTokens = config.llm.maxTokens;
  return override;
}

async function loadConfigSafely(store: AgentConfigStore, kind: AgentKind): Promise<AgentConfig | null> {
  try {
    return await store.get(kind);
  } catch {
    return null;
  }
}

export class ConfiguredLLMClient implements LLMClient {
  constructor(private readonly deps: ConfiguredLLMClientDeps) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const config = await loadConfigSafely(this.deps.store, this.deps.kind);
    const baseRequest: ChatRequest = config
      ? mergeRequest(req, { soul: config.soul, user: config.user, memory: config.memory }, buildRuntimeOverride(config))
      : req;
    return this.deps.baseClient.chat(baseRequest);
  }

  async chatStream(req: ChatRequest, onChunk: (chunk: ChatStreamChunk) => void): Promise<ChatResponse> {
    const config = await loadConfigSafely(this.deps.store, this.deps.kind);
    const baseRequest: ChatRequest = config
      ? mergeRequest(req, { soul: config.soul, user: config.user, memory: config.memory }, buildRuntimeOverride(config))
      : req;
    return this.deps.baseClient.chatStream(baseRequest, onChunk);
  }
}

export function resolveKindFromRequest(opts: { kind?: AgentKind }): AgentKind {
  return opts.kind ?? 'interview';
}

export { buildSystemPrompt };
