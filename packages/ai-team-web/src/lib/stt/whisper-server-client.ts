// V173: Whisper-server HTTP client.
//
// Talks to the whisper.cpp server (https://github.com/ggml-org/whisper.cpp/
// tree/master/examples/server) which exposes a JSON `POST /inference`
// endpoint. Audio is base64-encoded inside the JSON payload — no
// multipart boundary, no streaming — so the client can run from any
// origin without cookie / multipart headache.
//
// Surface:
//   - `transcribe(audio, options?)` — single-shot inference.
//   - `listModels()` — `GET /models` — returns model id strings.
//   - `health()` — `GET /` — reachability + latency.
//
// Privacy / shape notes:
//   * `local = true` because the default endpoint is `http://127.0.0.1:8178`.
//   * No cookies, no telemetry — only the audio file leaves the browser
//     and only when the user explicitly chooses the provider.

export interface WhisperServerClientOptions {
  /** whisper-server HTTP base URL. Default `http://127.0.0.1:8178`. */
  endpoint?: string;
  /** Inject a custom fetch implementation (used in tests). */
  fetchImpl?: typeof fetch;
  /** Default language code. `auto` lets the server auto-detect. */
  language?: string;
}

export interface WhisperInferenceOptions {
  /** Force a specific language code, e.g. "zh". `auto` lets the server pick. */
  language?: string;
  /** Translate to English when set. Default false. */
  translate?: boolean;
  /** Initial sampling temperature. */
  temperature?: number;
  /** Temperature increment per retry. */
  temperatureIncrement?: number;
  /** `json` for segments, `text` for plain transcript. Default `json`. */
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json';
  /** Optional model id override. */
  model?: string;
  /** Aborts the request when fired. */
  signal?: AbortSignal;
}

export interface WhisperSegment {
  /** Segment text. */
  readonly text: string;
  /** Segment start in milliseconds. */
  readonly t0Ms: number;
  /** Segment end in milliseconds. */
  readonly t1Ms: number;
  /** Per-token tokens when verbose_json is requested. */
  readonly tokens?: ReadonlyArray<unknown>;
}

export interface WhisperTranscription {
  readonly text: string;
  readonly segments: ReadonlyArray<WhisperSegment>;
  /** Detected language (when `auto` is used). */
  readonly language?: string;
  /** Total processing time in milliseconds. */
  readonly inferenceMs?: number;
}

export interface WhisperHealth {
  readonly reachable: boolean;
  readonly latencyMs?: number;
  readonly error?: string;
  /** Server-advertised version when probed. */
  readonly version?: string;
}

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8178';
const DEFAULT_LANGUAGE = 'auto';

interface WhisperServerJsonResponse {
  text?: string;
  language?: string;
  inference_time_ms?: number;
  segments?: Array<{
    text: string;
    t0?: number;
    t1?: number;
    tokens?: unknown[];
  }>;
}

/**
 * Convert audio data to base64 (browser-safe). Uses Web APIs when
 * available; falls back to plain string conversion for Node test stubs.
 */
async function toBase64(input: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  if (typeof Buffer !== 'undefined' && input instanceof Uint8Array) {
    return Buffer.from(input).toString('base64');
  }
  const bytes =
    input instanceof Blob
      ? new Uint8Array(await input.arrayBuffer())
      : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa !== 'undefined') return btoa(binary);
  // Some Node configurations lack `btoa` in test runners.
  return Buffer.from(binary, 'binary').toString('base64');
}

export class WhisperServerClient {
  readonly endpoint: string;
  readonly language: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WhisperServerClientOptions = {}) {
    this.endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, '');
    this.language = options.language ?? DEFAULT_LANGUAGE;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Endpoint helper exposed for the UI badge (privacy display). */
  endpoint_(): string {
    return this.endpoint;
  }

  async transcribe(
    audio: ArrayBuffer | Uint8Array | Blob,
    options: WhisperInferenceOptions = {},
  ): Promise<WhisperTranscription> {
    const audio_data = await toBase64(audio);
    const body = {
      audio_data,
      language: options.language ?? this.language,
      translate: options.translate ?? false,
      temperature: options.temperature ?? 0.0,
      temperature_inc: options.temperatureIncrement ?? 0.2,
      response_format: options.responseFormat ?? 'json',
      model: options.model,
    };
    const res = await this.fetchImpl(`${this.endpoint}/inference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: options.signal ?? null,
    });
    if (!res.ok) {
      throw new Error(`whisper inference failed: ${res.status} ${res.statusText}`);
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const json = (await res.json()) as WhisperServerJsonResponse;
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const segments: WhisperSegment[] = (json.segments ?? []).map((s) => ({
      text: s.text,
      t0Ms: typeof s.t0 === 'number' ? Math.round(s.t0 * 1000) : 0,
      t1Ms: typeof s.t1 === 'number' ? Math.round(s.t1 * 1000) : 0,
      tokens: Array.isArray(s.tokens) ? s.tokens : undefined,
    }));
    return {
      text: json.text ?? segments.map((s) => s.text).join(''),
      segments,
      language: json.language,
      inferenceMs: json.inference_time_ms ?? Math.round(t1 - t0),
    };
  }

  /** Probe the server's known models. whisper-server responds with HTML
   *  on `/`, so we instead decode the JSON `/models` endpoint. */
  async listModels(): Promise<ReadonlyArray<string>> {
    const res = await this.fetchImpl(`${this.endpoint}/models`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      // Many builds don't expose /models — return empty rather than throw.
      return [];
    }
    const body = (await res.json()) as { models?: string[] };
    return body.models ?? [];
  }

  async health(): Promise<WhisperHealth> {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const res = await this.fetchImpl(`${this.endpoint}/`, {
        method: 'GET',
        headers: { Accept: 'text/html,application/json' },
      });
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const version = res.headers.get('server') ?? undefined;
      return {
        reachable: res.ok,
        latencyMs: Math.round(t1 - t0),
        version,
      };
    } catch (e) {
      return { reachable: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
