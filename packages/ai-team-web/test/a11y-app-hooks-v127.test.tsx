// V127: App production hooks — A11yAuditBadge + skip-to-main + ConsoleShell route (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  AppAccessibilityRoot,
  A11yBadgeSlot,
  useSkipToMainElement,
  A11yGateContext,
  useA11yGate,
  A11yGateProvider,
  runA11yGateCheck,
  buildA11yGateConfig,
  DEFAULT_A11Y_GATE_CONFIG,
  collectGateViolations,
  shouldFailGate,
  gateToExitCode,
  formatGateReport,
  A11yGateConfig,
  A11yGateResult,
  A11yGateReport,
  validateA11y,
  runDocumentValidation,
  summarizeGate,
  A11Y_GATE_STORAGE_KEY,
  resetA11yGateCache,
  type GateSeverity,
} from '../src/components/a11y/index.js';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  resetA11yGateCache();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  resetA11yGateCache();
});

// ---------- A11yGateContext ----------
describe('V127 A11yGateContext', () => {
  it('DEFAULT_A11Y_GATE_CONFIG has failOn=serious', () => {
    expect(DEFAULT_A11Y_GATE_CONFIG.failOn).toBe('serious');
  });

  it('A11yGateProvider supplies config + check fn', () => {
    function Probe() {
      const ctx = useA11yGate();
      return <div data-testid="ctx">{String(ctx.config.failOn)}</div>;
    }
    render(
      <A11yGateProvider>
        <Probe />
      </A11yGateProvider>
    );
    expect(screen.getByTestId('ctx').textContent).toBe('serious');
  });

  it('A11yGateProvider accepts overrides', () => {
    function Probe() {
      const ctx = useA11yGate();
      return <div data-testid="ctx">{ctx.config.failOn}</div>;
    }
    render(
      <A11yGateProvider config={buildA11yGateConfig({ failOn: 'minor' })}>
        <Probe />
      </A11yGateProvider>
    );
    expect(screen.getByTestId('ctx').textContent).toBe('minor');
  });
});

// ---------- A11yGateResult helpers ----------
describe('V127 a11y gate helpers', () => {
  it('collectGateViolations filters by failOn severity', () => {
    const result: A11yGateResult = {
      passed: false,
      violations: [
        { id: 'a', severity: 'critical', message: 'A', elements: [] },
        { id: 'b', severity: 'serious', message: 'B', elements: [] },
        { id: 'c', severity: 'minor', message: 'C', elements: [] },
      ],
      scannedAt: 0,
    };
    const filtered = collectGateViolations(result, 'serious');
    expect(filtered.length).toBe(2);
    expect(filtered.find((v) => v.id === 'c')).toBeUndefined();
  });

  it('shouldFailGate returns true if any violation >= failOn', () => {
    expect(shouldFailGate('serious', [{ id: 'a', severity: 'critical', message: 'x', elements: [] }])).toBe(true);
    expect(shouldFailGate('critical', [{ id: 'a', severity: 'serious', message: 'x', elements: [] }])).toBe(false);
    expect(shouldFailGate('serious', [])).toBe(false);
  });

  it('gateToExitCode returns 0 / 1', () => {
    expect(gateToExitCode(true)).toBe(0);
    expect(gateToExitCode(false)).toBe(1);
  });

  it('formatGateReport includes severity counts + elements', () => {
    const result: A11yGateResult = {
      passed: false,
      violations: [
        { id: 'img', severity: 'critical', message: 'missing alt', elements: ['<img>'] },
      ],
      scannedAt: 0,
    };
    const report = formatGateReport(result, 'serious');
    expect(report).toContain('critical');
    expect(report).toContain('img');
  });
});

// ---------- runA11yGateCheck ----------
describe('V127 runA11yGateCheck', () => {
  it('passes on clean document', () => {
    document.body.innerHTML = '<button>OK</button>';
    const config: A11yGateConfig = buildA11yGateConfig();
    const result = runA11yGateCheck(config);
    expect(result.passed).toBe(true);
  });

  it('fails on critical violation (image-alt)', () => {
    document.body.innerHTML = '<img src="x.png" />';
    const config: A11yGateConfig = buildA11yGateConfig({ failOn: 'critical' });
    const result = runA11yGateCheck(config);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.id === 'image-alt')).toBe(true);
  });

  it('config overrides respected', () => {
    document.body.innerHTML = '<img src="x" />';
    const config = buildA11yGateConfig({ failOn: 'minor' });
    const result = runA11yGateCheck(config);
    expect(result.passed).toBe(false);
  });
});

// ---------- A11Y_GATE_STORAGE_KEY ----------
describe('V127 A11Y_GATE_STORAGE_KEY', () => {
  it('is ai-team-a11y-gate-result', () => {
    expect(A11Y_GATE_STORAGE_KEY).toBe('ai-team-a11y-gate-result');
  });
});

