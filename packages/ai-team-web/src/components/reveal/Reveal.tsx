// V141: Reveal 滚动入场 + useReveal hook + IntersectionObserver
// Reference: memory.hunyuan.tencent.com (.reveal IntersectionObserver fade-in)

import { ReactNode, useEffect, useRef, useState } from 'react';

// ---------- Types ----------
export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'fade';
export type RevealDelay = 'none' | 'short' | 'medium' | 'long';
export type RevealTrigger = 'mount' | 'visible';

export interface RevealOptions {
  direction?: RevealDirection;
  delay?: RevealDelay;
  trigger?: RevealTrigger;
  threshold?: number;
  once?: boolean;
  duration?: number;
}

export interface UseRevealOptions extends RevealOptions {
  fallbackDelay?: number;
}

// ---------- Constants ----------
const DELAY_MS: Record<RevealDelay, number> = {
  none: 0,
  short: 100,
  medium: 200,
  long: 400,
};

const DURATION_MS = 600;
const DEFAULT_THRESHOLD = 0.1;

// ---------- Pure helpers ----------
export function revealDirectionClass(direction: RevealDirection): string {
  switch (direction) {
    case 'up':
      return 'translate-y-4';
    case 'down':
      return '-translate-y-4';
    case 'left':
      return 'translate-x-4';
    case 'right':
      return '-translate-x-4';
    case 'fade':
    default:
      return 'translate-x-0 translate-y-0';
  }
}

export function revealVisibleClass(): string {
  return 'translate-x-0 translate-y-0 opacity-100';
}

export function revealHiddenClass(direction: RevealDirection): string {
  const base = revealDirectionClass(direction);
  return `${base} opacity-0`;
}

export function revealDelayMs(delay: RevealDelay): number {
  return DELAY_MS[delay];
}

export function buildRevealStyle(opts: RevealOptions = {}): {
  transitionDuration: string;
  transitionDelay: string;
} {
  const duration = opts.duration ?? DURATION_MS;
  const delay = revealDelayMs(opts.delay ?? 'none');
  return {
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay}ms`,
  };
}

// ---------- useReveal hook ----------
export function useReveal(options: UseRevealOptions = {}): {
  ref: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  forceReveal: () => void;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const fallbackDelay = options.fallbackDelay ?? 0;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const once = options.once ?? true;
  const trigger = options.trigger ?? 'visible';

  const forceReveal = () => setVisible(true);

  useEffect(() => {
    if (trigger === 'mount') {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: just show after a small delay
      const id = setTimeout(() => setVisible(true), fallbackDelay);
      return () => clearTimeout(id);
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once, trigger, fallbackDelay]);

  return { ref, visible, forceReveal };
}

// ---------- Reveal component ----------
export interface RevealProps extends RevealOptions {
  children: ReactNode;
  className?: string;
  testId?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
}

export function Reveal({
  children,
  className = '',
  testId = 'reveal',
  as = 'div',
  direction = 'up',
  delay = 'none',
  trigger = 'visible',
  threshold = DEFAULT_THRESHOLD,
  once = true,
  duration = DURATION_MS,
}: RevealProps) {
  const { ref, visible } = useReveal({ direction, delay, trigger, threshold, once });
  const Tag = as as 'div';
  const style = {
    transitionProperty: 'transform, opacity',
    transitionDuration: `${duration}ms`,
    transitionDelay: `${revealDelayMs(delay)}ms`,
    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  } as const;
  const hidden = revealHiddenClass(direction);
  const shown = revealVisibleClass();
  return (
    <Tag
      ref={ref}
      data-testid={testId}
      data-reveal={visible ? 'visible' : 'hidden'}
      style={style}
      className={`${visible ? shown : hidden} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

// ---------- RevealList: stagger helper ----------
export interface RevealListProps {
  count: number;
  delay?: RevealDelay;
  className?: string;
  renderItem: (index: number) => ReactNode;
}

export function RevealList({ count, delay = 'short', className = '', renderItem }: RevealListProps) {
  return (
    <div data-testid="reveal-list" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Reveal key={i} delay={i === 0 ? delay : delay} testId={`reveal-list-item-${i}`}>
          {renderItem(i)}
        </Reveal>
      ))}
    </div>
  );
}
