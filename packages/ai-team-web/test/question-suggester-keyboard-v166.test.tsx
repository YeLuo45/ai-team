// V166: RealtimeQuestionSuggester keyboard shortcuts (j / k / 0).
//
// Three surfaces:
//   1. `j` advances historyIndex into adoptionHistory (newer = bigger n).
//   2. `k` rewinds historyIndex.
//   3. `0` resets to the live suggestion.
//   4. Shortcuts are ignored while focus is inside INPUT/TEXTAREA/contenteditable,
//      and when modifier keys are held.
//   5. History banner shows the current position.
//   6. Adopting a historical suggestion also resets to live.
//   7. disableKeyboardShortcuts=true toggles the listener off.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef } from 'react';
import { RealtimeQuestionSuggester } from '../src/components/interview/RealtimeQuestionSuggester';
import type {
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from '../src/lib/question-suggestion/index';
import type { AdoptedSuggestion } from '../src/lib/question-suggestion/history';
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

/** Agent that resolves to a deterministic suggestion. */
class StubAgent implements QuestionSuggestionAgent {
  readonly id = 'stub';
  readonly label = 'Stub';
  readonly remote = false;
  nextSuggestion: QuestionSuggestion;

  constructor() {
    this.nextSuggestion = {
      id: 'live-1',
      question: '你最近一个项目里最大的技术挑战是什么？',
      rationale: '探查系统设计与权衡',
      focusTag: 'technical',
      difficulty: 'medium',
      followUpHints: ['追问你权衡了什么'],
      generatedAt: NOW,
    };
  }

  async suggest(_input: QuestionSuggestionInput): Promise<QuestionSuggestion> {
    return this.nextSuggestion;
  }
}

function makeAdoption(over: Partial<AdoptedSuggestion> = {}): AdoptedSuggestion {
  return {
    suggestionId: 'sg_v166',
    question: '默认值',
    rationale: '默认 rationale',
    focusTag: 'communication',
    difficulty: 'easy',
    adoptedAt: NOW,
    sessionId: 'ct_alice',
    candidateName: 'Alice',
    position: 'Senior Frontend',
    ...over,
  };
}

/** Wrap the component so we can clear/set local input focus in tests. */
function Harness({ agent, adoptionHistory, disableShortcuts }: {
  agent: QuestionSuggestionAgent;
  adoptionHistory?: ReadonlyArray<AdoptedSuggestion>;
  disableShortcuts?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <input ref={ref} data-testid="decoy-input" placeholder="typing here" />
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="ct_alice"
        position="Senior Frontend"
        candidateName="Alice"
        transcript={[]}
        adoptionHistory={adoptionHistory}
        disableKeyboardShortcuts={disableShortcuts}
      />
    </div>
  );
}

async function mount(jsx: React.ReactNode) {
  const out = render(<>{jsx}</>);
  // Drain pending microtasks so the mount-time effect's `void trigger()`
  // can resolve + set the suggestion. Without this, waitFor() times out.
  await act(async () => {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });
  return out;
}

function press(key: string, opts: { target?: HTMLElement | Document; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}) {
  return act(() => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ctrlKey: !!opts.ctrlKey,
      metaKey: !!opts.metaKey,
      altKey: !!opts.altKey,
    });
    (opts.target ?? document.body).dispatchEvent(event);
  });
}

describe('V166 keyboard shortcuts', () => {
  it('starts at historyIndex=0 and shows the live suggestion', async () => {
    const agent = new StubAgent();
    const out = await mount(<Harness agent={agent} adoptionHistory={[makeAdoption({ suggestionId: 'h1' })]} />);
    // Debug snapshot — paste into console to inspect.
    if (process.env['DEBUG_V166']) {
      // eslint-disable-next-line no-console
      console.log('DEBUG container FULL:', out.container.outerHTML);
    }

    // After drain, the mount-time useEffect has resolved and the panel
    // shows the live suggestion. Expect synchronously (waitFor + fakeTimers
    // doesn't retry its internal scheduler).
    expect(out.container.querySelector('[data-testid="rqs-question"]')?.textContent).toContain('最大的技术挑战');
    expect(out.container.querySelector('[data-testid="rqs-history-banner"]')).toBeNull();
  });

  it('pressing `j` advances into the adoption history', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const h2 = makeAdoption({ suggestionId: 'h2', question: '历史 Q2' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1, h2]} />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }
    expect(q('rqs-question')?.textContent).toContain('最大的技术挑战');

    press('j');
    expect(q('rqs-history-banner')?.textContent).toContain('1/2');
    expect(q('rqs-question')?.textContent).toContain('历史 Q1');

    press('j');
    expect(q('rqs-history-banner')?.textContent).toContain('2/2');
    expect(q('rqs-question')?.textContent).toContain('历史 Q2');

    // cap at adoptionHistory.length
    press('j');
    expect(q('rqs-history-banner')?.textContent).toContain('2/2');
  });

  it('pressing `k` rewinds toward live', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1]} />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }

    // Advance: n=0 -> n=1 (banner at 1/1)
    press('j');
    expect(q('rqs-history-banner')?.textContent).toContain('1/1');

    // Rewind: n=1 -> n=0 (banner gone, live restored)
    press('k');
    expect(q('rqs-history-banner')).toBeNull();
    expect(q('rqs-question')?.textContent).toContain('最大的技术挑战');
  });

  it('pressing `0` resets to live regardless of current index', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1]} />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }

    press('j');
    expect(q('rqs-history-banner')).toBeTruthy();
    press('0');
    expect(q('rqs-history-banner')).toBeNull();
    expect(q('rqs-question')?.textContent).toContain('最大的技术挑战');
  });

  it('ignores keys when focus is inside an input', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1]} />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }

    const decoy = screen.getByTestId('decoy-input');
    decoy.focus();
    press('j', { target: decoy });
    expect(q('rqs-history-banner')).toBeNull();
    expect(q('rqs-question')?.textContent).toContain('最大的技术挑战');
  });

  it('ignores keys when modifier keys are held', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1]} />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }

    press('j', { ctrlKey: true });
    press('j', { metaKey: true });
    press('j', { altKey: true });
    expect(q('rqs-history-banner')).toBeNull();
  });

  it('disableKeyboardShortcuts=true makes the listener a no-op', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1]} disableShortcuts />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }

    press('j');
    press('j');
    expect(q('rqs-history-banner')).toBeNull();
    expect(q('rqs-question')?.textContent).toContain('最大的技术挑战');
  });

  it('adopting a historical suggestion also resets the panel to live', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1]} />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }

    press('j');
    expect(q('rqs-history-banner')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTestId('rqs-adopt'));
      // adopt awaits navigator.clipboard.writeText — drain microtasks so
      // the post-await setHistoryIndex(0) lands in the DOM.
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(q('rqs-history-banner')).toBeNull();
    expect(q('rqs-question')?.textContent).toContain('最大的技术挑战');
  });

  it('history banner references the `0` key for the latest prompt', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(<Harness agent={agent} adoptionHistory={[h1]} />);

    function q(s: string) { return container.querySelector(`[data-testid="${s}"]`); }

    press('j');
    const banner = q('rqs-history-banner');
    expect(banner?.textContent).toContain('0');
  });
});
