// V107: Design System + ThemeSwitcher + AppShell RED tests
// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Card,
  Button,
  Badge,
  EmptyState,
  Skeleton,
  Drawer,
  Sheet,
  Popover,
  Tooltip,
  Tabs,
  Stat,
  Section,
  AppShell,
  Sidebar,
  Topbar,
  ThemeSwitcher,
  ThemeProvider,
  useTheme,
  THEME_KEYS,
  isValidTheme,
  applyThemeToDocument,
  getStoredTheme,
  setStoredTheme,
  resolveNavGroups,
  PRIMARY_NAV_GROUPS,
} from '../src/components/design-system/index.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('V107 ThemeProvider', () => {
  it('exposes 4 theme keys: light, dark, sepia, nord', () => {
    expect(THEME_KEYS).toEqual(['light', 'dark', 'sepia', 'nord']);
  });

  it('isValidTheme accepts canonical names and rejects unknowns', () => {
    expect(isValidTheme('light')).toBe(true);
    expect(isValidTheme('dark')).toBe(true);
    expect(isValidTheme('sepia')).toBe(true);
    expect(isValidTheme('nord')).toBe(true);
    expect(isValidTheme('foo')).toBe(false);
    expect(isValidTheme(null)).toBe(false);
  });

  it('applyThemeToDocument sets data-theme attribute', () => {
    applyThemeToDocument('nord');
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
    applyThemeToDocument('sepia');
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
  });

  it('persists user choice to localStorage under ai-team-theme', () => {
    setStoredTheme('sepia');
    expect(localStorage.getItem('ai-team-theme')).toBe('sepia');
    expect(getStoredTheme()).toBe('sepia');
  });

  it('falls back to light when storage missing or invalid', () => {
    expect(getStoredTheme()).toBe('light');
    localStorage.setItem('ai-team-theme', 'mystery');
    expect(getStoredTheme()).toBe('light');
  });

  it('renders children and provides current theme via context', () => {
    function Reader() {
      const { theme, setTheme } = useTheme();
      return (
        <button data-testid="reader" onClick={() => setTheme('nord')}>
          {theme}
        </button>
      );
    }
    render(
      <ThemeProvider initialTheme="dark">
        <Reader />
      </ThemeProvider>
    );
    const btn = screen.getByTestId('reader');
    expect(btn.textContent).toBe('dark');
    fireEvent.click(btn);
    expect(btn.textContent).toBe('nord');
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
    expect(localStorage.getItem('ai-team-theme')).toBe('nord');
  });
});

