// V119: OnboardingTour React component

import { useCallback, useEffect, useState } from 'react';
import { Button } from '../design-system/primitives.js';
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
  advanceOnboarding,
  getOnboardingStep,
  getStepByIndex,
  isOnboardingComplete,
  isStepAccessible,
  resetOnboarding,
  setOnboardingStep,
  skipOnboarding,
} from './persistence.js';

export interface OnboardingState {
  step: number;
  advance: () => void;
  reset: () => void;
  skip: () => void;
  goto: (i: number) => void;
  isComplete: boolean;
  totalSteps: number;
}

export function useOnboarding(): OnboardingState {
  const [step, setStep] = useState<number>(() => getOnboardingStep());
  const [isComplete, setIsComplete] = useState<boolean>(() => isOnboardingComplete());

  const advance = useCallback(() => {
    advanceOnboarding();
    setStep(getOnboardingStep());
  }, []);

  const reset = useCallback(() => {
    resetOnboarding();
    setStep(0);
    setIsComplete(false);
  }, []);

  const skip = useCallback(() => {
    skipOnboarding();
    setIsComplete(true);
    setStep(ONBOARDING_TOTAL_STEPS - 1);
  }, []);

  const goto = useCallback((i: number) => {
    if (!isStepAccessible(i)) return;
    setOnboardingStep(i);
    setStep(i);
  }, []);

  return {
    step,
    advance,
    reset,
    skip,
    goto,
    isComplete,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };
}

export function useTourStep() {
  const { step } = useOnboarding();
  return getStepByIndex(step);
}

export function OnboardingTour() {
  const { step, advance, skip, totalSteps, isComplete } = useOnboarding();

  useEffect(() => {
    // Listen for external reset events (e.g. from settings page)
    function onReset() {
      // refresh — useOnboarding already reads on mount
    }
    window.addEventListener('ai-team-onboarding-reset', onReset);
    return () => window.removeEventListener('ai-team-onboarding-reset', onReset);
  }, []);

  if (isComplete) return null;

  const current = getStepByIndex(step);
  const progressValue = step + 1;

  return (
    <div
      data-testid="onboarding-tour"
      role="dialog"
      aria-label="新手引导"
      className="fixed bottom-20 left-1/2 z-50 w-[28rem] max-w-[90vw] -translate-x-1/2 rounded-xl border border-brand-200 bg-white p-5 shadow-2xl dark:border-brand-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{current.icon}</span>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {current.title}
          </h2>
        </div>
        <span className="text-xs text-slate-500">{progressValue} / {totalSteps}</span>
      </div>

      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {current.description}
      </p>

      {current.action && (
        <div className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
          💡 提示：{current.action}
        </div>
      )}

      <div
        data-testid="onboarding-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuenow={progressValue}
        aria-valuemax={totalSteps}
        className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${(progressValue / totalSteps) * 100}%` }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          data-testid="onboarding-skip"
          onClick={skip}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          跳过引导
        </button>
        <Button size="sm" onClick={advance} testId="onboarding-next">
          {progressValue < totalSteps ? '下一步' : '完成'}
        </Button>
      </div>
    </div>
  );
}