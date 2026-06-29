// V138: useShellTabPersist — localStorage persistence + storage event cross-tab sync

import { useCallback, useEffect, useState } from 'react';
import {

  DEFAULT_CONSOLE_TAB,
  type ConsoleTabKey,
  isValidTabKey,
  nextTabKey as _nextTabKey,
  prevTabKey as _prevTabKey,
} from './console-i18n.js';

// ---------- Types ----------
export interface ShellTabPersistConfig {
  storageKey?: string;
  source?: string;
}

export interface ShellTabStorageEvent {
  tab: ConsoleTabKey;
  source: string;
  ts: number;
}

export interface UseShellTabStorageApi {
  tab: ConsoleTabKey;
  set: (next: ConsoleTabKey) => void;
  reset: () => void;
  next: () => void;
  prev: () => void;
}

// ---------- Constants ----------
const DEFAULT_STORAGE_KEY = 'ai-team-shell-tab';
const STORAGE_EVENT_NAME = 'storage';
const DISPATCH_EVENT_NAME = 'ai-team-shell-tab-change';

// ---------- Storage helpers ----------
export function buildShellTabStorageKey(prefix?: string): string {
  return prefix ? `${prefix}-shell-tab` : DEFAULT_STORAGE_KEY;
}

export function parseShellTabStorage(key: string): ConsoleTabKey | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return isValidTabKey(raw) ? raw : null;
}

export function serializeShellTabStorage(key: string, value: ConsoleTabKey): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota */
  }
}

// ---------- Event dispatch ----------
export function dispatchShellTabChange(tab: ConsoleTabKey, source: string): void {
  if (typeof window === 'undefined') return;
  const detail: ShellTabStorageEvent = { tab, source, ts: Date.now() };
  window.dispatchEvent(new CustomEvent<ShellTabStorageEvent>(DISPATCH_EVENT_NAME, { detail }));
}

// ---------- useShellTabStorage ----------
export function useShellTabStorage(config: ShellTabPersistConfig = {}): UseShellTabStorageApi {
  const storageKey = buildShellTabStorageKey(config.storageKey);
  const source = config.source ?? (typeof window !== 'undefined' ? `tab-${Math.floor(Math.random() * 1e6)}` : 'tab-unknown');

  const [tab, setTab] = useState<ConsoleTabKey>(() => {
    return parseShellTabStorage(storageKey) ?? DEFAULT_CONSOLE_TAB;
  });

  // Persist on every change
  useEffect(() => {
    serializeShellTabStorage(storageKey, tab);
    dispatchShellTabChange(tab, source);
  }, [tab, storageKey, source]);

  // Cross-tab sync via 'storage' event
  useEffect(() => {
    function onStorage(ev: StorageEvent) {
      if (ev.key !== storageKey) return;
      if (ev.newValue && isValidTabKey(ev.newValue) && ev.newValue !== tab) {
        setTab(ev.newValue);
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(STORAGE_EVENT_NAME, onStorage);
      return () => window.removeEventListener(STORAGE_EVENT_NAME, onStorage);
    }
    return undefined;
  }, [storageKey, tab]);

  const set = useCallback((next: ConsoleTabKey) => {
    if (isValidTabKey(next)) setTab(next);
  }, []);

  const reset = useCallback(() => setTab(DEFAULT_CONSOLE_TAB), []);

  const next = useCallback(() => setTab((prev) => _nextTabKey(prev)), []);

  const prev = useCallback(() => setTab((prev) => _prevTabKey(prev)), []);

  return { tab, set, reset, next, prev };
}

// ---------- useShellTabPersist (alias with config) ----------
export function useShellTabPersist(config: ShellTabPersistConfig = {}): UseShellTabStorageApi {
  return useShellTabStorage(config);
}
