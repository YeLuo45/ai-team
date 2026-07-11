// V183: transformers.js-style pipeline adapter.
//
// Real production shape:
//
//   import { pipeline, env } from '@huggingface/transformers';
//   env.allowLocalModels = false;
//   const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
//   const out = await pipe(audio);
//
// We don't bundle @huggingface/transformers (~2MB) — instead we expose
// the contract (WhisperTransformersPipeline) so a downstream
// integration can install the dependency out-of-band and call
// `attachTransformersPipeline(...)` from V180's client.
//
// This file ships the lib-side helpers:
//   * `cacheTransformersAsset(model)`    — primes the browser cache
//   * `loadTransformersPipeline(model)`   — returns a WhisperLocalClient-
//                                            compatible pipeline via the
//                                            dynamic-import contract
//   * `mapTransformersOutput(out)`        — normalises transformer.js
//                                            output to plain text + duration

import type { WhisperLocalPipeline } from './whisper-local-client';

/** Subset of @huggingface/transformers we depend on. Documents the
 *  real interface a production integration must satisfy. */
export interface TransformersAsr {
  (audio: Float32Array, options?: { language?: string }): Promise<TransformersOutput>;
}

export interface TransformersOutput {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

/** Detect a CDN / npm / local URL for the transformers.js bundle. */
export function transformersBundleUrl(): string {
  return 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js';
}

/** Reverse-engineered module shape (only the bits we need). */
export interface TransformersModule {
  pipeline: (task: string, model: string, options?: unknown) => Promise<TransformersAsr>;
  env: { allowLocalModels: boolean; allowRemoteModels: boolean; useBrowserCache: boolean };
}

let cachedModule: TransformersModule | null = null;
let cachedModuleUrl: string | null = null;

export interface DynamicImport {
  (url: string): Promise<unknown>;
}

const defaultImport: DynamicImport = (url) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Function(`return import('${url}')`)() as Promise<any>;

/** Load the transformers.js bundle from a CDN URL. Idempotent — caches
 *  the resolved module for repeated callers. */
export async function loadTransformersModule(
  bundleUrl: string = transformersBundleUrl(),
  importer: DynamicImport = defaultImport,
): Promise<TransformersModule> {
  if (cachedModule && cachedModuleUrl === bundleUrl) {
    return cachedModule;
  }
  const mod = (await importer(bundleUrl)) as TransformersModule | { default: TransformersModule };
  const resolved =
    typeof (mod as { default?: TransformersModule }).default === 'object'
      ? (mod as { default: TransformersModule }).default
      : (mod as TransformersModule);
  cachedModule = resolved;
  cachedModuleUrl = bundleUrl;
  return resolved;
}

/** Drop the cached module — useful in dev / hot-reload scenarios. */
export function resetTransformersCache(): void {
  cachedModule = null;
  cachedModuleUrl = null;
}

/**
 * Construct a WhisperLocalPipeline from a transformers.js instance.
 *
 * Usage:
 *   const tx = await loadTransformersModule();
 *   const pipe = await tx.pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
 *   const client = new WhisperLocalClient({
 *     pipeline: adaptTransformersPipeline(pipe),
 *   });
 */
export function adaptTransformersPipeline(pipe: TransformersAsr): WhisperLocalPipeline {
  return {
    async transcribe(audio, options) {
      const out = await pipe(audio, { language: options?.language });
      return normalizeOut(out, audio.length / 16_000).text;
    },
  };
}

/** Normalise whatever a transformers.js pipeline returns — useful for
 *  tests and for callers that want rich output beyond plain text. */
export function normalizeOut(
  out: TransformersOutput | string,
  audioDurationSec: number,
): { text: string; durationSec: number; segments: Array<{ text: string; t0: number; t1: number }> } {
  if (typeof out === 'string') {
    return {
      text: out,
      durationSec: audioDurationSec,
      segments: out
        ? [{ text: out, t0: 0, t1: audioDurationSec }]
        : [],
    };
  }
  const text = out.text;
  const segments = (out.chunks ?? [])
    .filter((c) => {
      if (typeof c.timestamp[1] !== 'number') return false;
      return Number.isFinite(c.timestamp[1]);
    })
    .map((c) => ({
      text: c.text,
      t0: c.timestamp[0],
      t1: c.timestamp[1],
    }));
  return {
    text,
    durationSec: audioDurationSec,
    segments: segments.length > 0 ? segments : text ? [{ text, t0: 0, t1: audioDurationSec }] : [],
  };
}

/** Cache-bust-aware URL helper — useful for re-priming the browser
 *  cache after a model upgrade. */
export function cachePrimingUrl(base: string, revision: string | number): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}cacheBust=${encodeURIComponent(String(revision))}`;
}

/** Validate that a candidate model identifier looks like a
 *  HuggingFace repo id (org/name) before being passed to transformers.js. */
export function isValidModelId(model: string): boolean {
  if (typeof model !== 'string' || model.length === 0) return false;
  if (model.startsWith('/') || model.endsWith('/')) return false;
  const segments = model.split('/');
  if (segments.length !== 2) return false;
  if (segments.some((s) => s.length === 0)) return false;
  return true;
}
