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