// ---------- buildA11yGateConfig ----------
describe('V127 buildA11yGateConfig', () => {
  it('returns defaults when no overrides', () => {
    const cfg = buildA11yGateConfig();
    expect(cfg.failOn).toBe(DEFAULT_A11Y_GATE_CONFIG.failOn);
  });

  it('applies overrides', () => {
    const cfg = buildA11yGateConfig({ failOn: 'moderate', rules: [] });
    expect(cfg.failOn).toBe('moderate');
    expect(cfg.rules).toEqual([]);
  });
});

// ---------- summarizeGate ----------
describe('V127 summarizeGate', () => {
  it('aggregates violations by severity', () => {
    const result: A11yGateResult = {
      passed: false,
      violations: [
        { id: 'a', severity: 'critical', message: '', elements: [] },
        { id: 'b', severity: 'serious', message: '', elements: [] },
        { id: 'c', severity: 'serious', message: '', elements: [] },
      ],
      scannedAt: 0,
    };
    const summary = summarizeGate(result);
    expect(summary.critical).toBe(1);
    expect(summary.serious).toBe(2);
    expect(summary.total).toBe(3);
  });
});

// ---------- validateA11y / runDocumentValidation ----------
describe('V127 validateA11y', () => {
  it('returns boolean + result', () => {
    document.body.innerHTML = '<button>OK</button>';
    const r = validateA11y(buildA11yGateConfig());
    expect(typeof r.passed).toBe('boolean');
    expect(Array.isArray(r.violations)).toBe(true);
  });

  it('runDocumentValidation accepts ad-hoc rule check', () => {
    const r = runDocumentValidation(document, buildA11yGateConfig());
    expect(r.passed).toBeDefined();
  });
});

// ---------- A11yBadgeSlot ----------
describe('V127 A11yBadgeSlot', () => {
  it('renders badge inside provider', () => {
    render(
      <A11yGateProvider>
        <A11yBadgeSlot />
      </A11yGateProvider>
    );
    expect(screen.getByTestId('a11y-badge')).toBeTruthy();
  });

  it('badge shows passing tone on clean document', () => {
    document.body.innerHTML = '<button>OK</button>';
    render(
      <A11yGateProvider>
        <A11yBadgeSlot />
      </A11yGateProvider>
    );
    const badge = screen.getByTestId('a11y-badge');
    expect(badge.getAttribute('data-passed')).toBe('true');
  });
});

// ---------- useSkipToMainElement ----------
describe('V127 useSkipToMainElement', () => {
  it('registers a skip link with target id', () => {
    function Probe() {
      useSkipToMainElement('app-main-shell');
      return null;
    }
    render(<Probe />);
    const link = document.querySelector('[data-testid="skip-to-main"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('#app-main-shell');
  });

  it('removes the skip link on unmount', () => {
    function Probe() {
      useSkipToMainElement('app-main-shell');
      return null;
    }
    const { unmount } = render(<Probe />);
    expect(document.querySelector('[data-testid="skip-to-main"]')).toBeTruthy();
    unmount();
    expect(document.querySelector('[data-testid="skip-to-main"]')).toBeNull();
  });
});

// ---------- AppAccessibilityRoot ----------
describe('V127 AppAccessibilityRoot', () => {
  it('renders skip link + badge + children', () => {
    render(
      <MemoryRouter>
        <A11yGateProvider>
          <AppAccessibilityRoot targetId="app-main-shell">
            <div data-testid="child">content</div>
          </AppAccessibilityRoot>
        </A11yGateProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(document.querySelector('[data-testid="skip-to-main"]')).toBeTruthy();
    expect(screen.getByTestId('a11y-badge')).toBeTruthy();
  });

  it('renders without children (skips optional child)', () => {
    render(
      <A11yGateProvider>
        <AppAccessibilityRoot targetId="app-main-shell" />
      </A11yGateProvider>
    );
    expect(screen.getByTestId('a11y-badge')).toBeTruthy();
  });
});

// ---------- App integration: ConsoleShell + A11yBadge ----------
describe('V127 App integration', () => {
  it('App renders /orchestration route via ConsoleShell', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter initialEntries={['/orchestration']}>
        <App />
      </MemoryRouter>
    );
    // ConsoleShell exposes 4 tab buttons
    await waitFor(() => expect(screen.getByTestId('shell-tab-workflow')).toBeTruthy());
    expect(screen.getByTestId('shell-tab-approvals')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-delivery')).toBeTruthy();
    expect(screen.getByTestId('shell-tab-operations')).toBeTruthy();
  });

  it('App A11y badge is visible in AppShell', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('a11y-badge')).toBeTruthy();
  });

  it('App skip-to-main link is registered', async () => {
    const App = (await import('../src/App.js')).default;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(document.querySelector('[data-testid="skip-to-main"]')).toBeTruthy();
  });
});