describe('V107 ThemeSwitcher', () => {
  it('renders 4 theme options', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme-option-light')).toBeTruthy();
    expect(screen.getByTestId('theme-option-dark')).toBeTruthy();
    expect(screen.getByTestId('theme-option-sepia')).toBeTruthy();
    expect(screen.getByTestId('theme-option-nord')).toBeTruthy();
  });

  it('clicking an option switches active theme', () => {
    render(
      <ThemeProvider initialTheme="light">
        <ThemeSwitcher />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByTestId('theme-option-nord'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
    expect(localStorage.getItem('ai-team-theme')).toBe('nord');
  });

  it('marks the active theme with aria-pressed=true', () => {
    render(
      <ThemeProvider initialTheme="sepia">
        <ThemeSwitcher />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme-option-sepia').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('theme-option-light').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('V107 Design primitives', () => {
  it('Card renders title, children, and accepts variant', () => {
    render(<Card title="summary" variant="outlined">body</Card>);
    expect(screen.getByText('summary')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('Button handles click and disabled state', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>go</Button>);
    fireEvent.click(screen.getByText('go'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button onClick={onClick} disabled>go</Button>);
    fireEvent.click(screen.getByText('go'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Badge renders tone variants', () => {
    const { container } = render(
      <div>
        <Badge tone="success">ok</Badge>
        <Badge tone="warning">warn</Badge>
        <Badge tone="danger">err</Badge>
        <Badge tone="info">info</Badge>
      </div>
    );
    expect(container.textContent).toContain('ok');
    expect(container.textContent).toContain('warn');
    expect(container.textContent).toContain('err');
    expect(container.textContent).toContain('info');
  });

  it('EmptyState shows title, description, and CTA', () => {
    render(
      <EmptyState
        title="还没有候选人"
        description="添加第一位候选人开启招聘流程"
        actionLabel="+ 新建"
        onAction={() => {}}
      />
    );
    expect(screen.getByText('还没有候选人')).toBeTruthy();
    expect(screen.getByText('添加第一位候选人开启招聘流程')).toBeTruthy();
    expect(screen.getByText('+ 新建')).toBeTruthy();
  });

  it('Skeleton renders placeholder div with given lines', () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.querySelectorAll('[data-skeleton-line]').length).toBe(3);
  });

  it('Tabs switches active tab on click', () => {
    render(
      <Tabs
        items={[
          { id: 'a', label: 'A', content: 'panel-A' },
          { id: 'b', label: 'B', content: 'panel-B' },
        ]}
      />
    );
    expect(screen.getByText('panel-A')).toBeTruthy();
    expect(screen.queryByText('panel-B')).toBeNull();
    fireEvent.click(screen.getByText('B'));
    expect(screen.getByText('panel-B')).toBeTruthy();
  });

  it('Stat shows label and value', () => {
    render(<Stat label="候选人" value={42} suffix="人" />);
    expect(screen.getByText('候选人')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('人')).toBeTruthy();
  });

  it('Section renders heading and children', () => {
    render(<Section title="概览">content-here</Section>);
    expect(screen.getByText('概览')).toBeTruthy();
    expect(screen.getByText('content-here')).toBeTruthy();
  });

  it('Tooltip shows on hover via title attribute fallback', () => {
    render(<Tooltip content="hint"><span data-testid="tip-target">hover me</span></Tooltip>);
    expect(screen.getByTestId('tip-target').getAttribute('title')).toBe('hint');
  });

  it('Popover toggles open and closes on outside click', () => {
    render(
      <div>
        <Popover trigger={<button data-testid="pop-trigger">open</button>} content={<div>body</div>} />
        <div data-testid="outside">outside</div>
      </div>
    );
    expect(screen.queryByText('body')).toBeNull();
    fireEvent.click(screen.getByTestId('pop-trigger'));
    expect(screen.getByText('body')).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('body')).toBeNull();
  });

  it('Drawer renders title, slides in, and closes via overlay + Esc', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Drawer open={true} onClose={onClose} title="details">drawer-body</Drawer>
    );
    expect(screen.getByText('details')).toBeTruthy();
    expect(screen.getByText('drawer-body')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Drawer open={false} onClose={onClose} title="details">drawer-body</Drawer>);
    expect(screen.queryByText('drawer-body')).toBeNull();
  });

  it('Sheet is a bottom-anchored drawer variant', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="bottom">
        <div data-testid="sheet-content">content</div>
      </Sheet>
    );
    expect(screen.getByTestId('sheet-content')).toBeTruthy();
    expect(screen.getByText('bottom')).toBeTruthy();
  });
});

describe('V107 Navigation groups', () => {
  it('PRIMARY_NAV_GROUPS has 4 groups: recruitment / members / intelligence / system', () => {
    expect(PRIMARY_NAV_GROUPS.length).toBe(4);
    const keys = PRIMARY_NAV_GROUPS.map((g) => g.key);
    expect(keys).toEqual(['recruitment', 'members', 'intelligence', 'system']);
  });

  it('resolveNavGroups keeps all 19 routes under the 4 groups', () => {
    const groups = resolveNavGroups();
    const total = groups.reduce((acc, g) => acc + g.items.length, 0);
    // V202: added /eval-dashboard → 18.
    // V203: added /privacy-override-log → 19.
    expect(total).toBe(19);
  });

  it('every nav item has a path, label, and testId', () => {
    for (const g of PRIMARY_NAV_GROUPS) {
      for (const item of g.items) {
        expect(item.path).toMatch(/^\//);
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.testId).toMatch(/^nav-/);
      }
    }
  });
});

describe('V107 AppShell + Sidebar', () => {
  it('AppShell renders sidebar, topbar, and main centered', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppShell>
            <div data-testid="content">main-body</div>
          </AppShell>
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('app-sidebar')).toBeTruthy();
    expect(screen.getByTestId('app-topbar')).toBeTruthy();
    expect(screen.getByTestId('app-main-shell')).toBeTruthy();
    expect(screen.getByTestId('app-main-shell').className).toContain('mx-auto');
    expect(screen.getByTestId('content')).toBeTruthy();
  });

  it('Sidebar renders all 4 nav groups and highlights active route', () => {
    render(
      <MemoryRouter initialEntries={['/pipeline']}>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByTestId('nav-group-recruitment')).toBeTruthy();
    expect(screen.getByTestId('nav-group-members')).toBeTruthy();
    expect(screen.getByTestId('nav-group-intelligence')).toBeTruthy();
    expect(screen.getByTestId('nav-group-system')).toBeTruthy();
    const pipelineLink = screen.getByTestId('nav-pipeline');
    expect(pipelineLink.className).toMatch(/bg-brand/);
  });

  it('Topbar exposes title, search trigger, theme switcher, and language switcher slot', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Topbar title="概览" />
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('概览')).toBeTruthy();
    expect(screen.getByTestId('topbar-search-trigger')).toBeTruthy();
    expect(screen.getByTestId('topbar-theme-switcher')).toBeTruthy();
  });
});