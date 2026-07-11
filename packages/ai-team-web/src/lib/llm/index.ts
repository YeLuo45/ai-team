// V171: LLM provider registry. Mirrors the STT provider registry pattern
// so the UI can iterate through providers the same way.

import { OllamaProvider } from './ollama-provider';
import type { LlmProvider } from './types';

export type { LlmProvider, LlmGenerateOptions, LlmGenerateResult, LlmHealth } from './types';

export interface LlmProviderOption {
  id: string;
  label: string;
  description: string;
  local: boolean;
  supported: boolean;
}

export function listLlmProviders(): LlmProvider[] {
  return [
    new OllamaProvider(),
    // Future providers (llama.cpp, MLX, GGUF direct, etc.) slot in here.
  ];
}

export function listLlmProviderOptions(): LlmProviderOption[] {
  return listLlmProviders().map((p) => ({
    id: p.id,
    label: p.label,
    description: p.local ? '本地处理 · 隐私优先' : '远程服务 · 数据外发',
    local: p.local,
    supported: p.supported,
  }));
}

export function getLlmProvider(id: string): LlmProvider | undefined {
  return listLlmProviders().find((p) => p.id === id);
}

/** Returns the first *supported* provider. Defaults to ollama when reachable. */
export function getDefaultLlmProviderId(): string {
  const supported = listLlmProviders().filter((p) => p.supported);
  return supported[0]?.id ?? 'mock-llm';
}

export { OllamaProvider } from './ollama-provider';

export {
  type EvalFixture,
  type EvalExpectation,
  type AgentRunner,
  type EvalCaseResult,
  type EvalSummary,
  runEvalCase,
  runEvalSuite,
  summarise,
  passRate,
  formatPassRate,
  evaluateExpectation,
} from './eval-harness';

export {
  type LoadError,
  type LoadResult,
  loadFixturesFromJson,
  loadFixturesOnly,
} from './fixture-loader';

export {
  type StreamingProgress,
  type StreamingProgressCallback,
  type RunStreamingOptions,
  type StreamingSummary,
  runStreamingEvalSuite,
  completedResults,
  progressPercent,
} from './run-streaming';
