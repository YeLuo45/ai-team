// V139: HeroLanding (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  HeroLanding,
  HeroModuleCard,
  HeroBackground,
  StatusDot,
  statusTone,
  statusLabel,
  buildDefaultHeroModules,
  type HeroModule,
  type ModuleStatus,
} from '../src/components/hero/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Status helpers ----------
describe('V139 status helpers', () => {
  it('statusTone maps each status to design-system tone', () => {
    expect(statusTone('healthy')).toBe('success');
    expect(statusTone('degraded')).toBe('warning');
    expect(statusTone('blocked')).toBe('danger');
    expect(statusTone('idle')).toBe('neutral');
  });

  it('statusLabel returns Chinese label for each status', () => {
    expect(statusLabel('healthy')).toBe('健康');
    expect(statusLabel('degraded')).toBe('降级');
    expect(statusLabel('blocked')).toBe('阻塞');
    expect(statusLabel('idle')).toBe('空闲');
  });
});

// ---------- StatusDot ----------
describe('V139 StatusDot', () => {
  it('renders status dot with data attribute', () => {
    render(<StatusDot status="healthy" />);
    const dot = screen.getByTestId('status-dot');
    expect(dot.getAttribute('data-status')).toBe('healthy');
  });

  it('renders with label when provided', () => {
    render(<StatusDot status="blocked" label="审批阻塞" />);
    expect(screen.getByTestId('status-dot').textContent).toContain('审批阻塞');
  });

  it('uses different colors per status', () => {
    const { container } = render(<StatusDot status="degraded" />);
    expect(container.innerHTML).toContain('bg-amber-500');
  });
});

// ---------- HeroBackground ----------
describe('V139 HeroBackground', () => {
  it('renders orbs variant', () => {
    const { container } = render(<HeroBackground variant="orbs" />);
    expect(screen.getByTestId('hero-background')).toBeTruthy();
    expect(container.innerHTML).toContain('rounded-full');
  });

  it('renders grid variant', () => {
    render(<HeroBackground variant="grid" />);
    expect(screen.getByTestId('hero-background').innerHTML).toContain('linear-gradient');
  });

  it('returns null for plain variant', () => {
    const { container } = render(<HeroBackground variant="plain" />);
    expect(container.innerHTML).not.toContain('hero-background');
  });
});

// ---------- HeroModuleCard ----------
describe('V139 HeroModuleCard', () => {
  const sample: HeroModule = {
    key: 'candidates',
    title: '招聘',
    description: '候选人',
    route: '/candidates',
    status: 'healthy',
    count: 12,
    unit: '人',
    icon: '👥',
    testId: 'hero-module-candidates',
  };

  it('renders title + description + count', () => {
    render(<HeroModuleCard mod={sample} />);
    expect(screen.getByTestId('hero-module-candidates')).toBeTruthy();
    expect(screen.getByTestId('hero-module-candidates').textContent).toContain('招聘');
    expect(screen.getByTestId('hero-module-candidates').textContent).toContain('12');
    expect(screen.getByTestId('hero-module-candidates').textContent).toContain('人');
  });

  it('link href matches module route', () => {
    render(<HeroModuleCard mod={sample} />);
    const link = screen.getByTestId('hero-module-link-candidates');
    expect(link.getAttribute('href')).toBe('/candidates');
  });

  it('renders status badge with correct tone', () => {
    render(<HeroModuleCard mod={sample} />);
    const card = screen.getByTestId('hero-module-candidates');
    expect(card.textContent).toContain('健康');
  });
});

// ---------- HeroLanding ----------
describe('V139 HeroLanding', () => {
  const sampleModules: HeroModule[] = buildDefaultHeroModules();

  it('renders all 4 default modules', () => {
    render(<HeroLanding modules={sampleModules} />);
    expect(screen.getByTestId('hero-module-recruitment')).toBeTruthy();
    expect(screen.getByTestId('hero-module-orchestration')).toBeTruthy();
    expect(screen.getByTestId('hero-module-audit')).toBeTruthy();
    expect(screen.getByTestId('hero-module-data')).toBeTruthy();
  });

  it('renders title + subtitle + eyebrow', () => {
    render(<HeroLanding modules={sampleModules} title="ai-team" subtitle="测试" eyebrow="Eyebrow" />);
    expect(screen.getByTestId('hero-title').textContent).toBe('ai-team');
    expect(screen.getByTestId('hero-subtitle').textContent).toBe('测试');
    expect(screen.getByTestId('hero-eyebrow').textContent).toBe('Eyebrow');
  });

  it('renders CTA when provided', () => {
    render(
      <HeroLanding
        modules={sampleModules}
        cta={{ label: '开始', route: '/dashboard', testId: 'hero-cta' }}
      />
    );
    const cta = screen.getByTestId('hero-cta');
    expect(cta.textContent).toBe('开始');
    expect(cta.getAttribute('href')).toBe('/dashboard');
  });

  it('uses plain background when requested', () => {
    const { container } = render(<HeroLanding modules={sampleModules} background="plain" />);
    expect(container.innerHTML).not.toContain('hero-background');
  });
});

// ---------- buildDefaultHeroModules ----------
describe('V139 buildDefaultHeroModules', () => {
  it('returns 4 modules', () => {
    expect(buildDefaultHeroModules().length).toBe(4);
  });

  it('first module is recruitment', () => {
    expect(buildDefaultHeroModules()[0]?.key).toBe('recruitment');
  });

  it('each module has required fields', () => {
    for (const m of buildDefaultHeroModules()) {
      expect(m.title).toBeTruthy();
      expect(m.route).toMatch(/^\//);
      expect(m.status).toBeDefined();
      expect(m.testId).toMatch(/^hero-module-/);
    }
  });
});

// ---------- Types ----------
describe('V139 types', () => {
  it('HeroModule has all required fields', () => {
    const m: HeroModule = {
      key: 'a',
      title: 'A',
      description: 'D',
      route: '/a',
      status: 'healthy',
      icon: '⚡',
      testId: 'a',
    };
    expect(m.key).toBe('a');
  });

  it('ModuleStatus accepts 4 values', () => {
    const statuses: ModuleStatus[] = ['healthy', 'degraded', 'blocked', 'idle'];
    expect(statuses.length).toBe(4);
  });
});