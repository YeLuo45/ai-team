// V168: KeyboardShortcutHint + RealtimeQuestionSuggester cheat-sheet integration.
// Two surfaces:
//   1. KeyboardShortcutHint popover toggle + outside-click + Escape + ARIA
//   2. RealtimeQuestionSuggester with showKeyboardHint=true (default) renders
//      the hint and wires its shortcuts to j/k/0.

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { KeyboardShortcutHint } from '../src/components/interview/KeyboardShortcutHint';
import { RealtimeQuestionSuggester } from '../src/components/interview/RealtimeQuestionSuggester';
import type {
  QuestionSuggestion,
  QuestionSuggestionAgent,
  QuestionSuggestionInput,
} from '../src/lib/question-suggestion/index';
import type { AdoptedSuggestion } from '../src/lib/question-suggestion/history';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

function q(container: HTMLElement, sel: string) {
  return container.querySelector(sel);
}

// =====================================================================
// 1. KeyboardShortcutHint popover
// =====================================================================

describe('KeyboardShortcutHint', () => {
  it('renders the toggle button with aria-haspopup=dialog and aria-expanded=false initially', () => {
    const { container } = render(
      <KeyboardShortcutHint shortcuts={[{ key: 'j', label: 'Next' }]} testId="ksh" />,
    );
    const toggle = q(container, '[data-testid="ksh-toggle"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-haspopup')).toBe('dialog');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(q(container, '[data-testid="ksh-popover"]')).toBeNull();
  });

  it('clicking the toggle opens the popover and lists the shortcuts', () => {
    const { container } = render(
      <KeyboardShortcutHint
        shortcuts={[
          { key: 'j', label: '下一条历史建议' },
          { key: 'k', label: '上一条历史建议' },
          { key: '0', label: '回到最新生成' },
        ]}
        testId="ksh"
      />,
    );
    fireEvent.click(q(container, '[data-testid="ksh-toggle"]') as HTMLButtonElement);

    const popover = q(container, '[data-testid="ksh-popover"]') as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.getAttribute('role')).toBe('dialog');
    expect(q(container, '[data-testid="ksh-title"]')?.textContent).toBe('键盘快捷键');

    const rows = popover.querySelectorAll('[data-testid="ksh-row"]');
    expect(rows.length).toBe(3);
    expect(rows[0]?.getAttribute('data-shortcut-key')).toBe('j');
    expect(rows[0]?.textContent).toContain('下一条历史建议');
    expect(rows[0]?.querySelector('[data-testid="ksh-kbd"]')?.textContent).toBe('j');

    const toggle = q(container, '[data-testid="ksh-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking the toggle a second time closes the popover', () => {
    const { container } = render(
      <KeyboardShortcutHint shortcuts={[{ key: 'x', label: 'X' }]} testId="ksh" />,
    );
    const toggle = q(container, '[data-testid="ksh-toggle"]') as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(q(container, '[data-testid="ksh-popover"]')).toBeTruthy();
    fireEvent.click(toggle);
    expect(q(container, '[data-testid="ksh-popover"]')).toBeNull();
  });

  it('clicking outside the hint closes the popover', () => {
    const { container } = render(
      <div>
        <button data-testid="outside">far away</button>
        <KeyboardShortcutHint shortcuts={[{ key: 'j', label: 'J' }]} testId="ksh" />
      </div>,
    );
    fireEvent.click(q(container, '[data-testid="ksh-toggle"]') as HTMLButtonElement);
    expect(q(container, '[data-testid="ksh-popover"]')).toBeTruthy();

    // mousedown on outside triggers our outside-click listener.
    fireEvent.mouseDown(q(container, '[data-testid="outside"]') as HTMLElement);
    expect(q(container, '[data-testid="ksh-popover"]')).toBeNull();
  });

  it('Escape closes the popover', () => {
    const { container } = render(
      <KeyboardShortcutHint shortcuts={[{ key: 'j', label: 'J' }]} testId="ksh" />,
    );
    fireEvent.click(q(container, '[data-testid="ksh-toggle"]') as HTMLButtonElement);
    expect(q(container, '[data-testid="ksh-popover"]')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(q(container, '[data-testid="ksh-popover"]')).toBeNull();
  });

  it('renders nothing when shortcuts is empty (no-op)', () => {
    const { container } = render(
      <KeyboardShortcutHint shortcuts={[]} testId="ksh" />,
    );
    expect(q(container, '[data-testid="ksh"]')).toBeNull();
  });

  it('uses a custom icon when supplied', () => {
    const { container } = render(
      <KeyboardShortcutHint
        shortcuts={[{ key: '?', label: '?' }]}
        icon="?"
        testId="ksh"
      />,
    );
    expect(q(container, '[data-testid="ksh-toggle"]')?.textContent).toContain('?');
  });
});

// =====================================================================
// 2. RealtimeQuestionSuggester integration
// =====================================================================

const NOW = new Date('2026-07-04T10:00:00.000Z').getTime();

class StubAgent implements QuestionSuggestionAgent {
  readonly id = 'stub';
  readonly label = 'Stub';
  readonly remote = false;
  nextSuggestion: QuestionSuggestion;

  constructor() {
    this.nextSuggestion = {
      id: 'live-1',
      question: '你最近一个项目里最大的技术挑战是什么？',
      rationale: '探查系统设计',
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
    suggestionId: 'sg_v168',
    question: '历史 Q',
    rationale: '历史 rationale',
    difficulty: 'easy',
    adoptedAt: NOW,
    sessionId: 'ct_alice',
    candidateName: 'Alice',
    position: 'Senior Frontend',
    ...over,
  };
}

function Harness({ agent, adoptionHistory, showKeyboardHint = true }: {
  agent: QuestionSuggestionAgent;
  adoptionHistory?: ReadonlyArray<AdoptedSuggestion>;
  showKeyboardHint?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <input ref={ref} data-testid="decoy-input" />
      <RealtimeQuestionSuggester
        agent={agent}
        sessionId="ct_alice"
        position="Senior Frontend"
        candidateName="Alice"
        transcript={[]}
        adoptionHistory={adoptionHistory}
        showKeyboardHint={showKeyboardHint}
      />
    </div>
  );
}

async function mount(jsx: React.ReactNode) {
  const out = render(<>{jsx}</>);
  await act(async () => {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });
  return out;
}

describe('RealtimeQuestionSuggester + keyboard hint', () => {
  it('shows the hint icon by default', async () => {
    const { container } = await mount(<Harness agent={new StubAgent()} />);
    expect(q(container, '[data-testid="rqs-help-toggle"]')).toBeTruthy();
  });

  it('hides the hint icon when showKeyboardHint=false', async () => {
    const { container } = await mount(
      <Harness agent={new StubAgent()} showKeyboardHint={false} />,
    );
    expect(q(container, '[data-testid="rqs-help-toggle"]')).toBeNull();
  });

  it('popover lists the three shortcuts after a click', async () => {
    const { container } = await mount(<Harness agent={new StubAgent()} />);
    fireEvent.click(q(container, '[data-testid="rqs-help-toggle"]') as HTMLButtonElement);
    const popover = q(container, '[data-testid="rqs-help-popover"]');
    expect(popover).toBeTruthy();
    expect(popover?.querySelectorAll('[data-testid="rqs-help-row"]').length).toBe(3);
    expect(popover?.textContent).toContain('下一条历史建议');
    expect(popover?.textContent).toContain('上一条历史建议');
    expect(popover?.textContent).toContain('回到最新生成');
  });

  it('the hint toggle does not steal focus (j/k/0 still work after a click)', async () => {
    const agent = new StubAgent();
    const h1 = makeAdoption({ suggestionId: 'h1', question: '历史 Q1' });
    const { container } = await mount(
      <Harness agent={agent} adoptionHistory={[h1]} />,
    );

    // Open the cheat sheet.
    fireEvent.click(q(container, '[data-testid="rqs-help-toggle"]') as HTMLButtonElement);
    expect(q(container, '[data-testid="rqs-help-popover"]')).toBeTruthy();

    // Close it again by clicking outside so j/k/0 fire on document.body.
    fireEvent.mouseDown(container.querySelector('[data-testid="decoy-input"]') as HTMLElement);
    // ... the outside-click handler ignores clicks inside the hint. Re-click outside.
    document.body.click();

    // Now a `j` press should switch into history.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    });
    expect(q(container, '[data-testid="rqs-history-banner"]')).toBeTruthy();
  });
});
