// V141: Reveal (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  Reveal,
  RevealList,
  useReveal,
  revealDirectionClass,
  revealVisibleClass,
  revealHiddenClass,
  revealDelayMs,
  buildRevealStyle,
  type RevealDirection,
  type RevealDelay,
  type RevealOptions,
} from '../src/components/reveal/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Pure helpers ----------
describe('V141 revealDirectionClass', () => {
  it('up = translate-y-4', () => {
    expect(revealDirectionClass('up')).toBe('translate-y-4');
  });
  it('down = -translate-y-4', () => {
    expect(revealDirectionClass('down')).toBe('-translate-y-4');
  });
  it('left = translate-x-4', () => {
    expect(revealDirectionClass('left')).toBe('translate-x-4');
  });
  it('right = -translate-x-4', () => {
    expect(revealDirectionClass('right')).toBe('-translate-x-4');
  });
  it('fade = neutral translate', () => {
    expect(revealDirectionClass('fade')).toBe('translate-x-0 translate-y-0');
  });
});

describe('V141 revealVisibleClass / revealHiddenClass', () => {
  it('visible class has translate-x-0 and opacity-100', () => {
    expect(revealVisibleClass()).toContain('translate-x-0');
    expect(revealVisibleClass()).toContain('opacity-100');
  });
  it('hidden class wraps direction + opacity-0', () => {
    expect(revealHiddenClass('up')).toContain('opacity-0');
    expect(revealHiddenClass('up')).toContain('translate-y-4');
  });
});

describe('V141 revealDelayMs', () => {
  it('returns 0 for none', () => {
    expect(revealDelayMs('none')).toBe(0);
  });
  it('returns positive ms for short/medium/long', () => {
    expect(revealDelayMs('short')).toBeGreaterThan(0);
    expect(revealDelayMs('medium')).toBeGreaterThan(0);
    expect(revealDelayMs('long')).toBeGreaterThan(0);
  });
});

describe('V141 buildRevealStyle', () => {
  it('returns duration + delay', () => {
    const s = buildRevealStyle({ delay: 'medium', duration: 800 });
    expect(s.transitionDuration).toBe('800ms');
    expect(s.transitionDelay).toBe('200ms');
  });

  it('uses defaults when no options', () => {
    const s = buildRevealStyle();
    expect(s.transitionDuration).toMatch(/^\d+ms$/);
    expect(s.transitionDelay).toBe('0ms');
  });
});

// ---------- useReveal hook ----------
describe('V141 useReveal', () => {
  it('returns ref + visible=true on mount trigger', () => {
    function Probe() {
      const { ref, visible } = useReveal({ trigger: 'mount' });
      return <div ref={ref} data-testid="probe">{String(visible)}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('true');
  });

  it('forceReveal callback exposes API', () => {
    function Probe() {
      const { ref, visible, forceReveal } = useReveal({ trigger: 'mount' });
      return (
        <div ref={ref} data-testid="probe">
          <span data-testid="flag">{String(visible)}</span>
          <button data-testid="force" onClick={forceReveal}>force</button>
        </div>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId('flag').textContent).toBe('true');
    fireEvent.click(screen.getByTestId('force'));
    expect(screen.getByTestId('flag').textContent).toBe('true');
  });

  it('initial state is visible=false on visible trigger', () => {
    function Probe() {
      const { ref, visible } = useReveal();
      return <div ref={ref} data-testid="probe">{String(visible)}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('false');
  });
});

// ---------- Reveal component ----------
describe('V141 Reveal component', () => {
  it('renders with default testId + data-reveal', () => {
    render(<Reveal trigger="mount">Hello</Reveal>);
    const el = screen.getByTestId('reveal');
    expect(el.getAttribute('data-reveal')).toBe('visible');
    expect(el.textContent).toBe('Hello');
  });

  it('uses custom testId', () => {
    render(<Reveal testId="custom-reveal" trigger="mount">x</Reveal>);
    expect(screen.getByTestId('custom-reveal')).toBeTruthy();
  });

  it('renders with as="section" using section element', () => {
    const { container } = render(<Reveal as="section" trigger="mount">x</Reveal>);
    expect(container.querySelector('section')).toBeTruthy();
  });

  it('uses custom delay in transitionDelay style', () => {
    render(<Reveal delay="long" trigger="mount">x</Reveal>);
    const el = screen.getByTestId('reveal');
    expect(el.style.transitionDelay).toBe('400ms');
  });

  it('hides initially on visible trigger', () => {
    render(<Reveal>hidden</Reveal>);
    expect(screen.getByTestId('reveal').getAttribute('data-reveal')).toBe('hidden');
  });

  it('becomes visible when IntersectionObserver fires', () => {
    let observerCallback: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
    class MockIO {
      constructor(public cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-ignore
    globalThis.IntersectionObserver = MockIO;

    render(<Reveal>x</Reveal>);
    expect(screen.getByTestId('reveal').getAttribute('data-reveal')).toBe('hidden');
    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });
    expect(screen.getByTestId('reveal').getAttribute('data-reveal')).toBe('visible');
  });
});

// ---------- RevealList ----------
describe('V141 RevealList', () => {
  it('renders N items', () => {
    render(
      <RevealList
        count={3}
        renderItem={(i) => <div data-testid={`item-${i}`}>Item {i}</div>}
      />
    );
    expect(screen.getByTestId('item-0')).toBeTruthy();
    expect(screen.getByTestId('item-1')).toBeTruthy();
    expect(screen.getByTestId('item-2')).toBeTruthy();
  });

  it('renders RevealList wrapper with data-testid', () => {
    render(<RevealList count={2} renderItem={(i) => <span>{i}</span>} />);
    expect(screen.getByTestId('reveal-list')).toBeTruthy();
  });
});

// ---------- Types ----------
describe('V141 types', () => {
  it('RevealDirection accepts 5 values', () => {
    const dirs: RevealDirection[] = ['up', 'down', 'left', 'right', 'fade'];
    expect(dirs.length).toBe(5);
  });
  it('RevealDelay accepts 4 values', () => {
    const delays: RevealDelay[] = ['none', 'short', 'medium', 'long'];
    expect(delays.length).toBe(4);
  });
  it('RevealOptions defaults', () => {
    const opts: RevealOptions = {};
    expect(opts.direction ?? 'up').toBe('up');
  });
});