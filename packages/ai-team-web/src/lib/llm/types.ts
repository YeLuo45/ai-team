// V171: LLM provider abstraction — a small interface modelled on Ollama's
// HTTP API so candidate local models can drive AI features (summary,
// question suggestion, etc.) without leaving the network boundary.
//
// The interface deliberately mirrors the same shape as the existing
// SttProvider so future providers can be slotted into the same registry
// pattern (see stt/registry.ts). All providers must be safe to construct
// in test environments where no real backend is reachable — they expose
// `supported = false` until the user has confirmed connectivity.

export interface LlmGenerateOptions {
  /** Optional override of the model name (default = provider's default). */
  model?: string;
  /** Sampling temperature in [0, 1]. Default 0.2 for stable interview text. */
  temperature?: number;
  /** Hard cap on tokens returned. Default 512. */
  num_predict?: number;
  /** Stop sequences — generation halts when one is produced. */
  stop?: ReadonlyArray<string>;
  /** Aborts the request when fired. */
  signal?: AbortSignal;
}

export interface LlmGenerateResult {
  text: string;
  /** Cumulative tokens consumed by the call (prompt + completion). */
  tokens?: number;
  /** Time the model took, in milliseconds. */
  durationMs?: number;
  /** Model identifier actually used (after option resolution). */
  model?: string;
}

export interface LlmProvider {
  readonly id: string;
  readonly label: string;
  readonly local: boolean;
  readonly supported: boolean;
  /** Default model to use when none is supplied via options.model. */
  readonly defaultModel: string;
  /** Returns the list of models currently installed on the backend. */
  list(): Promise<ReadonlyArray<string>>;
  /** Single-shot generation. */
  generate(prompt: string, options?: LlmGenerateOptions): Promise<LlmGenerateResult>;
  /** Streamed generation. The callback fires for each NDJSON line. */
  generateStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: LlmGenerateOptions,
  ): Promise<LlmGenerateResult>;
}

export interface LlmHealth {
  /** True when the backend answered a `/` ping. */
  reachable: boolean;
  /** Backend-reported error message, if any. */
  error?: string;
  /** Round-trip latency in ms for the ping. */
  latencyMs?: number;
}
