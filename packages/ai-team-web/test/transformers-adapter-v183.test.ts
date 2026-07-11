import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  transformersBundleUrl,
  loadTransformersModule,
  resetTransformersCache,
  adaptTransformersPipeline,
  normalizeOut,
  cachePrimingUrl,
  isValidModelId,
  type TransformersAsr,
  type TransformersModule,
} from '../src/lib/stt/transformers-adapter';
import { WhisperLocalClient } from '../src/lib/stt/whisper-local-client';

beforeEach(() => {
  resetTransformersCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetTransformersCache();
});

// ====================================================================
// 1. URLs and validation
// ====================================================================

describe('transformersBundleUrl', () => {
  it('returns a stable CDN URL pointing at @huggingface/transformers', () => {
    expect(transformersBundleUrl()).toContain('@huggingface/transformers');
    expect(transformersBundleUrl()).toMatch(/^https:\/\//);
  });
});

describe('isValidModelId', () => {
  it('accepts HuggingFace org/name identifiers', () => {
    expect(isValidModelId('Xenova/whisper-base')).toBe(true);
    expect(isValidModelId('openai/whisper-tiny')).toBe(true);
    expect(isValidModelId('a/b/c')).toBe(false);
    expect(isValidModelId('only-one')).toBe(false);
    expect(isValidModelId('')).toBe(false);
    expect(isValidModelId('Xenova/')).toBe(false);
    expect(isValidModelId('/whisper')).toBe(false);
    expect(isValidModelId('')).toBe(false);
  });

  it('rejects empty / leading-slash segments', () => {
    expect(isValidModelId('/a')).toBe(false);
    expect(isValidModelId('a/')).toBe(false);
    expect(isValidModelId('//a')).toBe(false);
  });
});

describe('cachePrimingUrl', () => {
  it('appends a cacheBust query string without breaking existing query params', () => {
    expect(cachePrimingUrl('https://example.com/model.onnx', 7)).toContain('cacheBust=7');
    expect(cachePrimingUrl('https://example.com/model.onnx?foo=1', 'r2')).toBe(
      'https://example.com/model.onnx?foo=1&cacheBust=r2',
    );
  });
});

// ====================================================================
// 2. Module loader
// ====================================================================

describe('loadTransformersModule', () => {
  it('invokes the dynamic importer with the bundle URL by default', async () => {
    const seen: string[] = [];
    const fakeImporter: (url: string) => Promise<unknown> = async (url) => {
      seen.push(url);
      return {
        pipeline: async () => () => ({ text: 'mock' }),
        env: { allowLocalModels: false, allowRemoteModels: true, useBrowserCache: true },
      };
    };
    const m = await loadTransformersModule(transformersBundleUrl(), fakeImporter);
    expect(seen).toEqual([transformersBundleUrl()]);
    expect(typeof m.pipeline).toBe('function');
    expect(typeof m.env).toBe('object');
  });

  it('accepts a custom URL and forwards it to the importer', async () => {
    const seen: string[] = [];
    const fakeImporter = async (url: string) => {
      seen.push(url);
      return {
        pipeline: async () => () => ({ text: 'mock' }),
        env: { allowLocalModels: false, allowRemoteModels: true, useBrowserCache: true },
      };
    };
    await loadTransformersModule('https://example.com/custom.js', fakeImporter);
    expect(seen).toEqual(['https://example.com/custom.js']);
  });

  it('caches the resolved module so subsequent calls skip the importer', async () => {
    let calls = 0;
    const fakeImporter = async () => {
      calls += 1;
      return {
        pipeline: async () => () => ({ text: 'mock' }),
        env: { allowLocalModels: false, allowRemoteModels: true, useBrowserCache: true },
      };
    };
    await loadTransformersModule(transformersBundleUrl(), fakeImporter);
    await loadTransformersModule(transformersBundleUrl(), fakeImporter);
    expect(calls).toBe(1);
  });

  it('re-imports when the URL changes', async () => {
    let calls = 0;
    const fakeImporter = async () => {
      calls += 1;
      return {
        pipeline: async () => () => ({ text: 'mock' }),
        env: { allowLocalModels: false, allowRemoteModels: true, useBrowserCache: true },
      };
    };
    await loadTransformersModule('https://example.com/v1.js', fakeImporter);
    await loadTransformersModule('https://example.com/v2.js', fakeImporter);
    expect(calls).toBe(2);
  });

  it('unwraps a default-exports module shape', async () => {
    const fakeImporter = async () => ({
      default: {
        pipeline: async () => () => ({ text: 'mock' }),
        env: { allowLocalModels: false, allowRemoteModels: true, useBrowserCache: true },
      },
    });
    const m = await loadTransformersModule(transformersBundleUrl(), fakeImporter);
    expect(typeof m.pipeline).toBe('function');
  });

  it('resetTransformersCache forces a re-import', async () => {
    let calls = 0;
    const fakeImporter = async () => {
      calls += 1;
      return {
        pipeline: async () => () => ({ text: 'mock' }),
        env: { allowLocalModels: false, allowRemoteModels: true, useBrowserCache: true },
      };
    };
    await loadTransformersModule(transformersBundleUrl(), fakeImporter);
    resetTransformersCache();
    await loadTransformersModule(transformersBundleUrl(), fakeImporter);
    expect(calls).toBe(2);
  });
});

// ====================================================================
// 3. Pipeline adapter (transcribe + normalise)
// ====================================================================

describe('adaptTransformersPipeline', () => {
  function makeStubPipeline(impl: TransformersAsr) {
    const client = new WhisperLocalClient({
      pipeline: adaptTransformersPipeline(impl),
    });
    return client;
  }

  it('delegates a Float32Array transcript to the underlying pipeline', async () => {
    let calledWith: Float32Array | null = null;
    const stubPipeline: TransformersAsr = async (audio) => {
      calledWith = new Float32Array(audio);
      return { text: 'hello world' };
    };
    const client = makeStubPipeline(stubPipeline);
    const out = await client.transcribe(new Float32Array(16_000)); // 1 second
    expect(out.text).toBe('hello world');
    expect(out.durationSec).toBe(1);
    expect(calledWith?.length).toBe(16_000);
  });

  it('forwards language option', async () => {
    const seen: Array<{ language?: string } | undefined> = [];
    const stubPipeline: TransformersAsr = async (_audio, opts) => {
      seen.push(opts);
      return { text: '' };
    };
    const client = makeStubPipeline(stubPipeline);
    await client.transcribe(new Float32Array(16_000), { language: 'zh' });
    expect(seen[0]?.language).toBe('zh');
  });

  it('packs the result into a segments array when the underlying call returns chunks', async () => {
    // The adapter collapses the chunks into plain text (WhisperLocalPipeline
    // contract is `text: string`), so we exercise the chunk-aware
    // behaviour via `normalizeOut` directly.
    const out = normalizeOut(
      {
        text: 'hi there',
        chunks: [
          { text: 'hi', timestamp: [0, 0.5] },
          { text: 'there', timestamp: [0.5, 1] },
        ],
      },
      1,
    );
    expect(out.segments.length).toBe(2);
    expect(out.segments[0]?.text).toBe('hi');
    expect(out.segments[1]?.t1).toBe(1);
    // The adapter surfaces just the joined text via the WhisperLocalClient
    // pipeline contract.
    const stubPipeline: TransformersAsr = async () => ({
      text: 'hi there',
      chunks: [
        { text: 'hi', timestamp: [0, 0.5] },
        { text: 'there', timestamp: [0.5, 1] },
      ],
    });
    const client = new WhisperLocalClient({
      pipeline: adaptTransformersPipeline(stubPipeline),
    });
    const r = await client.transcribe(new Float32Array(16_000));
    expect(r.text).toBe('hi there');
    expect(r.segments.length).toBe(1);
  });
});

describe('normalizeOut', () => {
  it('keeps the full text and synthesises a single segment when chunks are missing', () => {
    const out = normalizeOut({ text: 'hello' }, 1);
    expect(out.text).toBe('hello');
    expect(out.segments.length).toBe(1);
    expect(out.segments[0]?.t1).toBe(1);
  });

  it('returns an empty segments array when text is empty', () => {
    expect(normalizeOut({ text: '' }, 1).segments.length).toBe(0);
  });

  it('handles the bare-string output from older transformer.js versions', () => {
    const out = normalizeOut('plain text', 2);
    expect(out.text).toBe('plain text');
    expect(out.durationSec).toBe(2);
    expect(out.segments.length).toBe(1);
  });

  it('drops chunks with NaN / undefined timestamps', () => {
    const out = normalizeOut(
      {
        text: 'x',
        chunks: [
          { text: 'keep', timestamp: [0, 0.4] },
          { text: 'drop', timestamp: [0.4, NaN] },
        ],
      },
      1,
    );
    expect(out.segments.length).toBe(1);
    expect(out.segments[0]?.text).toBe('keep');
  });
});

// ====================================================================
// 4. End-to-end smoke test (load → adapt → transcribe)
// ====================================================================

describe('transformers adapter end-to-end', () => {
  it('plumbs the loaded bundle into a WhisperLocalClient.transcribe() roundtrip', async () => {
    const tx: TransformersModule = {
      pipeline: async () => async (_audio: Float32Array) => ({
        text: 'e2e OK',
        chunks: [{ text: 'e2e OK', timestamp: [0, 0.5] }],
      }),
      env: { allowLocalModels: false, allowRemoteModels: true, useBrowserCache: true },
    };
    const importer: (url: string) => Promise<unknown> = async () => tx;
    const module = await loadTransformersModule('https://cdn.example/tx.js', importer);
    const pipe = await module.pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
    const client = new WhisperLocalClient({ pipeline: adaptTransformersPipeline(pipe) });
    const out = await client.transcribe(new Float32Array(16_000));
    expect(out.text).toBe('e2e OK');
    expect(out.segments.length).toBe(1);
  });
});
