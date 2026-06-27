// V127: App-level accessibility hooks — A11yGateProvider + skip-to-main + A11yBadgeSlot + AppAccessibilityRoot

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { A11yAuditBadge, buildA11yConfig, A11yChecker, A11yConfig, A11yViolation, runA11yScanOnDocument, severityRank, summarizeViolations, ViolationSummary } from './a11y-checker.js';

// ---------- A11yGateConfig / A11yGateResult ----------
export type GateSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface A11yGateConfig {
  failOn: GateSeverity;
  rules?: ReturnType<typeof getAllRulesForConfig>;
  rootSelector?: string;
}

function getAllRulesForConfig() {
  // Re-export type for typing convenience (avoids circular import)
  return import('./a11y-checker.js').then((m) => m.getAllRules());
}

export interface A11yGateResult {
  passed: boolean;
  violations: A11yViolation[];
  scannedAt: number;
}

export interface A11yGateReport {
  result: A11yGateResult;
  summary: ViolationSummary;
  report: string;
}

export const A11Y_GATE_STORAGE_KEY = 'ai-team-a11y-gate-result';

export const DEFAULT_A11Y_GATE_CONFIG: A11yGateConfig = {
  failOn: 'serious',
};

export function buildA11yGateConfig(overrides?: Partial<A11yGateConfig>): A11yGateConfig {
  return { ...DEFAULT_A11Y_GATE_CONFIG, ...(overrides ?? {}) };
}

// ---------- gate helpers ----------
export function collectGateViolations(result: A11yGateResult, minSeverity: GateSeverity): A11yViolation[] {
  return result.violations.filter((v) => severityRank(v.severity) >= severityRank(minSeverity));
}

export function shouldFailGate(failOn: GateSeverity, violations: A11yViolation[]): boolean {
  return violations.some((v) => severityRank(v.severity) >= severityRank(failOn));
}

export function gateToExitCode(passed: boolean): 0 | 1 {
  return passed ? 0 : 1;
}

export function formatGateReport(result: A11yGateResult, failOn: GateSeverity): string {
  const summary = summarizeViolations(result.violations);
  const lines = [
    `A11y gate: ${result.passed ? 'PASSED' : 'FAILED'} (failOn=${failOn})`,
    `  total=${summary.total} critical=${summary.critical} serious=${summary.serious} moderate=${summary.moderate} minor=${summary.minor}`,
  ];
  for (const v of result.violations) {
    lines.push(`  [${v.severity}] ${v.id}: ${v.message} (${v.elements.length} elements)`);
  }
  return lines.join('\n');
}

export function summarizeGate(result: A11yGateResult): ViolationSummary {
  return summarizeViolations(result.violations);
}

// ---------- Gate runner ----------
let _gateCache: { result: A11yGateResult; ts: number } | null = null;
const GATE_CACHE_TTL = 1000;

export function resetA11yGateCache(): void {
  _gateCache = null;
}

export function runA11yGateCheck(config: A11yGateConfig): A11yGateResult {
  if (typeof document === 'undefined') {
    return { passed: true, violations: [], scannedAt: Date.now() };
  }
  if (_gateCache && Date.now() - _gateCache.ts < GATE_CACHE_TTL) {
    return _gateCache.result;
  }
  const checker = new A11yChecker(config.rules);
  const violations = checker.scan();
  const passed = !shouldFailGate(config.failOn, violations);
  const result: A11yGateResult = { passed, violations, scannedAt: Date.now() };
  _gateCache = { result, ts: Date.now() };
  return result;
}

export function validateA11y(config: A11yGateConfig): A11yGateResult {
  return runA11yGateCheck(config);
}

export function runDocumentValidation(root: ParentNode, config: A11yGateConfig): A11yGateResult {
  if (typeof document === 'undefined') {
    return { passed: true, violations: [], scannedAt: Date.now() };
  }
  const checker = new A11yChecker(config.rules);
  const violations = checker.scan(root);
  const passed = !shouldFailGate(config.failOn, violations);
  return { passed, violations, scannedAt: Date.now() };
}

// ---------- Context ----------
interface A11yGateContextValue {
  config: A11yGateConfig;
  result: A11yGateResult;
  summary: ViolationSummary;
  passed: boolean;
  recheck: () => void;
}

const A11yGateContext = createContext<A11yGateContextValue | null>(null);

export function A11yGateProvider({
  children,
  config: configProp,
}: {
  children: ReactNode;
  config?: A11yGateConfig;
}) {
  const [config, setConfig] = useState<A11yGateConfig>(() => configProp ?? buildA11yGateConfig());
  const [result, setResult] = useState<A11yGateResult>(() => runA11yGateCheck(config));

  const recheck = useCallback(() => {
    resetA11yGateCache();
    const r = runA11yGateCheck(config);
    setResult(r);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(A11Y_GATE_STORAGE_KEY, JSON.stringify({ passed: r.passed, count: r.violations.length }));
      } catch {
        /* quota */
      }
    }
  }, [config]);

  useEffect(() => {
    if (configProp) setConfig(configProp);
  }, [configProp]);

  const value: A11yGateContextValue = useMemo(
    () => ({ config, result, summary: summarizeViolations(result.violations), passed: result.passed, recheck }),
    [config, result, recheck]
  );

  return <A11yGateContext.Provider value={value}>{children}</A11yGateContext.Provider>;
}

export function useA11yGate(): A11yGateContextValue {
  const ctx = useContext(A11yGateContext);
  if (!ctx) {
    return {
      config: buildA11yGateConfig(),
      result: { passed: true, violations: [], scannedAt: 0 },
      summary: summarizeViolations([]),
      passed: true,
      recheck: () => {},
    };
  }
  return ctx;
}

// ---------- useSkipToMainElement ----------
export function useSkipToMainElement(targetId: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const link = document.createElement('a');
    link.href = `#${targetId}`;
    link.textContent = '跳到主内容';
    link.setAttribute('data-testid', 'skip-to-main');
    link.className = 'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-white';
    document.body.prepend(link);
    return () => {
      link.remove();
    };
  }, [targetId]);
}

// ---------- A11yBadgeSlot ----------
export function A11yBadgeSlot() {
  const { passed, summary } = useA11yGate();
  return <A11yAuditBadge failOn="serious" />;
  void passed; void summary;
}

// ---------- AppAccessibilityRoot ----------
export interface AppAccessibilityRootProps {
  targetId: string;
  children?: ReactNode;
}

export function AppAccessibilityRoot({ targetId, children }: AppAccessibilityRootProps) {
  useSkipToMainElement(targetId);
  return (
    <>
      {children}
      <A11yBadgeSlot />
    </>
  );
}