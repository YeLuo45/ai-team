// V180: In-browser Whisper provider — wraps WhisperLocalClient behind
// the existing SttProvider contract so the registry, the privacy badge,
// and the speaker-diarization UI keep working unchanged.
//
// Real production wiring: see docs/delivery/v180 for the one-line
// `attachPipeline()` integration with `@xenova/transformers`.

import { WhisperLocalClient } from './whisper-local-client';
import type { WhisperLocalClientOptions } from './whisper-local-client';
import type { SttProvider, SttSession } from './types';

export class WhisperLocalSttProvider implements SttProvider {
  readonly id = 'whisper-local';
  readonly label = 'Whisper (浏览器 WASM · 100% 本地)';
  readonly local = true;
  readonly supported = true;
  private readonly client: WhisperLocalClient;
  private currentSession: SttSession | null = null;
  private currentAudio: Float32Array[] = [];
  private currentStream: MediaStream | null = null;
  private recordContext: AudioContext | null = null;

  constructor(clientOptions: WhisperLocalClientOptions = {}) {
    this.client = new WhisperLocalClient(clientOptions);
  }

  /** Pass-through for callers that want the raw client (e.g. UI). */
  client_(): WhisperLocalClient {
    return this.client;
  }

  /** Default model identifier. */
  get defaultModel(): string {
    return this.client.defaultModel;
  }

  language(): string {
    return 'zh-CN';
  }

  async start(session: SttSession): Promise<void> {
    this.currentSession = session;
    this.currentAudio = [];
    this.currentStream = null;
    try {
      // Capture microphone audio via the browser's MediaDevices API. The
      // provider still respects the `local` flag — frames stay in the
      // browser tab.
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        this.currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtor: typeof AudioContext | undefined =
          typeof window !== 'undefined'
            ? (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
              ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            : undefined;
        if (AudioCtor) {
          const ctx = new AudioCtor();
          this.recordContext = ctx;
          const source = ctx.createMediaStreamSource(this.currentStream);
          const buf: Float32Array[] = [];
          const processor = ctx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (ev) => {
            const ch = ev.inputBuffer.getChannelData(0);
            buf.push(new Float32Array(ch));
          };
          source.connect(processor);
          processor.connect(ctx.destination);
          this.currentAudio = buf;
        }
      }
      session.onStateChange?.('listening');
    } catch (e) {
      session.onError?.({
        code: 'microphone-unavailable',
        message: e instanceof Error ? e.message : String(e),
      });
      session.onStateChange?.('error');
    }
  }

  async stop(): Promise<void> {
    const session = this.currentSession;
    const audio = this.currentAudio;
    if (audio.length > 0) {
      const merged = mergeBuffers(audio);
      try {
        const result = await this.client.transcribe(merged);
        session?.onChunk?.({
          text: result.text,
          speaker: 'candidate',
          timestamp: Date.now(),
          isFinal: true,
          confidence: 0.9,
        });
      } catch (e) {
        session?.onError?.({
          code: 'transcription-failed',
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((t) => t.stop());
      this.currentStream = null;
    }
    if (this.recordContext) {
      try {
        await this.recordContext.close();
      } catch {
        // ignore — context might already be closed
      }
      this.recordContext = null;
    }
    session?.onStateChange?.('idle');
    this.currentSession = null;
    this.currentAudio = [];
  }
}

function mergeBuffers(buffers: Float32Array[]): Float32Array {
  let total = 0;
  for (const b of buffers) total += b.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}
