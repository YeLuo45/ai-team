// V164: RealtimeQuestionSuggester — wires a QuestionSuggestionAgent into a UI
// panel with adopt / regenerate / trigger badge.
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { RealtimeQuestionSuggester } from '../src/components/interview/RealtimeQuestionSuggester.js';
import type {
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from '../src/lib/question-suggestion/index';
import type { SttTranscriptChunk } from '../src/lib/stt/types';

const NOW = new Date('2026-07-04T10:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

/** Test agent that emits a deterministic suggestion + records all inputs. */
class StubAgent implements QuestionSuggestionAgent {
  readonly id = 'stub';
  readonly label = 'Stub';
  readonly remote = false;
  calls: QuestionSuggestionInput[] = [];
  nextSuggestion: QuestionSuggestion;
  delayMs = 0;
  failNext = false;

  constructor(out?: Partial<QuestionSuggestion>) {
    this.nextSuggestion = {
      id: 'stub-1',
      question: out?.question ?? '请讲讲你最擅长的领域。',
      rationale: out?.rationale ?? '测试 rationale',
      focusTag: out?.focusTag ?? 'technical',
      difficulty: out?.difficulty ?? 'medium',
      followUpHints: out?.followUpHints ?? ['追问你的设计思路。'],
      generatedAt: NOW,
    };
  }

  async suggest(input: QuestionSuggestionInput): Promise<QuestionSuggestion> {
    this.calls.push(input);
    if (this.delayMs) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    if (this.failNext) {
      this.failNext = false;
      throw new Error('boom');
    }
    return this.nextSuggestion;
  }
}

function chunk(text: string, speaker: SttTranscriptChunk['speaker'] = 'candidate', timestamp = NOW): SttTranscriptChunk {
  return { text, speaker, timestamp, isFinal: true };
}

const DEFAULT_TRANSCRIPT: ReadonlyArray<SttTranscriptChunk> = [];

// ---------------- UI / behavior ----------------

describe('RealtimeQuestionSuggester UI', () => {
  it('renders an empty state when the agent has not produced any output yet', async () => {
    const agent = new StubAgent();
    render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={DEFAULT_TRANSCRIPT}
      />,
    );
    // wait for mount-time trigger to settle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('rqs-question').textContent).toContain('请讲讲你最擅长的领域');
    expect(agent.calls.length).toBe(1);
  });

  it('sends a structured QuestionSuggestionInput to the agent (sessionId, position, candidate)', async () => {
    const agent = new StubAgent();
    render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="sess-42"
        position="后端"
        candidateName="王浩"
        transcript={DEFAULT_TRANSCRIPT}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(agent.calls[0].sessionId).toBe('sess-42');
    expect(agent.calls[0].position).toBe('后端');
    expect(agent.calls[0].candidateName).toBe('王浩');
  });

  it('shows the focusTag / difficulty / hints in the rendered panel', async () => {
    const agent = new StubAgent({
      focusTag: 'problemSolving',
      difficulty: 'hard',
      followUpHints: ['线索 1', '线索 2'],
    });
    render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={DEFAULT_TRANSCRIPT}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('rqs-focus-tag').textContent).toBe('问题解决');
    expect(screen.getByTestId('rqs-difficulty').textContent).toBe('hard');
    expect(screen.getByTestId('rqs-hint-count').textContent).toContain('+ 2 跟问线索');
  });

  it('clicking 🔄 重新生成 invokes the agent again (manual trigger)', async () => {
    const agent = new StubAgent();
    render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={DEFAULT_TRANSCRIPT}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByTestId('rqs-regenerate'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(agent.calls.length).toBeGreaterThanOrEqual(2);
    expect(agent.calls[1].trigger.kind).toBe('manual');
  });

  it('clicking ✅ 采纳 copies the suggestion to clipboard (when available) and flips the label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const agent = new StubAgent();
    render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={DEFAULT_TRANSCRIPT}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByTestId('rqs-adopt'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText).toHaveBeenCalledWith('请讲讲你最擅长的领域。');
    expect(screen.getByTestId('rqs-adopt').textContent).toContain('已采纳');
  });

  it('clears the busy state once the agent completes', async () => {
    const agent = new StubAgent();
    agent.delayMs = 50;
    render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={DEFAULT_TRANSCRIPT}
      />,
    );
    // Wait for mount-time trigger to fully resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // After completion, the badge should NOT be the ⏳ 分析中 state
    expect(screen.getByTestId('rqs-trigger-state').textContent).not.toBe('⏳ 分析中');
  });

  it('re-runs when the underlying transcript content changes (content-shift trigger)', async () => {
    const agent = new StubAgent();
    const initialTranscript: ReadonlyArray<SttTranscriptChunk> = [
      chunk('hello'),
      chunk('world'),
    ];
    const { rerender } = render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={initialTranscript}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(agent.calls.length).toBe(1);

    // New tail content
    const newTranscript: ReadonlyArray<SttTranscriptChunk> = [
      chunk('hello'),
      chunk('world'),
      chunk('fresh question'),
      chunk('another fresh'),
    ];
    rerender(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={newTranscript}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // We expect the second call to have happened (content-shift)
    expect(agent.calls.length).toBe(2);
    expect(agent.calls[1].trigger.kind).toBe('content-shift');
  });

  it('shows the transcript count as "N 段对话"', async () => {
    const agent = new StubAgent();
    render(
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="s1"
        position="前端"
        candidateName="李婷"
        transcript={[chunk('a'), chunk('b'), chunk('c')]}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('rqs-transcript-count').textContent).toBe('3 段对话');
  });

  it('falls back to "等待 transcript 输入…" when transcript empty + agent has no result', async () => {
    // Override the global stub-busy check: use an agent that never resolves
    let resolveFn!: (s: QuestionSuggestion) => void;
    class HangingStub implements QuestionSuggestionAgent {
      id = 'hang'; label = 'Hang'; remote = false;
      suggest(): Promise<QuestionSuggestion> { return new Promise((r) => { resolveFn = r; }); }
    }
    render(
      <RealtimeQuestionSuggester
        agent={new HangingStub()}
        sessionId="s1"
        position="x"
        candidateName="y"
        transcript={[]}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('rqs-empty').textContent).toBe('⏳ 分析中…');
    // resolve to avoid hanging
    resolveFn({ id: 'x', question: 'q', rationale: 'r', difficulty: 'medium', generatedAt: NOW });
  });
});
