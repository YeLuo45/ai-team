// V126: A11yChecker — axe-core-style CI gate (lightweight in-house impl)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  A11yChecker,
  runA11yScan,
  runA11yScanOnDocument,
  violationsToReport,
  summarizeViolations,
  sortViolationsBySeverity,
  filterBySeverity,
  countBySeverity,
  A11yViolation,
  Severity,
  SEVERITY_ORDER,
  isValidSeverity,
  parseSeverity,
  hasAccessibleName,
  computeAccessibleName,
  hasAriaRole,
  extractAriaLabel,
  evaluateColorContrast,
  isFocusable,
  DEFAULT_A11Y_RULES,
  getRuleById,
  listRuleIds,
  buildA11yConfig,
  DEFAULT_A11Y_CONFIG,
  useA11yChecker,
  A11yAuditBadge,
  A11yScanResult,
  registerRule,
  unregisterRule,
  resetRules,
  runWithCustomRules,
} from '../src/components/a11y/index.js';

beforeEach(() => {
  resetRules();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Types & Constants ----------
describe('V126 types + constants', () => {
  it('Severity accepts critical/serious/moderate/minor', () => {
    expect(SEVERITY_ORDER).toEqual(['minor', 'moderate', 'serious', 'critical']);
  });

  it('isValidSeverity accepts canonical', () => {
    expect(isValidSeverity('critical')).toBe(true);
    expect(isValidSeverity('serious')).toBe(true);
    expect(isValidSeverity('moderate')).toBe(true);
    expect(isValidSeverity('minor')).toBe(true);
    expect(isValidSeverity('foo')).toBe(false);
    expect(isValidSeverity(null)).toBe(false);
  });

  it('parseSeverity returns Severity or null', () => {
    expect(parseSeverity('critical')).toBe('critical');
    expect(parseSeverity('foo')).toBeNull();
  });

  it('listRuleIds returns registered rules', () => {
    const ids = listRuleIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('image-alt');
  });
});

// ---------- Accessible name computation ----------
describe('V126 accessible name', () => {
  it('hasAccessibleName returns true for text content', () => {
    const div = document.createElement('button');
    div.textContent = 'Click me';
    document.body.appendChild(div);
    expect(hasAccessibleName(div)).toBe(true);
    div.remove();
  });

  it('hasAccessibleName returns true for aria-label', () => {
    const div = document.createElement('button');
    div.setAttribute('aria-label', 'Submit form');
    document.body.appendChild(div);
    expect(hasAccessibleName(div)).toBe(true);
    div.remove();
  });

  it('hasAccessibleName returns false for empty button', () => {
    const div = document.createElement('button');
    document.body.appendChild(div);
    expect(hasAccessibleName(div)).toBe(false);
    div.remove();
  });

  it('hasAccessibleName returns true for aria-labelledby', () => {
    const wrapper = document.createElement('div');
    const label = document.createElement('span');
    label.id = 'lbl-1';
    label.textContent = 'My Label';
    const target = document.createElement('button');
    target.setAttribute('aria-labelledby', 'lbl-1');
    wrapper.append(label, target);
    document.body.appendChild(wrapper);
    expect(hasAccessibleName(target)).toBe(true);
    wrapper.remove();
  });

  it('computeAccessibleName prefers aria-label over text', () => {
    const div = document.createElement('button');
    div.textContent = 'Fallback';
    div.setAttribute('aria-label', 'Preferred');
    document.body.appendChild(div);
    expect(computeAccessibleName(div)).toBe('Preferred');
    div.remove();
  });
});

// ---------- Aria role / label extraction ----------
describe('V126 aria role/label extraction', () => {
  it('hasAriaRole detects explicit role', () => {
    const div = document.createElement('div');
    div.setAttribute('role', 'navigation');
    document.body.appendChild(div);
    expect(hasAriaRole(div)).toBe(true);
    div.remove();
  });

  it('hasAriaRole detects implicit role for nav/button', () => {
    const nav = document.createElement('nav');
    document.body.appendChild(nav);
    expect(hasAriaRole(nav)).toBe(true);
    nav.remove();
  });

  it('extractAriaLabel returns label or empty', () => {
    const a = document.createElement('a');
    a.setAttribute('aria-label', 'Link');
    document.body.appendChild(a);
    expect(extractAriaLabel(a)).toBe('Link');
    const b = document.createElement('a');
    b.textContent = 'Text';
    document.body.appendChild(b);
    expect(extractAriaLabel(b)).toBe('');
    a.remove();
    b.remove();
  });
});

// ---------- Color contrast ----------
describe('V126 color contrast', () => {
  it('black on white passes WCAG AA', () => {
    const ratio = evaluateColorContrast('#000000', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(7); // AAA
  });

  it('light gray on white fails WCAG AA', () => {
    const ratio = evaluateColorContrast('#cccccc', '#ffffff');
    expect(ratio).toBeLessThan(4.5);
  });

  it('returns a positive number', () => {
    expect(evaluateColorContrast('#336699', '#ffffff')).toBeGreaterThan(0);
  });

  it('handles rgb() format', () => {
    expect(evaluateColorContrast('rgb(0,0,0)', 'rgb(255,255,255)')).toBeCloseTo(21, 0);
  });
});

// ---------- Focusable detection ----------
describe('V126 focusable detection', () => {
  it('button is focusable', () => {
    const b = document.createElement('button');
    document.body.appendChild(b);
    expect(isFocusable(b)).toBe(true);
    b.remove();
  });

  it('div without tabindex is not focusable', () => {
    const d = document.createElement('div');
    document.body.appendChild(d);
    expect(isFocusable(d)).toBe(false);
    d.remove();
  });

  it('disabled button is not focusable', () => {
    const b = document.createElement('button');
    b.disabled = true;
    document.body.appendChild(b);
    expect(isFocusable(b)).toBe(false);
    b.remove();
  });

  it('tabindex=-1 is not in tab order', () => {
    const d = document.createElement('div');
    d.setAttribute('tabindex', '-1');
    document.body.appendChild(d);
    expect(isFocusable(d)).toBe(false);
    d.remove();
  });

  it('a[href] is focusable', () => {
    const a = document.createElement('a');
    a.href = '#';
    document.body.appendChild(a);
    expect(isFocusable(a)).toBe(true);
    a.remove();
  });
});

// ---------- Rule registry ----------
describe('V126 rule registry', () => {
  it('DEFAULT_A11Y_RULES includes image-alt + button-name', () => {
    expect(DEFAULT_A11Y_RULES.length).toBeGreaterThan(0);
    const ids = DEFAULT_A11Y_RULES.map((r) => r.id);
    expect(ids).toContain('image-alt');
    expect(ids).toContain('button-name');
    expect(ids).toContain('link-name');
  });

  it('getRuleById returns the rule', () => {
    const rule = getRuleById('image-alt');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('critical');
  });

  it('registerRule adds custom rule', () => {
    const before = listRuleIds().length;
    registerRule({
      id: 'custom-rule',
      description: 'always fails',
      severity: 'minor',
      check: () => ({ id: 'custom-rule', severity: 'minor', message: 'fail', elements: [] }),
    });
    expect(listRuleIds().length).toBe(before + 1);
    unregisterRule('custom-rule');
    expect(listRuleIds().length).toBe(before);
  });

  it('unregisterRule removes rule', () => {
    expect(getRuleById('image-alt')).toBeDefined();
    unregisterRule('image-alt');
    expect(getRuleById('image-alt')).toBeUndefined();
  });
});

// ---------- A11yChecker ----------
describe('V126 A11yChecker', () => {
  it('run() returns A11yScanResult', () => {
    const checker = new A11yChecker();
    const result = checker.run();
    expect(result).toBeDefined();
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('scan() on document returns violations array', () => {
    const img = document.createElement('img');
    img.src = '/foo.png';
    document.body.appendChild(img);
    const checker = new A11yChecker();
    const violations = checker.scan();
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.id === 'image-alt')).toBe(true);
    img.remove();
  });

  it('scan() on element returns element-scoped violations', () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    img.src = '/foo.png';
    root.appendChild(img);
    document.body.appendChild(root);
    const checker = new A11yChecker();
    const violations = checker.scan(root);
    expect(violations.length).toBeGreaterThan(0);
    root.remove();
  });

  it('excludes violations on correctly labeled elements', () => {
    const img = document.createElement('img');
    img.src = '/foo.png';
    img.alt = 'A descriptive alt';
    document.body.appendChild(img);
    const checker = new A11yChecker();
    const violations = checker.scan();
    expect(violations.find((v) => v.id === 'image-alt')).toBeUndefined();
    img.remove();
  });

  it('buildA11yConfig accepts overrides', () => {
    const cfg = buildA11yConfig({ failOn: 'minor' });
    expect(cfg.failOn).toBe('minor');
  });

  it('DEFAULT_A11Y_CONFIG has failOn + rules', () => {
    expect(DEFAULT_A11Y_CONFIG.failOn).toBe('serious');
    expect(Array.isArray(DEFAULT_A11Y_CONFIG.rules)).toBe(true);
  });
});

// ---------- runA11yScan ----------
describe('V126 runA11yScan', () => {
  it('scans an HTML string', () => {
    const html = '<div><img src="foo.png" /></div>';
    const violations = runA11yScan(html);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('returns empty for clean HTML', () => {
    const html = '<div><img src="foo.png" alt="descriptive" /><button>OK</button></div>';
    const violations = runA11yScan(html);
    expect(violations).toEqual([]);
  });

  it('runA11yScanOnDocument scans full document', () => {
    document.body.innerHTML = '<img src="foo.png" />';
    const violations = runA11yScanOnDocument();
    expect(violations.length).toBeGreaterThan(0);
    document.body.innerHTML = '';
  });

  it('runWithCustomRules accepts ad-hoc rule overrides', () => {
    const violations = runWithCustomRules('<img src="x" />', [
      {
        id: 'always-fail',
        description: 'always',
        severity: 'critical',
        check: () => ({ id: 'always-fail', severity: 'critical', message: 'fail', elements: ['<img>'] }),
      },
    ]);
    expect(violations.some((v) => v.id === 'always-fail')).toBe(true);
  });
});

// ---------- Violation helpers ----------
describe('V126 violation helpers', () => {
  const v1: A11yViolation = { id: 'a', severity: 'critical', message: 'A', elements: [] };
  const v2: A11yViolation = { id: 'b', severity: 'minor', message: 'B', elements: [] };
  const v3: A11yViolation = { id: 'c', severity: 'serious', message: 'C', elements: [] };

  it('violationsToReport formats violations', () => {
    const report = violationsToReport([v1, v2]);
    expect(report).toContain('[critical]');
    expect(report).toContain('[minor]');
    expect(report).toContain('a');
    expect(report).toContain('b');
  });

  it('summarizeViolations counts by severity', () => {
    const summary = summarizeViolations([v1, v2, v3]);
    expect(summary.critical).toBe(1);
    expect(summary.serious).toBe(1);
    expect(summary.minor).toBe(1);
    expect(summary.moderate).toBe(0);
    expect(summary.total).toBe(3);
  });

  it('sortViolationsBySeverity orders by severity', () => {
    const sorted = sortViolationsBySeverity([v2, v1, v3]);
    expect(sorted[0]?.id).toBe('a'); // critical first
    expect(sorted[1]?.id).toBe('c'); // serious
    expect(sorted[2]?.id).toBe('b'); // minor
  });

  it('filterBySeverity filters by min severity', () => {
    const filtered = filterBySeverity([v1, v2, v3], 'serious');
    expect(filtered.length).toBe(2);
    expect(filtered.find((v) => v.id === 'b')).toBeUndefined();
  });

  it('countBySeverity returns map', () => {
    const counts = countBySeverity([v1, v2, v3]);
    expect(counts.critical).toBe(1);
    expect(counts.minor).toBe(1);
  });
});

// ---------- useA11yChecker hook ----------
describe('V126 useA11yChecker hook', () => {
  it('returns violations + summary', () => {
    document.body.innerHTML = '<img src="foo.png" />';
    function Probe() {
      const r = useA11yChecker();
      return <div data-testid="result">{r.summary.total}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('result').textContent).toBeTruthy();
    document.body.innerHTML = '';
  });
});

// ---------- A11yAuditBadge ----------
describe('V126 A11yAuditBadge', () => {
  it('renders zero violations when clean', () => {
    document.body.innerHTML = '<button>OK</button>';
    render(<A11yAuditBadge />);
    expect(screen.getByTestId('a11y-badge')).toBeTruthy();
    expect(screen.getByText(/0 violations|✓/)).toBeTruthy();
    document.body.innerHTML = '';
  });

  it('renders violation count', () => {
    document.body.innerHTML = '<img src="x" />';
    render(<A11yAuditBadge />);
    expect(screen.getByTestId('a11y-badge')).toBeTruthy();
    expect(screen.getByText(/critical/)).toBeTruthy();
    document.body.innerHTML = '';
  });

  it('shows critical tone when failOn reached', () => {
    document.body.innerHTML = '<img src="x" />';
    render(<A11yAuditBadge failOn="critical" />);
    const badge = screen.getByTestId('a11y-badge');
    expect(badge.className).toMatch(/rose|red|danger/);
    document.body.innerHTML = '';
  });
});