// V116: RBAC + PWA + a11y primitives

import { ReactNode, useEffect, useSyncExternalStore } from 'react';
import { Badge } from '../design-system/index.js';

// ---------- RBAC ----------
export type Role = 'admin' | 'manager' | 'interviewer' | 'viewer';

export interface RolePreset {
  key: Role;
  label: string;
  permissions: string[];
}

const PERMISSIONS: Record<Role, string[]> = {
  admin: [
    'candidate.read', 'candidate.create', 'candidate.delete', 'candidate.update',
    'member.read', 'member.create', 'member.delete', 'member.update',
    'interview.read', 'interview.create', 'interview.finalize',
    'pipeline.read', 'pipeline.advance',
    'review.read', 'review.create',
    'training.read', 'training.create',
    'approval.read', 'approval.decide',
    'audit.read',
    'plugin.read', 'plugin.toggle',
    'settings.write',
  ],
  manager: [
    'candidate.read', 'candidate.create', 'candidate.update',
    'member.read', 'member.create', 'member.update',
    'interview.read', 'interview.create', 'interview.finalize',
    'pipeline.read', 'pipeline.advance',
    'review.read', 'review.create',
    'training.read', 'training.create',
    'approval.read',
    'audit.read',
    'plugin.read',
  ],
  interviewer: [
    'candidate.read',
    'interview.read', 'interview.create', 'interview.finalize',
    'member.read',
    'review.read',
  ],
  viewer: [
    'candidate.read',
    'member.read',
    'interview.read',
    'pipeline.read',
    'review.read',
    'training.read',
    'audit.read',
    'plugin.read',
  ],
};

export const ROLE_PRESETS: RolePreset[] = [
  { key: 'admin', label: '管理员', permissions: PERMISSIONS.admin },
  { key: 'manager', label: '经理', permissions: PERMISSIONS.manager },
  { key: 'interviewer', label: '面试官', permissions: PERMISSIONS.interviewer },
  { key: 'viewer', label: '只读', permissions: PERMISSIONS.viewer },
];

const ROLE_STORAGE_KEY = 'ai-team-role';
const VALID_ROLES: Role[] = ['admin', 'manager', 'interviewer', 'viewer'];

export function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (VALID_ROLES as string[]).includes(value);
}

export function resolvePermissions(role: Role): string[] {
  return PERMISSIONS[role] ?? [];
}

export function hasPermission(role: Role, permission: string): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getCurrentRole(): Role {
  if (typeof localStorage === 'undefined') return 'admin';
  const raw = localStorage.getItem(ROLE_STORAGE_KEY);
  return isValidRole(raw) ? raw : 'admin';
}

export function setCurrentRole(role: Role): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-team-role-change', { detail: role }));
  }
}

export function useCurrentRole(): Role {
  const subscribe = (cb: () => void) => {
    window.addEventListener('ai-team-role-change', cb);
    window.addEventListener('storage', cb);
    return () => {
      window.removeEventListener('ai-team-role-change', cb);
      window.removeEventListener('storage', cb);
    };
  };
  const getSnapshot = () => getCurrentRole();
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePermission(permission: string): boolean {
  const role = useCurrentRole();
  return hasPermission(role, permission);
}

// ---------- RoleBadge ----------
export function RoleBadge({ role }: { role: Role }) {
  const tone =
    role === 'admin' ? 'danger' :
    role === 'manager' ? 'info' :
    role === 'interviewer' ? 'success' :
    'neutral';
  const label = ROLE_PRESETS.find((r) => r.key === role)?.label ?? role;
  return (
    <span data-testid="role-badge" data-tone={tone} data-role={role}>
      <Badge tone={tone as 'danger' | 'info' | 'success' | 'neutral'}>{label}</Badge>
    </span>
  );
}

// ---------- PermissionGate ----------
export interface PermissionGateProps {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const ok = usePermission(permission);
  if (!ok) return <>{fallback}</>;
  return <>{children}</>;
}

// ---------- useOnlineStatus (PWA) ----------
let _onlineListeners: Array<() => void> = [];
let _onlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;

function subscribeOnline(cb: () => void): () => void {
  _onlineListeners.push(cb);
  const onEvent = () => {
    _onlineState = navigator.onLine;
    for (const l of _onlineListeners) l();
  };
  window.addEventListener('online', onEvent);
  window.addEventListener('offline', onEvent);
  return () => {
    _onlineListeners = _onlineListeners.filter((l) => l !== cb);
    window.removeEventListener('online', onEvent);
    window.removeEventListener('offline', onEvent);
  };
}

function getOnlineSnapshot(): boolean {
  return _onlineState;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineSnapshot);
}

// ---------- Skip-to-main (a11y) ----------
export function useSkipToMain(targetId: string): void {
  useEffect(() => {
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

// ---------- Screen reader announce ----------
const liveRegions: Record<string, HTMLElement> = {};

function ensureRegion(level: 'polite' | 'assertive'): HTMLElement {
  if (liveRegions[level]) return liveRegions[level];
  const region = document.createElement('div');
  region.setAttribute('aria-live', level);
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';
  document.body.appendChild(region);
  liveRegions[level] = region;
  return region;
}

export function ariaLiveRegion(level: 'polite' | 'assertive'): HTMLElement {
  return ensureRegion(level);
}

export function announceToScreenReader(message: string, level: 'polite' | 'assertive' = 'polite'): void {
  const region = ensureRegion(level);
  region.textContent = message;
}

// Test-only helper: directly mutate the cached online state (used in unit tests
// where happy-dom does not reflect offline events on navigator.onLine).
export function _setOnlineStateForTest(online: boolean): void {
  _onlineState = online;
  for (const l of _onlineListeners) l();
}