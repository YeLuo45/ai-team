// V161: Web Speech API provider. Wraps the (Chromium-only) SpeechRecognition
// API behind the SttProvider interface. Falls back to webkitSpeechRecognition
// for older Safari. Defaults the language to zh-CN (auto-detect can be added
// later).

import type { SttProvider, SttSession } from './types';

// Type-guards for the two browser variants of the API.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: ((event: any) => void) | null;
  onstart: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

function resolveCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as WindowWithSpeechRecognition;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechProvider implements SttProvider {
  readonly id = 'web-speech';
  readonly label = '浏览器内置 (Web Speech API)';
  readonly local = true;
  private recognition: SpeechRecognitionLike | null = null;
  private session: SttSession | null = null;

  get supported(): boolean {
    return resolveCtor() !== null;
  }

  language(): string {
    return this.recognition?.lang ?? 'zh-CN';
  }

  async start(session: SttSession): Promise<void> {
    const Ctor = resolveCtor();
    if (!Ctor) {
      const err = { code: 'unsupported', message: '当前浏览器不支持 Web Speech API' };
      session.onError?.(err);
      session.onStateChange?.('error');
      return;
    }
    // Idempotent — if already listening, do not start a second stream.
    if (this.recognition) {
      session.onStateChange?.('listening');
      return;
    }
    this.session = session;
    void this.session; // recognized for future graceful-shutdown paths
    const r = new Ctor();
    r.lang = 'zh-CN';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event: any) => {
      // The browser groups recognition results into a list; iterate the new
      // entries (those >= event.resultIndex) and emit each one.
      const resultIndex = event.resultIndex ?? 0;
      const results: any[] = event.results ?? [];
      for (let i = resultIndex; i < results.length; i++) {
        const r = results[i];
        const alt = r?.[0];
        if (!alt) continue;
        const chunk = {
          text: alt.transcript ?? '',
          isFinal: !!r.isFinal,
          confidence: typeof alt.confidence === 'number' ? alt.confidence : undefined,
          speaker: 'unknown' as const,
          timestamp: Date.now(),
        };
        session.onChunk(chunk);
      }
    };
    r.onerror = (event: any) => {
      session.onError?.({
        code: event?.error ?? 'error',
        message: event?.message ?? 'Web Speech 识别出错',
      });
    };
    r.onstart = () => session.onStateChange?.('listening');
    r.onend = () => session.onStateChange?.('idle');
    try {
      r.start();
      session.onStateChange?.('starting');
      this.recognition = r;
    } catch (e) {
      session.onError?.({
        code: 'start-failed',
        message: (e instanceof Error ? e.message : String(e)) ?? '启动识别失败',
      });
      session.onStateChange?.('error');
    }
  }

  async stop(): Promise<void> {
    const r = this.recognition;
    this.recognition = null;
    this.session = null;
    if (!r) return;
    try {
      r.abort();
    } catch {
      // ignore — the browser may have already cleaned up the recognizer
    }
  }
}
