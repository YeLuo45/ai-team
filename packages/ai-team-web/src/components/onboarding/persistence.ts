// V119: Onboarding persistence + step utilities

export const ONBOARDING_STORAGE_KEY = 'ai-team-onboarded';
export const ONBOARDING_STEP_KEY = 'ai-team-onboarding-step';

export interface OnboardingStep {
  title: string;
  description: string;
  targetPath: string;
  icon: string;
  action?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: '添加第一位候选人',
    description: '从候选人页面录入或上传简历，建立你的招聘池。',
    targetPath: '/candidates',
    icon: '👤',
    action: '+ 添加候选人',
  },
  {
    title: '触发第一次 AI 面试',
    description: '点击候选人卡片上的「开始面试」，AI 会自动多轮对话 + 自动评估。',
    targetPath: '/candidates',
    icon: '🎤',
    action: '🤖 开始面试',
  },
  {
    title: '查看 Pipeline 漏斗',
    description: '面试结束后，候选人自动进入 Pipeline 漏斗，6 阶段转化全程可见。',
    targetPath: '/pipeline',
    icon: '📊',
    action: '查看漏斗',
  },
];

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length;

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function isOnboardingComplete(): boolean {
  return getStorage()?.getItem(ONBOARDING_STORAGE_KEY) === '1';
}

export function setOnboardingComplete(): void {
  getStorage()?.setItem(ONBOARDING_STORAGE_KEY, '1');
  getStorage()?.setItem(ONBOARDING_STEP_KEY, String(ONBOARDING_TOTAL_STEPS - 1));
}

export function resetOnboarding(): void {
  const s = getStorage();
  if (!s) return;
  s.removeItem(ONBOARDING_STORAGE_KEY);
  s.setItem(ONBOARDING_STEP_KEY, '0');
}

export function getOnboardingStep(): number {
  const s = getStorage();
  if (!s) return 0;
  const raw = parseInt(s.getItem(ONBOARDING_STEP_KEY) ?? '0', 10);
  if (Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(raw, ONBOARDING_TOTAL_STEPS - 1));
}

export function setOnboardingStep(step: number): void {
  const s = getStorage();
  if (!s) return;
  const clamped = Math.max(0, Math.min(step, ONBOARDING_TOTAL_STEPS - 1));
  s.setItem(ONBOARDING_STEP_KEY, String(clamped));
}

export function advanceOnboarding(): void {
  setOnboardingStep(getOnboardingStep() + 1);
}

export function skipOnboarding(): void {
  setOnboardingComplete();
}

export function isStepAccessible(index: number): boolean {
  return index >= 0 && index < ONBOARDING_TOTAL_STEPS;
}

export function getStepByIndex(index: number): OnboardingStep {
  const clamped = Math.max(0, Math.min(index, ONBOARDING_TOTAL_STEPS - 1));
  return ONBOARDING_STEPS[clamped]!;
}

// ---------- Empty state helpers ----------
export function hasEmptyState<T>(value: T | null | undefined | { items?: T[] } | T[]): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object' && 'items' in (value as object)) {
    const items = (value as { items?: T[] }).items;
    return items == null || (Array.isArray(items) && items.length === 0);
  }
  return false;
}

export function normalizeEmptyState<T>(value: { items?: T[] } | null | undefined): { items: T[] } {
  if (!value) return { items: [] };
  const items = value.items ?? [];
  return { items };
}