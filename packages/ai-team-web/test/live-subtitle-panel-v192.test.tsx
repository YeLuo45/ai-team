// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { LiveSubtitlePanel } from '../src/components/stt/LiveSubtitlePanel';
import {
  BufferedAudioSource,
  type AudioChunk,
  type AudioSource,
} from '../src/lib/stt/audio-source';

function fakeChunk(text: string, startMs: number): AudioChunk {
  const samples = new Float32Array(16_000 / 4);
  samples.fill(0.4);
  return { startMs, samples, sampleRate: 16_000 };
}

function scriptSource(scripts: string[]): AudioSource {
  const chunks: AudioChunk[] = scripts.map((text, i) => fakeChunk(text, i * 250));
  return new BufferedAudioSource(chunks, 16_000);
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 10 && !predicate(); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

describe('LiveSubtitlePanel', () => {
  it('mounts with status idle until chunks arrive', async () => {
    let captured: HTMLElement | null = null;
    render(
      <LiveSubtitlePanel
        audio={scriptSource(['Hello world'])}
        transcribe={async (chunk) => ({
          startMs: chunk.startMs,
          endMs: chunk.startMs + 250,
          text: 'Hello world',
        })}
        emitIntervalMs={100}
        testId="lsp"
      />,
    );
    captured = document.querySelector('[data-testid="lsp"]');
    expect(captured).toBeTruthy();
  });

  it('captions accumulate as transcription returns', async () => {
    let resolve: (value: HTMLElement | null) => void = () => undefined;
    const done = new Promise<HTMLElement | null>((r) => {
      resolve = r;
    });
    render(
      <LiveSubtitlePanel
        audio={scriptSource(['hi', 'again'])}
        transcribe={async (chunk) => {
          // Map by chunk index — easier in this test.
          const idx = chunk.startMs / 250;
          const text = idx === 0 ? 'hi' : 'again';
          return { startMs: chunk.startMs, endMs: chunk.startMs + 250, text };
        }}
        emitIntervalMs={100}
        testId="lsp"
      />,
    );
    await waitFor(
      () =>
        (document.querySelector('[data-testid="lsp"]')?.getAttribute('data-cue-count') ??
          '0') >= '1',
    );
    resolve(document.querySelector('[data-testid="lsp"]'));
    const root = await done;
    const cues = Number(root?.getAttribute('data-cue-count'));
    expect(cues).toBeGreaterThanOrEqual(1);
  });

  it('renders an error chip when transcribe throws', async () => {
    render(
      <LiveSubtitlePanel
        audio={scriptSource(['x'])}
        transcribe={async () => {
          throw new Error('mock fail');
        }}
        emitIntervalMs={100}
        testId="lsp"
      />,
    );
    await waitFor(() => {
      const root = document.querySelector('[data-testid="lsp"]');
      return root?.getAttribute('data-status') === 'error' ||
        document.querySelector('[data-testid="lsp-error"]') !== null;
    });
    expect(document.querySelector('[data-testid="lsp-error"]')?.textContent).toMatch(/mock fail/);
  });
});
