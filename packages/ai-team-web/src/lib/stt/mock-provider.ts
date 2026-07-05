// V161: Mock STT provider. Emits a deterministic transcript stream on a
// timer so the UI can be exercised without a real microphone or remote
// service. Useful for e2e tests, Storybook, and developer workflows where
// the user explicitly opts in to "mock" mode.

import type { SttProvider, SttSession, SttTranscriptChunk } from './types';

const MOCK_SCRIPT: ReadonlyArray<{ text: string; speaker: SttTranscriptChunk['speaker'] }> = [
  { text: '你好，请简单介绍一下自己。', speaker: 'interviewer' },
  { text: '好的，我是李婷，5年前端开发。', speaker: 'candidate' },
  { text: '过去一年你做过最有挑战的项目是什么？', speaker: 'interviewer' },
  { text: '设计一个可扩展的微前端框架，2026 年初交付。', speaker: 'candidate' },
  { text: '它解决了什么实际问题？', speaker: 'interviewer' },
  { text: '让多个团队能独立发布而不互相阻塞。', speaker: 'candidate' },
  { text: '好的，我们继续深入聊聊。', speaker: 'interviewer' },
];

export interface MockSttOptions {
  /** Milliseconds between chunks. Defaults to 1500. */
  intervalMs?: number;
  /** Override the canned script (mostly used by tests). */
  script?: ReadonlyArray<{ text: string; speaker: SttTranscriptChunk['speaker'] }>;
}

export class MockSttProvider implements SttProvider {
  readonly id = 'mock';
  readonly label = 'Mock (本地脚本)';
  readonly local = true;
  readonly supported = true;
  private timer: ReturnType<typeof setInterval> | null = null;
  private session: SttSession | null = null;
  private idx = 0;
  private script: ReadonlyArray<{ text: string; speaker: SttTranscriptChunk['speaker'] }>;
  private intervalMs: number;

  constructor(options: MockSttOptions = {}) {
    this.script = options.script ?? MOCK_SCRIPT;
    this.intervalMs = options.intervalMs ?? 1500;
  }

  language(): string {
    return 'zh-CN';
  }

  async start(session: SttSession): Promise<void> {
    if (this.timer) return;
    this.session = session;
    this.idx = 0;
    session.onStateChange?.('starting');
    this.timer = setInterval(() => {
      if (!this.session) return;
      if (this.idx >= this.script.length) {
        // Loop the script — keeps tests stable.
        this.idx = 0;
      }
      const line = this.script[this.idx++];
      this.session.onChunk({
        text: line.text,
        isFinal: true,
        confidence: 0.99,
        speaker: line.speaker,
        timestamp: Date.now(),
      });
    }, this.intervalMs);
    // Fire the first chunk after one tick
    setTimeout(() => {
      this.session?.onStateChange?.('listening');
    }, 50);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.session?.onStateChange?.('idle');
    this.session = null;
  }
}
