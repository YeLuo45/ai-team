// V171: Ollama provider — speaks the local Ollama HTTP API
// (POST /api/generate, GET /api/tags). Designed for Ollama ≥ 0.3.x.
//
// Why this shape:
//   * `list()` calls `/api/tags` so the user can pick a model from a
//     dropdown that reflects what is actually installed.
//   * `generate()` returns the body of `/api/generate` for non-streamed
//     callers (test fixtures, prompt-engineering pipelines).
//   * `generateStream()` reads the NDJSON response line-by-line so the
//     caller can render text as the LLM produces it — the same shape
//     RealTimeQuestionSuggester will eventually consume.
//
// Privacy: the provider's `local` flag is `true`. The user-configured
// `endpoint` defaults to `http://localhost:11434`. The provider never
// reads cookies, never sends the prompt through any third-party relay,
// and exposes the URL through `endpoint()` so the UI can display it in
// the privacy badge.

import type {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmHealth,
  LlmProvider,
} from './types';

export interface OllamaProviderOptions {
  /** Ollama HTTP base URL. Default `http://localhost:11434`. */
  endpoint?: string;
  /** Default model. Default `llama3.2`. */
  defaultModel?: string;
  /** Inject a custom fetch implementation (used in tests). */
  fetchImpl?: typeof fetch;
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

interface OllamaStreamChunk {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

interface OllamaTagsResponse {
  models: ReadonlyArray<{ name: string }>;
}

const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama';
  readonly label = 'Ollama (本地 LLM · 100% 隐私)';
  readonly local = true;
  readonly supported = true;

  private readonly endpoint: string;
  readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaProviderOptions = {}) {
    this.endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, '');
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Returns the configured endpoint (without trailing slash). */
  endpoint_(): string {
    return this.endpoint;
  }

  async list(): Promise<ReadonlyArray<string>> {
    const res = await this.fetchImpl(`${this.endpoint}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`ollama list failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as OllamaTagsResponse;
    return body.models.map((m) => m.name);
  }

  /** Returns reachable + latency. Useful for the privacy badge. */
  async health(): Promise<LlmHealth> {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const res = await this.fetchImpl(`${this.endpoint}/`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return { reachable: res.ok, latencyMs: Math.round(t1 - t0) };
    } catch (e) {
      return { reachable: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async generate(
    prompt: string,
    options: LlmGenerateOptions = {},
  ): Promise<LlmGenerateResult> {
    const body = {
      model: options.model ?? this.defaultModel,
      prompt,
      stream: false,
      options: this.toOllamaOptions(options),
    };
    const res = await this.fetchImpl(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: options.signal ?? null,
    });
    if (!res.ok) {
      throw new Error(`ollama generate failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as OllamaGenerateResponse;
    return {
      text: json.response,
      model: json.model,
      tokens: combineTokens(json.eval_count, json.prompt_eval_count),
      durationMs: json.total_duration ? Math.round(json.total_duration / 1_000_000) : undefined,
    };
  }

  async generateStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options: LlmGenerateOptions = {},
  ): Promise<LlmGenerateResult> {
    const body = {
      model: options.model ?? this.defaultModel,
      prompt,
      stream: true,
      options: this.toOllamaOptions(options),
    };
    const res = await this.fetchImpl(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
      },
      body: JSON.stringify(body),
      signal: options.signal ?? null,
    });
    if (!res.ok) {
      throw new Error(`ollama stream failed: ${res.status} ${res.statusText}`);
    }
    if (!res.body) {
      // Fall back to buffered read when running under fetch impls that
      // don't expose a ReadableStream (e.g. some Node test stubs).
      const text = await res.text();
      const json = JSON.parse(text) as OllamaStreamChunk;
      onChunk(json.response);
      return {
        text: json.response,
        model: json.model,
        tokens: combineTokens(json.eval_count, json.prompt_eval_count),
        durationMs: json.total_duration ? Math.round(json.total_duration / 1_000_000) : undefined,
      };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalText = '';
    let lastChunk: OllamaStreamChunk | null = null;
    // Append model + tokens from the final chunk in the stream.
    // The Ollama protocol emits a final chunk with `done: true`.
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;
        let parsed: OllamaStreamChunk;
        try {
          parsed = JSON.parse(line) as OllamaStreamChunk;
        } catch {
          continue;
        }
        if (parsed.response) {
          onChunk(parsed.response);
          totalText += parsed.response;
        }
        if (parsed.done) lastChunk = parsed;
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer) as OllamaStreamChunk;
        if (parsed.response) {
          onChunk(parsed.response);
          totalText += parsed.response;
        }
        if (parsed.done) lastChunk = parsed;
      } catch {
        // ignore trailing partial chunk
      }
    }
    return {
      text: totalText,
      model: lastChunk?.model,
      tokens: lastChunk
        ? combineTokens(lastChunk.eval_count, lastChunk.prompt_eval_count)
        : undefined,
      durationMs: lastChunk?.total_duration
        ? Math.round(lastChunk.total_duration / 1_000_000)
        : undefined,
    };
  }

  private toOllamaOptions(options: LlmGenerateOptions): Record<string, unknown> {
    const opts: Record<string, unknown> = {};
    if (options.temperature !== undefined) opts['temperature'] = options.temperature;
    if (options.num_predict !== undefined) opts['num_predict'] = options.num_predict;
    if (options.stop !== undefined) opts['stop'] = [...options.stop];
    return opts;
  }
}

function combineTokens(evalCount?: number, promptEvalCount?: number): number | undefined {
  if (typeof evalCount !== 'number' && typeof promptEvalCount !== 'number') return undefined;
  return (evalCount ?? 0) + (promptEvalCount ?? 0);
}
