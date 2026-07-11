// V180: WhisperLocal (in-browser WASM-capable STT) client.
//
// AI-team's seventh STT provider. Designed to feed an `@xenova/transformers`
// Whisper pipeline that runs entirely in the browser tab (WebAssembly +
// ONNX runtime + cached model). The model never leaves the user's device.
//
// We don't ship transformers.js as a direct dependency (it adds ~2MB to
// the bundle). Instead, the consumer wires a `WhisperLocalPipeline`
// implementation at runtime; the default `createDefaultPipeline()` returns
// a built-in lightweight mock that fulfils the contract for tests + UI.
// A real consumer replaces it via `attachPipeline()` to opt-in to the
// WASM path:
//
//   import { pipeline } from '@xenova/transformers';
//   attachPipeline(async (audio) => {
//     const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
//     const out = await pipe(audio);
//     return out.text;
//   });
//
// This indirection keeps the test surface tiny while leaving the
// production path open to a one-line integration.

export interface WhisperLocalPipeline {
  /**
   * Run Whisper on the given audio and return raw transcript text. The
   * pipeline decides chunking + timestamps; the client surfaces the
   * text as a single-segment chunk so the rest of ai-team's STT
   * pipeline can stay unchanged.
   */
  transcribe(audio: Float32Array, options?: WhisperLocalOptions): Promise<string>;
}

export interface WhisperLocalOptions {
  /** Override model identifier (default `Xenova/whisper-base`). */
  model?: string;
  /** Override language code (`auto` lets the model detect). */
  language?: string;
  /** Abort signal forwarded to the pipeline. */
  signal?: AbortSignal;
}

export interface WhisperLocalClientOptions {
  /** Default model to use when none is supplied in `transcribe()`. */
  defaultModel?: string;
  /**
   * Inject a pipeline implementation; defaults to a built-in mock that
   * echoes the audio duration so the rest of the STT UI can be
   * exercised without paying for a real WASM runtime.
   */
  pipeline?: WhisperLocalPipeline;
  /** Inject a custom fetch (used to load ONNX models in tests). */
  fetchImpl?: typeof fetch;
}

export interface WhisperLocalSegment {
  /** Transcript text. */
  readonly text: string;
  /** Approximate start time in seconds (best-effort, depends on
   *  the pipeline's underlying timestamp resolver). */
  readonly t0: number;
  /** Approximate end time in seconds. */
  readonly t1: number;
}

export interface WhisperLocalResult {
  /** Combined transcript text. */
  readonly text: string;
  /** Per-segment breakdown when the pipeline returns one. */
  readonly segments: ReadonlyArray<WhisperLocalSegment>;
  /** Detected language (when supported). */
  readonly language?: string;
  /** Length of the audio buffer (seconds). */
  readonly durationSec: number;
}

const DEFAULT_MODEL = 'Xenova/whisper-base';

/**
 * Built-in fallback pipeline that doesn't load any model. It produces a
 * predictable transcript based on the audio duration so test fixtures
 * stay deterministic. Real browsers swap this out via `attachPipeline`.
 */
function makeMockPipeline(): WhisperLocalPipeline {
  return {
    async transcribe(audio, options) {
      const seconds = audio.length / 16_000; // 16 kHz mono
      const model = options?.model ?? 'mock-base';
      return `[${model} mock ${Math.max(1, Math.round(seconds))}s] ${getRandomMockWords(seconds)}`;
    },
  };
}

function getRandomMockWords(seconds: number): string {
  const words = ['你好', '请', '简单', '介绍', '项目', '基础', '目标', '挑战', '技术', '实现'];
  const out: string[] = [];
  let count = Math.max(3, Math.round(seconds * 1.5));
  // Deterministic seed so tests can compare against captured text.
  let seed = Math.max(1, Math.round(seconds));
  for (let i = 0; i < count; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    out.push(words[seed % words.length] ?? '');
  }
  return out.join(' ');
}

export class WhisperLocalClient {
  readonly defaultModel: string;
  private pipeline: WhisperLocalPipeline;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WhisperLocalClientOptions = {}) {
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.pipeline = options.pipeline ?? makeMockPipeline();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Replace the current pipeline (test-only — production wires the real
   * transformers.js pipeline once at boot).
   */
  attachPipeline(pipeline: WhisperLocalPipeline): void {
    this.pipeline = pipeline;
  }

  /** Reconcile the configured pipeline back to the default mock. */
  resetPipeline(): void {
    this.pipeline = makeMockPipeline();
  }

  /** Probe whether the ONNX model file is locally available. */
  async isModelCached(model?: string): Promise<boolean> {
    const url = this.resolveModelUrl(model);
    try {
      const res = await this.fetchImpl(url, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Pull the model URL the pipeline would load (purely informational). */
  resolveModelUrl(model?: string): string {
    const id = model ?? this.defaultModel;
    return `https://huggingface.co/${id}/resolve/main/onnx/model.onnx`;
  }

  async transcribe(
    audio: Float32Array,
    options: WhisperLocalOptions = {},
  ): Promise<WhisperLocalResult> {
    if (!(audio instanceof Float32Array)) {
      throw new Error('WhisperLocalClient.transcribe requires a Float32Array');
    }
    const text = await this.pipeline.transcribe(audio, {
      model: options.model ?? this.defaultModel,
      language: options.language,
      signal: options.signal,
    });
    return {
      text,
      durationSec: audio.length / 16_000,
      segments: text
        ? [
            {
              text,
              t0: 0,
              t1: audio.length / 16_000,
            },
          ]
        : [],
    };
  }
}
