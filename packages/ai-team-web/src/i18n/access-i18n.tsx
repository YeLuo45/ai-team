// V130: keyboard + access components i18n + Localized types + bundle

import { WebLocale } from './web-i18n.js';
import { SHORTCUT_PRESETS } from '../components/keyboard/keyboard.js';
import { ROLE_PRESETS } from '../components/access/access.js';

// ---------- Re-exports from existing modules ----------
export {
  KeyboardHelpOverlay,
  SHORTCUT_PRESETS,
  useGlobalShortcuts,
  useKeyboardShortcuts,
  matchShortcut,
} from '../components/keyboard/keyboard.js';

export {
  ROLE_PRESETS,
  hasPermission,
  usePermission,
  useCurrentRole,
  setCurrentRole,
  getCurrentRole,
} from '../components/access/access.js';

export {
  useOnlineStatus,
  useSkipToMain,
  announceToScreenReader,
} from '../components/access/access.js';

// ---------- Localized types ----------
export interface LocalizedShortcut {
  id: string;
  label: string;
  hint: string;
  key: string;
}

export interface LocalizedRole {
  key: string;
  label: string;
  permissions: string[];
}

export interface LocalizedOfflineBanner {
  warning: string;
  dismiss: string;
}

export interface LocalizedAccessBundle {
  locale: WebLocale;
  shortcuts: LocalizedShortcut[];
  roles: LocalizedRole[];
  offline: LocalizedOfflineBanner;
}

// ---------- Shortcut preset translations ----------
const SHORTCUT_PRESET_LABELS: Record<string, Record<WebLocale, string>> = {
  'palette.search': { en: 'Open command palette', 'zh-CN': '打开命令面板', ja: 'コマンドパレットを開く', ko: '명령 팔레트 열기' },
  'help.show': { en: 'Keyboard help', 'zh-CN': '键盘帮助', ja: 'キーボードヘルプ', ko: '키보드 도움말' },
  'palette.focus': { en: 'Instant search', 'zh-CN': '即时搜索', ja: 'インスタント検索', ko: '즉시 검색' },
  'nav.recruitment': { en: 'Recruitment group', 'zh-CN': '招聘分组', ja: '採用グループ', ko: '채용 그룹' },
  'nav.members': { en: 'Members group', 'zh-CN': '成员分组', ja: 'メンバーグループ', ko: '구성원 그룹' },
  'nav.intelligence': { en: 'Intelligence group', 'zh-CN': '智能分组', ja: 'インテリジェンスグループ', ko: '인텔리전스 그룹' },
  'nav.system': { en: 'System group', 'zh-CN': '系统分组', ja: 'システムグループ', ko: '시스템 그룹' },
  'go.candidate': { en: 'Candidates', 'zh-CN': '候选人', ja: '候補者', ko: '후보자' },
  'go.interview': { en: 'Interviews', 'zh-CN': '面试', ja: '面接', ko: '면접' },
  'go.pipeline': { en: 'Pipeline', 'zh-CN': '漏斗', ja: 'パイプライン', ko: '파이프라인' },
  'go.member': { en: 'Members', 'zh-CN': '成员', ja: 'メンバー', ko: '구성원' },
  'go.audit': { en: 'Audit', 'zh-CN': '审计', ja: '監査', ko: '감사' },
};

export function localizeShortcutPreset(preset: { id: string; key: string; hint?: string; meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean }, locale: WebLocale): LocalizedShortcut {
  const labels = SHORTCUT_PRESET_LABELS[preset.id];
  return {
    id: preset.id,
    label: labels?.[locale] ?? preset.id,
    hint: preset.hint ?? preset.key,
    key: preset.key,
  };
}

export function buildI18nShortcutPresets(locale: WebLocale, presets: Array<{ id: string; key: string; hint?: string }> = SHORTCUT_PRESETS): LocalizedShortcut[] {
  return presets.map((p) => localizeShortcutPreset(p, locale));
}

// ---------- Role preset translations ----------
const ROLE_PRESET_LABELS: Record<string, Record<WebLocale, string>> = {
  admin: { en: 'Admin', 'zh-CN': '管理员', ja: '管理者', ko: '관리자' },
  manager: { en: 'Manager', 'zh-CN': '经理', ja: 'マネージャー', ko: '매니저' },
  interviewer: { en: 'Interviewer', 'zh-CN': '面试官', ja: '面接官', ko: '면접관' },
  viewer: { en: 'Viewer', 'zh-CN': '只读', ja: '読み取り', ko: '읽기 전용' },
};

export function localizeRolePreset(role: { key: string; label: string; permissions: string[] }, locale: WebLocale): LocalizedRole {
  const labels = ROLE_PRESET_LABELS[role.key];
  return {
    key: role.key,
    label: labels?.[locale] ?? role.label,
    permissions: role.permissions,
  };
}

export function buildI18nRolePresets(locale: WebLocale, presets: typeof ROLE_PRESETS = ROLE_PRESETS): LocalizedRole[] {
  return presets.map((r) => localizeRolePreset(r, locale));
}

// ---------- Offline banner copy ----------
const OFFLINE_BANNER_COPY: Record<WebLocale, LocalizedOfflineBanner> = {
  en: { warning: '⚠️ You are offline. Some features may be unavailable.', dismiss: 'Got it' },
  'zh-CN': { warning: '⚠️ 当前离线，部分功能可能不可用', dismiss: '知道了' },
  ja: { warning: '⚠️ オフラインです。一部機能が利用できない場合があります。', dismiss: '了解' },
  ko: { warning: '⚠️ 오프라인 상태입니다. 일부 기능을 사용할 수 없습니다.', dismiss: '확인' },
};

export function buildI18nOfflineBannerCopy(locale: WebLocale): LocalizedOfflineBanner {
  return OFFLINE_BANNER_COPY[locale] ?? OFFLINE_BANNER_COPY.en;
}

// ---------- Convenience accessors ----------
export function tKeyboardHelp(shortcutId: string, locale: WebLocale): string {
  return SHORTCUT_PRESET_LABELS[shortcutId]?.[locale] ?? shortcutId;
}

export function tRoleBadgeLabel(roleKey: string, locale: WebLocale): string {
  return ROLE_PRESET_LABELS[roleKey]?.[locale] ?? roleKey;
}

export function tOfflineBanner(locale: WebLocale): LocalizedOfflineBanner {
  return buildI18nOfflineBannerCopy(locale);
}

// ---------- Bundle ----------
export function buildLocalizedAccessBundle(locale: WebLocale): LocalizedAccessBundle {
  return {
    locale,
    shortcuts: buildI18nShortcutPresets(locale),
    roles: buildI18nRolePresets(locale),
    offline: buildI18nOfflineBannerCopy(locale),
  };
}