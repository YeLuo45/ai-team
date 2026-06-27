// V118: Mobile utilities — viewport detection + matchMedia abstraction

import { useEffect, useState } from 'react';

const MOBILE_MAX_WIDTH = 768;
const TABLET_MAX_WIDTH = 1024;

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

let _isMobileViewportOverride: boolean | null = null;

export function setMobileViewportForTest(mobile: boolean | null): void {
  _isMobileViewportOverride = mobile;
}

export function isMobileViewport(): boolean {
  if (_isMobileViewportOverride !== null) return _isMobileViewportOverride;
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

export function isTabletViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(min-width: ${MOBILE_MAX_WIDTH + 1}px) and (max-width: ${TABLET_MAX_WIDTH}px)`).matches;
}

export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(min-width: ${TABLET_MAX_WIDTH + 1}px)`).matches;
}

export function useViewportBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => computeBreakpoint());
  useEffect(() => {
    function update() {
      setBp(computeBreakpoint());
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq1 = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
      const mq2 = window.matchMedia(`(min-width: ${MOBILE_MAX_WIDTH + 1}px) and (max-width: ${TABLET_MAX_WIDTH}px)`);
      mq1.addEventListener('change', update);
      mq2.addEventListener('change', update);
      return () => {
        mq1.removeEventListener('change', update);
        mq2.removeEventListener('change', update);
      };
    }
    return undefined;
  }, []);
  return bp;
}

function computeBreakpoint(): Breakpoint {
  if (isMobileViewport()) return 'sm';
  if (isTabletViewport()) return 'md';
  if (typeof window !== 'undefined' && window.innerWidth >= 1280) return 'xl';
  return 'lg';
}