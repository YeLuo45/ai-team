// V161: Whisper (OpenAI / remote) provider — stubbed. Emits not-implemented
// errors when start() is called so the registry can advertise the provider
// for planning without exposing it as currently usable.

import type { SttProvider, SttSession } from './types';

export class WhisperSttProvider implements SttProvider {
  readonly id = 'whisper';
  readonly label = 'Whisper (OpenAI API · 远程)';
  readonly local = false;
  readonly supported = false;

  language(): string {
    return 'auto';
  }

  async start(session: SttSession): Promise<void> {
    session.onError?.({
      code: 'not-implemented',
      message: 'Whisper provider 暂未启用。请配置 OPENAI_API_KEY 后启用。',
    });
    session.onStateChange?.('error');
  }

  async stop(): Promise<void> {
    // No-op
  }
}

// V173: Whisper-server (whisper.cpp / local HTTP) batch provider.
// Unlike the streaming STT contract (start session + onChunk), this
// provider exposes a one-shot transcribe() helper that POSTs the latest
// recorded audio to a local whisper.cpp server. The registry advertises
// it as `whisper-server` for planning; the UI can opt-in via the
// associated `WhisperServerClient` returned by `client()` to drive
// batch transcription flows.

import type { WhisperInferenceOptions, WhisperTranscription } from './whisper-server-client';
import { WhisperServerClient } from './whisper-server-client';

export class WhisperServerSttProvider implements SttProvider {
  readonly id = 'whisper-server';
  readonly label = 'Whisper.cpp 本地服务器 · 100% 隐私';
  readonly local = true;
  readonly supported = true;
  private readonly client: WhisperServerClient;

  constructor(client: WhisperServerClient = new WhisperServerClient()) {
    this.client = client;
  }

  /** Returns the underlying HTTP client for batch flows. */
  client_(): WhisperServerClient {
    return this.client;
  }

  /** Endpoint helper. */
  endpoint(): string {
    return this.client.endpoint_();
  }

  /** Batch transcription entry point. */
  async transcribe(
    audio: ArrayBuffer | Uint8Array | Blob,
    options: WhisperInferenceOptions = {},
  ): Promise<WhisperTranscription> {
    return this.client.transcribe(audio, options);
  }

  language(): string {
    return this.client.language;
  }

  async start(_session: SttSession): Promise<void> {
    // whisper-server doesn't provide a streaming STT contract in the
    // current build — the provider announces its batch shape instead.
    _session.onStateChange?.('error');
    _session.onError?.({
      code: 'batch-only',
      message:
        'whisper-server 是批量模式。请使用 provider.transcribe() 上传一段音频获得结果。',
    });
  }

  async stop(): Promise<void> {
    // No streaming session to tear down.
  }
}

export { WhisperServerClient } from './whisper-server-client';
export type {
  WhisperServerClientOptions,
  WhisperInferenceOptions,
  WhisperTranscription,
  WhisperSegment,
  WhisperHealth,
} from './whisper-server-client';
