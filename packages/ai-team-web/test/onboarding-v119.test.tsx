// V119: OnboardingTour + EmptyState helpers (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  OnboardingTour,
  useOnboarding,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_TOTAL_STEPS,
  isOnboardingComplete,
  setOnboardingComplete,
  resetOnboarding,
  getOnboardingStep,
  setOnboardingStep,
  advanceOnboarding,
  skipOnboarding,
  ONBOARDING_STEPS,
  useTourStep,
  isStepAccessible,
  getStepByIndex,
  normalizeEmptyState,
  hasEmptyState,
} from '../src/components/onboarding/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Onboarding persistence ----------
describe('V119 onboarding persistence', () => {
  it('ONBOARDING_STORAGE_KEY is ai-team-onboarded', () => {
    expect(ONBOARDING_STORAGE_KEY).toBe('ai-team-onboarded');
  });

  it('isOnboardingComplete returns false initially', () => {
    expect(isOnboardingComplete()).toBe(false);
  });

  it('setOnboardingComplete persists to localStorage', () => {
    setOnboardingComplete();
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('1');
    expect(isOnboardingComplete()).toBe(true);
  });

  it('resetOnboarding clears the flag', () => {
    setOnboardingComplete();
    resetOnboarding();
    expect(isOnboardingComplete()).toBe(false);
  });

  it('getOnboardingStep returns 0 initially', () => {
    expect(getOnboardingStep()).toBe(0);
  });

  it('setOnboardingStep persists step index', () => {
    setOnboardingStep(2);
    expect(getOnboardingStep()).toBe(2);
  });

  it('setOnboardingStep clamps to [0, total]', () => {
    setOnboardingStep(-1);
    expect(getOnboardingStep()).toBe(0);
    setOnboardingStep(999);
    expect(getOnboardingStep()).toBe(ONBOARDING_TOTAL_STEPS - 1);
  });

  it('advanceOnboarding increments step', () => {
    advanceOnboarding();
    expect(getOnboardingStep()).toBe(1);
    advanceOnboarding();
    expect(getOnboardingStep()).toBe(2);
  });

  it('skipOnboarding marks complete + jumps to end', () => {
    skipOnboarding();
    expect(isOnboardingComplete()).toBe(true);
  });
});

// ---------- ONBOARDING_STEPS ----------
describe('V119 ONBOARDING_STEPS', () => {
  it('ONBOARDING_TOTAL_STEPS matches ONBOARDING_STEPS length', () => {
    expect(ONBOARDING_TOTAL_STEPS).toBe(ONBOARDING_STEPS.length);
  });

  it('has 3 steps (candidate / interview / pipeline)', () => {
    expect(ONBOARDING_TOTAL_STEPS).toBeGreaterThanOrEqual(3);
    expect(ONBOARDING_STEPS[0].title).toContain('候选');
    expect(ONBOARDING_STEPS[1].title).toContain('面试');
    expect(ONBOARDING_STEPS[2].title).toContain('Pipeline');
  });

  it('every step has title + description + targetPath', () => {
    for (const s of ONBOARDING_STEPS) {
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.targetPath).toMatch(/^\//);
    }
  });
});

// ---------- isStepAccessible + getStepByIndex ----------
describe('V119 step utilities', () => {
  it('isStepAccessible returns true for in-range index', () => {
    expect(isStepAccessible(0)).toBe(true);
    expect(isStepAccessible(ONBOARDING_TOTAL_STEPS - 1)).toBe(true);
  });

  it('isStepAccessible returns false for out-of-range', () => {
    expect(isStepAccessible(-1)).toBe(false);
    expect(isStepAccessible(ONBOARDING_TOTAL_STEPS)).toBe(false);
  });

  it('getStepByIndex clamps out-of-range', () => {
    const out = getStepByIndex(999);
    expect(out.title).toBe(ONBOARDING_STEPS[ONBOARDING_TOTAL_STEPS - 1].title);
  });
});

// ---------- useOnboarding ----------
describe('V119 useOnboarding hook', () => {
  it('returns current step + actions', () => {
    function Probe() {
      const o = useOnboarding();
      return (
        <div>
          <span data-testid="step">{o.step}</span>
          <button data-testid="next" onClick={o.advance}>next</button>
          <button data-testid="skip" onClick={o.skip}>skip</button>
          <button data-testid="reset" onClick={o.reset}>reset</button>
        </div>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId('step').textContent).toBe('0');
    fireEvent.click(screen.getByTestId('next'));
    expect(screen.getByTestId('step').textContent).toBe('1');
    fireEvent.click(screen.getByTestId('skip'));
    expect(isOnboardingComplete()).toBe(true);
    fireEvent.click(screen.getByTestId('reset'));
    expect(isOnboardingComplete()).toBe(false);
    expect(screen.getByTestId('step').textContent).toBe('0');
  });
});

// ---------- useTourStep ----------
describe('V119 useTourStep', () => {
  it('returns the current step config', () => {
    function Probe() {
      const s = useTourStep();
      return <div data-testid="title">{s.title}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('title').textContent).toBe(ONBOARDING_STEPS[0].title);
  });
});

// ---------- OnboardingTour component ----------
describe('V119 OnboardingTour component', () => {
  it('renders nothing when onboarding complete', () => {
    setOnboardingComplete();
    render(
      <MemoryRouter>
        <OnboardingTour />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
  });

  it('renders step 1 with title and skip button', () => {
    render(
      <MemoryRouter>
        <OnboardingTour />
      </MemoryRouter>
    );
    expect(screen.getByTestId('onboarding-tour')).toBeTruthy();
    expect(screen.getByText(ONBOARDING_STEPS[0].title)).toBeTruthy();
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();
  });

  it('clicking Next advances to next step', () => {
    render(
      <MemoryRouter>
        <OnboardingTour />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByText(ONBOARDING_STEPS[1].title)).toBeTruthy();
  });

  it('clicking Skip closes tour and marks complete', () => {
    render(
      <MemoryRouter>
        <OnboardingTour />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('onboarding-skip'));
    expect(isOnboardingComplete()).toBe(true);
    expect(screen.queryByTestId('onboarding-tour')).toBeNull();
  });

  it('progress bar shows current step', () => {
    render(
      <MemoryRouter>
        <OnboardingTour />
      </MemoryRouter>
    );
    const progress = screen.getByTestId('onboarding-progress');
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe(String(ONBOARDING_TOTAL_STEPS));
  });
});

// ---------- EmptyState scan helpers ----------
describe('V119 EmptyState scan helpers', () => {
  it('hasEmptyState returns true when empty result provided', () => {
    expect(hasEmptyState({ items: [] })).toBe(true);
    expect(hasEmptyState({ items: null })).toBe(true);
    expect(hasEmptyState({ items: undefined })).toBe(true);
    expect(hasEmptyState({ items: [{ id: 1 }] })).toBe(false);
  });

  it('hasEmptyState handles arrays', () => {
    expect(hasEmptyState([])).toBe(true);
    expect(hasEmptyState([{ id: 1 }])).toBe(false);
  });

  it('normalizeEmptyState returns empty object for null', () => {
    expect(normalizeEmptyState(null)).toEqual({ items: [] });
    expect(normalizeEmptyState(undefined)).toEqual({ items: [] });
  });

  it('normalizeEmptyState keeps existing items', () => {
    expect(normalizeEmptyState({ items: [{ id: 1 }] })).toEqual({ items: [{ id: 1 }] });
  });
});