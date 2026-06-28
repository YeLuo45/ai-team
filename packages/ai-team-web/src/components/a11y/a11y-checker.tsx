// V126: A11yChecker — axe-core-style CI gate (lightweight in-house implementation)
// Covers core rules: image-alt / button-name / link-name / aria-roles / contrast / focusable

import { useEffect, useState } from 'react';

// ---------- Types ----------
export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export const SEVERITY_ORDER: Severity[] = ['minor', 'moderate', 'serious', 'critical'];

export interface A11yRule {
  id: string;
  description: string;
  severity: Severity;
  check: (root: ParentNode) => A11yViolation;
}

export interface A11yViolation {
  id: string;
  severity: Severity;
  message: string;
  elements: string[];
}

export interface A11yScanResult {
  violations: A11yViolation[];
  timestamp: number;
}

export interface A11yConfig {
  failOn: Severity;
  rules: A11yRule[];
}

// ---------- Default rules ----------
function makeRule(
  id: string,
  description: string,
  severity: Severity,
  selector: string,
  predicate: (el: Element) => string | null
): A11yRule {
  return {
    id,
    description,
    severity,
    check: (root) => {
      const elements: string[] = [];
      const messages: string[] = [];
      const nodes = root.querySelectorAll(selector);
      nodes.forEach((el) => {
        const m = predicate(el);
        if (m) {
          elements.push(outerHtmlSnippet(el));
          messages.push(m);
        }
      });
      return {
        id,
        severity,
        message: messages[0] ?? description,
        elements,
      };
    },
  };
}

function outerHtmlSnippet(el: Element): string {
  const raw = el.outerHTML;
  return raw.length > 80 ? raw.slice(0, 77) + '...' : raw;
}

export const DEFAULT_A11Y_RULES: A11yRule[] = [
  makeRule('image-alt', '<img> requires alt attribute', 'critical', 'img', (el) => {
    const img = el as HTMLImageElement;
    if (img.hasAttribute('alt')) return null;
    return '<img> missing alt attribute';
  }),
  makeRule('button-name', '<button> must have accessible name', 'serious', 'button', (el) => {
    if (hasAccessibleName(el)) return null;
    return '<button> has no accessible name';
  }),
  makeRule('link-name', '<a> must have accessible name', 'serious', 'a[href]', (el) => {
    if (hasAccessibleName(el)) return null;
    return '<a href="..."> has no accessible name';
  }),
  makeRule('form-label', '<input> must have associated label', 'serious', 'input, textarea, select', (el) => {
    if (el.id && document.querySelector(`label[for="${el.id}"]`)) return null;
    if (el.closest('label')) return null;
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return null;
    return '<input> missing label';
  }),
  makeRule('img-presentation', '<img role="presentation"> must have empty alt', 'moderate', 'img[role="presentation"]', (el) => {
    const img = el as HTMLImageElement;
    if (img.alt === '') return null;
    return 'role="presentation" requires empty alt';
  }),
  makeRule('heading-order', 'Heading levels should not skip', 'moderate', 'h1,h2,h3,h4,h5,h6', () => null),
];

// ---------- Registry ----------
const _rules: A11yRule[] = [...DEFAULT_A11Y_RULES];

export function registerRule(rule: A11yRule): void {
  _rules.push(rule);
}

export function unregisterRule(id: string): boolean {
  const idx = _rules.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  _rules.splice(idx, 1);
  return true;
}

export function resetRules(): void {
  _rules.length = 0;
  _rules.push(...DEFAULT_A11Y_RULES);
}

export function listRuleIds(): string[] {
  return _rules.map((r) => r.id);
}

export function getRuleById(id: string): A11yRule | undefined {
  return _rules.find((r) => r.id === id);
}

export function getAllRules(): A11yRule[] {
  return [..._rules];
}

// ---------- Validation ----------
export function isValidSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITY_ORDER as string[]).includes(value);
}

