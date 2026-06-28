// V130: keyboard + access components i18n + i18n gate in verify:readme (RED tests)
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  KeyboardHelpOverlay,
  SHORTCUT_PRESETS,
  useGlobalShortcuts,
  useKeyboardShortcuts,
  matchShortcut,
  ROLE_PRESETS,
  hasPermission,
  usePermission,
  useCurrentRole,
  setCurrentRole,
  getCurrentRole,
  useOnlineStatus,
  useSkipToMain,
  announceToScreenReader,
  buildI18nShortcutPresets,
  buildI18nRolePresets,
  buildI18nOfflineBannerCopy,
  tKeyboardHelp,
  tRoleBadgeLabel,
  tOfflineBanner,
  localizeShortcutPreset,
  localizeRolePreset,
  type LocalizedShortcut,
  type LocalizedRole,
  type LocalizedOfflineBanner,
  buildLocalizedAccessBundle,
} from '../src/i18n/index.js';
import { LocaleProvider, useT, WEB_JA_TRANSLATIONS, WEB_KO_TRANSLATIONS } from '../src/i18n/web-i18n.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------- buildI18nShortcutPresets ----------
describe('V130 buildI18nShortcutPresets', () => {
  it('returns 4 nav-group shortcuts per locale', () => {
    const en = buildI18nShortcutPresets('en');
    const ja = buildI18nShortcutPresets('ja');
    expect(en.length).toBe(ja.length);
    expect(en.length).toBeGreaterThanOrEqual(10);
  });

  it('Japanese labels contain Japanese characters', () => {
    const ja = buildI18nShortcutPresets('ja');
    const nav = ja.find((s) => s.id === 'nav.recruitment');
    expect(nav?.label).toContain('採用');
  });

  it('Korean labels contain Korean characters', () => {
    const ko = buildI18nShortcutPresets('ko');
    const nav = ko.find((s) => s.id === 'nav.recruitment');
    expect(nav?.label).toContain('채용');
  });
});

// ---------- buildI18nRolePresets ----------
describe('V130 buildI18nRolePresets', () => {
  it('returns 4 roles with localized labels', () => {
    const en = buildI18nRolePresets('en');
    const ja = buildI18nRolePresets('ja');
    expect(en.length).toBe(4);
    expect(ja.length).toBe(4);
    expect(ja.find((r) => r.key === 'admin')?.label).toContain('管理者');
    expect(ja.find((r) => r.key === 'viewer')?.label).toContain('読み取り');
  });

  it('Korean labels for roles', () => {
    const ko = buildI18nRolePresets('ko');
    expect(ko.find((r) => r.key === 'manager')?.label).toContain('매니저');
  });
});

// ---------- buildI18nOfflineBannerCopy ----------
describe('V130 buildI18nOfflineBannerCopy', () => {
  it('returns English / Japanese / Korean copy', () => {
    expect(buildI18nOfflineBannerCopy('en').warning).toContain('offline');
    expect(buildI18nOfflineBannerCopy('ja').warning).toContain('オフライン');
    expect(buildI18nOfflineBannerCopy('ko').warning).toContain('오프라인');
  });
});

// ---------- localizeShortcutPreset / localizeRolePreset ----------
describe('V130 localizeShortcutPreset / localizeRolePreset', () => {
  it('localizeShortcutPreset applies locale', () => {
    const preset = SHORTCUT_PRESETS[0]!;
    const en = localizeShortcutPreset(preset, 'en');
    const ja = localizeShortcutPreset(preset, 'ja');
    expect(ja.label).not.toBe(en.label);
  });

  it('localizeRolePreset applies locale', () => {
    const role = ROLE_PRESETS[0]!;
    const en = localizeRolePreset(role, 'en');
    const ja = localizeRolePreset(role, 'ja');
    expect(ja.label).not.toBe(en.label);
  });
});

// ---------- tKeyboardHelp / tRoleBadgeLabel / tOfflineBanner ----------
describe('V130 t* convenience', () => {
  it('tKeyboardHelp returns localized label', () => {
    expect(tKeyboardHelp('palette.search', 'en')).toContain('palette');
    expect(tKeyboardHelp('palette.search', 'ja')).toContain('パレット');
  });

  it('tRoleBadgeLabel returns localized role', () => {
    expect(tRoleBadgeLabel('admin', 'en')).toContain('Admin');
    expect(tRoleBadgeLabel('admin', 'ja')).toContain('管理者');
  });

  it('tOfflineBanner returns localized copy', () => {
    expect(tOfflineBanner('ja').warning).toContain('オフライン');
  });
});

// ---------- buildLocalizedAccessBundle ----------
describe('V130 buildLocalizedAccessBundle', () => {
  it('returns bundle for given locale', () => {
    const bundle = buildLocalizedAccessBundle('ja');
    expect(bundle.locale).toBe('ja');
    expect(bundle.shortcuts.length).toBeGreaterThan(0);
    expect(bundle.roles.length).toBe(4);
    expect(bundle.offline.warning).toContain('オフライン');
  });
});

// ---------- Re-export of existing RBAC + keyboard primitives ----------
describe('V130 re-exports from existing modules', () => {
  it('KeyboardHelpOverlay renders with default presets', () => {
    render(
      <LocaleProvider>
        <KeyboardHelpOverlay open onClose={() => {}} />
      </LocaleProvider>
    );
    expect(screen.getByTestId('keyboard-help')).toBeTruthy();
    const rows = screen.getAllByTestId('shortcut-row');
    expect(rows.length).toBe(SHORTCUT_PRESETS.length);
  });

  it('KeyboardHelpOverlay uses Japanese labels when locale=ja', () => {
    const localized = buildI18nShortcutPresets('ja');
    const labelMap: Record<string, { label: string; hint?: string }> = {};
    for (const s of localized) labelMap[s.id] = { label: s.label, hint: s.hint };
    render(
      <LocaleProvider initialLocale="ja">
        <KeyboardHelpOverlay open onClose={() => {}} localizedLabels={labelMap} />
      </LocaleProvider>
    );
    // Some shortcut label should now be Japanese
    const html = document.body.innerHTML;
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(html);
    expect(hasJapanese).toBe(true);
  });

  it('matchShortcut still works', () => {
    const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    expect(matchShortcut(ev, { key: 'k', meta: true })).toBe(true);
  });

  it('setCurrentRole / getCurrentRole roundtrip', () => {
    setCurrentRole('manager');
    expect(getCurrentRole()).toBe('manager');
  });

  it('hasPermission admin has all perms', () => {
    expect(hasPermission('admin', 'candidate.delete')).toBe(true);
  });

  it('useSkipToMain registers link with targetId', () => {
    function Probe() {
      useSkipToMain('test-target');
      return null;
    }
    render(<Probe />);
    const link = document.querySelector('[data-testid="skip-to-main"]');
    expect(link?.getAttribute('href')).toBe('#test-target');
  });
});

// ---------- Localized types ----------
describe('V130 Localized* types', () => {
  it('LocalizedShortcut has all required fields', () => {
    const s: LocalizedShortcut = { id: 'a', label: 'l', hint: 'h', key: 'k' };
    expect(s.id).toBe('a');
  });

  it('LocalizedRole has key + label', () => {
    const r: LocalizedRole = { key: 'admin', label: '管理员' };
    expect(r.key).toBe('admin');
  });

  it('LocalizedOfflineBanner has warning + dismiss', () => {
    const b: LocalizedOfflineBanner = { warning: '⚠️', dismiss: 'OK' };
    expect(b.warning).toContain('⚠️');
  });
});