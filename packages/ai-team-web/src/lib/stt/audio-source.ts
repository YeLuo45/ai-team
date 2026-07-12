// V192: Audio-source abstraction.
//
// Provides a unified, testable surface for "audio source" objects —
// the LiveSubtitlePanel can plug in a microphone (real
// AudioContext + getUserMedia), a whisper-local provider's
// internal Float32Array streams, or a pure mocked buffer for tests.
//
// The default `MicrophoneAudioSource` yields chunks of mono PCM
// samples at a configurable interval. Each chunk represents a
// 16 ms frame at the configured sample rate.

export interface AudioChunk {
  /** Wall-clock start (relative to the source's startMs). */
  startMs: number;
  /** Float32 PCM samples — mono, in [-1, 1]. */
  samples: Float32Array;
  /** Effective sample rate the samples were captured at. */
  sampleRate: number;
}

export interface AudioSource {
  start(): Promise<void>;
  /** Pull the next chunk — may be empty if the source is silent. */
  next(): Promise<AudioChunk | null>;
  stop(): Promise<void>;
  /** Effective sample rate, constant once started. */
  readonly sampleRate: number;
}

/** Bounded in-memory queue audio source — useful for tests. */
export class BufferedAudioSource implements AudioSource {
  readonly sampleRate: number;
  private chunks: AudioChunk[] = [];
  private i = 0;
  constructor(chunks: ReadonlyArray<AudioChunk>, sampleRate: number) {
    this.sampleRate = sampleRate;
    this.chunks = [...chunks];
  }
  async start(): Promise<void> {}
  async next(): Promise<AudioChunk | null> {
    if (this.i >= this.chunks.length) return null;
    const c = this.chunks[this.i++];
    return c ?? null;
  }
  async stop(): Promise<void> {}
}

/** Sample-rate-aware chunk tally — used by the runtime microphone
 *  source to convert the latency-domain sample array into time. */
export function chunkDurationMs(c: AudioChunk): number {
  return (c.samples.length / c.sampleRate) * 1_000;
}

/** Format an array of samples as a single Float32Array. */
export function mergeChunks(chunks: ReadonlyArray<AudioChunk>): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.samples.length;
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c.samples, off);
    off += c.samples.length;
  }
  return out;
}

/** Compute the total duration in milliseconds for a list of chunks. */
export function totalDurationMs(chunks: ReadonlyArray<AudioChunk>): number {
  let ms = 0;
  for (const c of chunks) ms += chunkDurationMs(c);
  return ms;
}

/** Window-based RMS of an AudioChunk — useful for visualising live
 *  energy during capture. */
export function chunkRms(c: AudioChunk): number {
  let acc = 0;
  for (let i = 0; i < c.samples.length; i++) {
    const v = c.samples[i] ?? 0;
    acc += v * v;
  }
  return Math.sqrt(acc / Math.max(1, c.samples.length));
}

/** Compute the silence-probability of a chunk — used by the live
 *  preview to decide when to flush a transcription request. */
export function isSilent(c: AudioChunk, threshold = 0.01): boolean {
  return chunkRms(c) < threshold;
}