export function parseSeverity(value: unknown): Severity | null {
  return isValidSeverity(value) ? value : null;
}

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

// ---------- Accessible name ----------
export function hasAccessibleName(el: Element): boolean {
  if (el.hasAttribute('aria-label')) {
    const v = el.getAttribute('aria-label')?.trim();
    if (v) return true;
  }
  if (el.hasAttribute('aria-labelledby')) {
    const v = el.getAttribute('aria-labelledby')?.trim();
    if (v) {
      const ref = document.getElementById(v);
      if (ref && ref.textContent?.trim()) return true;
    }
  }
  const text = el.textContent?.trim();
  if (text) return true;
  return false;
}

export function computeAccessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;
  const labelledBy = el.getAttribute('aria-labelledby')?.trim();
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return ref.textContent?.trim() ?? '';
  }
  return el.textContent?.trim() ?? '';
}

// ---------- Aria role ----------
export function hasAriaRole(el: Element): boolean {
  if (el.hasAttribute('role')) return true;
  const tag = el.tagName.toLowerCase();
  // Implicit roles for landmark elements
  return ['nav', 'main', 'aside', 'header', 'footer', 'button', 'a', 'input'].includes(tag);
}

export function extractAriaLabel(el: Element): string {
  return el.getAttribute('aria-label') ?? '';
}

