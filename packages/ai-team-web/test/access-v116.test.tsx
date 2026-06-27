// V116: RBAC + PWA + a11y (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  hasPermission,
  usePermission,
  useCurrentRole,
  RoleBadge,
  PermissionGate,
  setCurrentRole,
  getCurrentRole,
  ROLE_PRESETS,
  resolvePermissions,
  isValidRole,
  useOnlineStatus,
  useSkipToMain,
  announceToScreenReader,
  ariaLiveRegion,
} from '../src/components/access/index.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- hasPermission ----------
describe('V116 hasPermission', () => {
  it('admin has all permissions', () => {
    expect(hasPermission('admin', 'candidate.delete')).toBe(true);
    expect(hasPermission('admin', 'pipeline.advance')).toBe(true);
    expect(hasPermission('admin', 'approval.decide')).toBe(true);
  });

  it('manager can read + write but not delete candidates', () => {
    expect(hasPermission('manager', 'candidate.create')).toBe(true);
    expect(hasPermission('manager', 'candidate.delete')).toBe(false);
    expect(hasPermission('manager', 'pipeline.advance')).toBe(true);
  });

  it('interviewer can interview but not decide approvals', () => {
    expect(hasPermission('interviewer', 'interview.create')).toBe(true);
    expect(hasPermission('interviewer', 'approval.decide')).toBe(false);
  });

  it('viewer is read-only', () => {
    expect(hasPermission('viewer', 'candidate.read')).toBe(true);
    expect(hasPermission('viewer', 'candidate.create')).toBe(false);
    expect(hasPermission('viewer', 'candidate.delete')).toBe(false);
  });
});

// ---------- resolvePermissions / ROLE_PRESETS ----------
describe('V116 role resolution', () => {
  it('ROLE_PRESETS defines 4 roles', () => {
    expect(ROLE_PRESETS.length).toBe(4);
    const keys = ROLE_PRESETS.map((r) => r.key);
    expect(keys).toEqual(['admin', 'manager', 'interviewer', 'viewer']);
  });

  it('resolvePermissions returns array for known role', () => {
    expect(resolvePermissions('admin').length).toBeGreaterThan(0);
    expect(resolvePermissions('manager').length).toBeGreaterThan(0);
  });

  it('resolvePermissions returns [] for unknown role', () => {
    expect(resolvePermissions('unknown')).toEqual([]);
  });

  it('isValidRole accepts canonical names', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
    expect(isValidRole('foo')).toBe(false);
    expect(isValidRole(null)).toBe(false);
  });
});

// ---------- setCurrentRole / getCurrentRole ----------
describe('V116 current role persistence', () => {
  it('getCurrentRole defaults to admin', () => {
    expect(getCurrentRole()).toBe('admin');
  });

  it('setCurrentRole persists to localStorage', () => {
    setCurrentRole('manager');
    expect(getCurrentRole()).toBe('manager');
  });

  it('falls back to admin for invalid role', () => {
    localStorage.setItem('ai-team-role', 'mystery');
    expect(getCurrentRole()).toBe('admin');
  });
});

// ---------- usePermission / useCurrentRole ----------
describe('V116 usePermission hook', () => {
  it('returns true for permitted action', () => {
    function Probe() {
      const ok = usePermission('candidate.read');
      return <div data-testid="result">{String(ok)}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('result').textContent).toBe('true');
  });

  it('returns false for non-permitted action', () => {
    setCurrentRole('viewer');
    function Probe() {
      const ok = usePermission('candidate.delete');
      return <div data-testid="result">{String(ok)}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('result').textContent).toBe('false');
  });
});

describe('V116 useCurrentRole hook', () => {
  it('returns current role', () => {
    setCurrentRole('manager');
    function Probe() {
      const role = useCurrentRole();
      return <div data-testid="role">{role}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('role').textContent).toBe('manager');
  });
});

// ---------- RoleBadge ----------
describe('V116 RoleBadge', () => {
  it('renders role name', () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByTestId('role-badge').getAttribute('data-role')).toBe('admin');
    expect(screen.getByTestId('role-badge').textContent).toContain('管理员');
  });

  it('uses different tone per role', () => {
    const { container: admin } = render(<RoleBadge role="admin" />);
    expect(admin.querySelector('[data-tone="danger"]')).toBeTruthy();
    const { container: viewer } = render(<RoleBadge role="viewer" />);
    expect(viewer.querySelector('[data-tone="neutral"]')).toBeTruthy();
  });
});

// ---------- PermissionGate ----------
describe('V116 PermissionGate', () => {
  it('renders children when role has permission', () => {
    render(
      <PermissionGate permission="candidate.read">
        <div data-testid="gate-child">visible</div>
      </PermissionGate>
    );
    expect(screen.getByTestId('gate-child')).toBeTruthy();
  });

  it('renders fallback when role lacks permission', () => {
    setCurrentRole('viewer');
    render(
      <PermissionGate permission="candidate.delete" fallback={<div data-testid="locked">locked</div>}>
        <div data-testid="gate-child">visible</div>
      </PermissionGate>
    );
    expect(screen.queryByTestId('gate-child')).toBeNull();
    expect(screen.getByTestId('locked')).toBeTruthy();
  });

  it('renders nothing when no fallback', () => {
    setCurrentRole('viewer');
    const { container } = render(
      <PermissionGate permission="candidate.delete">
        <div data-testid="gate-child">visible</div>
      </PermissionGate>
    );
    expect(container.querySelector('[data-testid="gate-child"]')).toBeNull();
  });
});

// ---------- useOnlineStatus ----------
describe('V116 useOnlineStatus', () => {
  it('returns navigator.onLine by default', () => {
    function Probe() {
      const online = useOnlineStatus();
      return <div data-testid="online">{String(online)}</div>;
    }
    render(<Probe />);
    expect(['true', 'false']).toContain(screen.getByTestId('online').textContent);
  });

  it('responds to offline event', async () => {
    const { _setOnlineStateForTest } = await import('../src/components/access/access.js');
    function Probe() {
      const online = useOnlineStatus();
      return <div data-testid="online">{String(online)}</div>;
    }
    render(<Probe />);
    act(() => _setOnlineStateForTest(false));
    expect(screen.getByTestId('online').textContent).toBe('false');
    act(() => _setOnlineStateForTest(true));
    expect(screen.getByTestId('online').textContent).toBe('true');
  });
});

// ---------- useSkipToMain ----------
describe('V116 useSkipToMain', () => {
  it('renders skip link', () => {
    function Probe() {
      useSkipToMain('app-main-shell');
      return null;
    }
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>
    );
    const link = screen.getByTestId('skip-to-main');
    expect(link.getAttribute('href')).toBe('#app-main-shell');
    expect(link.textContent).toMatch(/跳到主内容/);
  });
});

// ---------- Screen reader announce ----------
describe('V116 screen reader announce', () => {
  it('announceToScreenReader creates aria-live region', () => {
    announceToScreenReader('Saved', 'polite');
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).toBeTruthy();
    expect(region?.textContent).toContain('Saved');
  });

  it('ariaLiveRegion returns existing region for politeness level', () => {
    const a = ariaLiveRegion('assertive');
    const b = ariaLiveRegion('assertive');
    expect(a).toBe(b);
  });

  it('different politeness levels produce different regions', () => {
    const a = ariaLiveRegion('polite');
    const b = ariaLiveRegion('assertive');
    expect(a).not.toBe(b);
  });
});