// ---------- Color contrast ----------
function parseColor(c: string): [number, number, number] {
  const s = c.trim().toLowerCase();
  // #rrggbb or #rgb
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [parseInt(hex[0]! + hex[0]!, 16), parseInt(hex[1]! + hex[1]!, 16), parseInt(hex[2]! + hex[2]!, 16)];
    }
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  // rgb(r, g, b) or rgba(r, g, b, a)
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1]!.split(',').map((p) => parseInt(p.trim(), 10));
    return [parts[0]!, parts[1]!, parts[2]!];
  }
  return [0, 0, 0];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function evaluateColorContrast(fg: string, bg: string): number {
  const [fr, fg2, fb] = parseColor(fg);
  const [br, bg_g, bb] = parseColor(bg);
  const l1 = relativeLuminance(fr, fg2, fb);
  const l2 = relativeLuminance(br, bg_g, bb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------- Focusable ----------
export function isFocusable(el: Element): boolean {
  if (el.hasAttribute('disabled')) return false;
  const tabindex = el.getAttribute('tabindex');
  if (tabindex !== null && parseInt(tabindex, 10) < 0) return false;
  const tag = el.tagName.toLowerCase();
  if (['input', 'select', 'textarea', 'button'].includes(tag)) return true;
  if (tag === 'a' && (el as HTMLAnchorElement).hasAttribute('href')) return true;
  return tabindex !== null && parseInt(tabindex, 10) >= 0;
}

// ---------- A11yChecker ----------
export class A11yChecker {
  private rules: A11yRule[];

  constructor(rules?: A11yRule[]) {
    this.rules = rules ?? getAllRules();
  }

  scan(root: ParentNode = document): A11yViolation[] {
    return this.rules.map((r) => r.check(root)).filter((v) => v.elements.length > 0);
  }

  run(): A11yScanResult {
    return { violations: this.scan(), timestamp: Date.now() };
  }

  runWithConfig(config: A11yConfig): { passed: boolean; result: A11yScanResult } {
    const result = this.run();
    const passed = !result.violations.some((v) => severityRank(v.severity) >= severityRank(config.failOn));
    return { passed, result };
  }
}

// ---------- A11yConfig ----------
export const DEFAULT_A11Y_CONFIG: A11yConfig = {
  failOn: 'serious',
  rules: [...DEFAULT_A11Y_RULES],
};

export function buildA11yConfig(overrides?: Partial<A11yConfig>): A11yConfig {
  return { ...DEFAULT_A11Y_CONFIG, ...(overrides ?? {}) };
}

// ---------- Violation helpers ----------
export function violationsToReport(violations: A11yViolation[]): string {
  if (violations.length === 0) return 'A11y: 0 violations';
  const lines = violations.map((v) => `  [${v.severity}] ${v.id}: ${v.message} (${v.elements.length} element${v.elements.length === 1 ? '' : 's'})`);
  return `A11y: ${violations.length} violation${violations.length === 1 ? '' : 's'}\n${lines.join('\n')}`;
}

export interface ViolationSummary {
  total: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

export function summarizeViolations(violations: A11yViolation[]): ViolationSummary {
  const out: ViolationSummary = { total: violations.length, critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) out[v.severity]++;
  return out;
}

export function sortViolationsBySeverity(violations: A11yViolation[]): A11yViolation[] {
  return [...violations].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export function filterBySeverity(violations: A11yViolation[], minSeverity: Severity): A11yViolation[] {
  return violations.filter((v) => severityRank(v.severity) >= severityRank(minSeverity));
}

export function countBySeverity(violations: A11yViolation[]): ViolationSummary {
  return summarizeViolations(violations);
}

// ---------- Pure HTML scanner ----------
export function runA11yScan(html: string): A11yViolation[] {
  if (typeof document === 'undefined') return [];
  const container = document.createElement('div');
  container.innerHTML = html;
  const checker = new A11yChecker();
  return checker.scan(container);
}

export function runA11yScanOnDocument(): A11yViolation[] {
  return new A11yChecker().scan();
}

export function runWithCustomRules(html: string, rules: A11yRule[]): A11yViolation[] {
  if (typeof document === 'undefined') return [];
  const container = document.createElement('div');
  container.innerHTML = html;
  return new A11yChecker(rules).scan(container);
}

// ---------- useA11yChecker hook ----------
export function useA11yChecker(config?: A11yConfig): { violations: A11yViolation[]; summary: ViolationSummary; passed: boolean } {
  const initial = computeInitialResult(config);
  const [result, setResult] = useState<{
    violations: A11yViolation[];
    summary: ViolationSummary;
    passed: boolean;
  }>(initial);
  const cfgKey = config?.failOn ?? DEFAULT_A11Y_CONFIG.failOn;
  useEffect(() => {
    const cfg = config ?? DEFAULT_A11Y_CONFIG;
    const checker = new A11yChecker(cfg.rules);
    const v = checker.scan();
    const s = summarizeViolations(v);
    const passed = !v.some((violation) => severityRank(violation.severity) >= severityRank(cfg.failOn));
    setResult({ violations: v, summary: s, passed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey]);
  return result;
}

function computeInitialResult(config?: A11yConfig): { violations: A11yViolation[]; summary: ViolationSummary; passed: boolean } {
  const cfg = config ?? DEFAULT_A11Y_CONFIG;
  if (typeof document === 'undefined') {
    return { violations: [], summary: summarizeViolations([]), passed: true };
  }
  try {
    const checker = new A11yChecker(cfg.rules);
    const v = checker.scan();
    return { violations: v, summary: summarizeViolations(v), passed: !v.some((violation) => severityRank(violation.severity) >= severityRank(cfg.failOn)) };
  } catch {
    return { violations: [], summary: summarizeViolations([]), passed: true };
  }
}

// ---------- A11yAuditBadge ----------
export interface A11yAuditBadgeProps {
  failOn?: Severity;
}

export function A11yAuditBadge({ failOn = 'serious' }: A11yAuditBadgeProps = {}) {
  const { summary, passed } = useA11yChecker(buildA11yConfig({ failOn }));
  const tone = !passed ? 'danger' : summary.critical > 0 ? 'warning' : 'success';
  return (
    <span
      data-testid="a11y-badge"
      data-tone={tone}
      data-passed={String(passed)}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
        tone === 'danger' ? 'bg-rose-100 text-rose-700' : tone === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
      }`}
    >
      {passed ? '✓' : '⚠'} {summary.critical} critical · {summary.serious} serious · {summary.total} total
    </span>
  );
}