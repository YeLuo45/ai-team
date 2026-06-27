// V118: HamburgerNav + MobileBottomBar + OfflineBanner

import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PRIMARY_NAV_GROUPS } from '../design-system/nav-groups.js';
import { Drawer } from '../design-system/primitives.js';
import { isMobileViewport } from './viewport.js';
import { useOnlineStatus } from '../access/access.js';

export function HamburgerNav() {
  const [open, setOpen] = useState(false);
  const mobile = isMobileViewport();

  useEffect(() => {
    if (!mobile) setOpen(false);
  }, [mobile]);

  if (!mobile) return null;

  return (
    <>
      <button
        data-testid="hamburger-button"
        onClick={() => setOpen(true)}
        aria-label="打开导航"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
      >
        ☰
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="导航"
        width="sm"
        testId="mobile-nav-drawer"
      >
        <nav aria-label="移动导航" className="space-y-4">
          {PRIMARY_NAV_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>{group.icon}</span>
                <span>{group.label}</span>
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      data-testid={`mobile-nav-${item.path.replace(/\//g, '') || 'overview'}`}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center rounded-md px-3 py-2 text-sm ${
                          isActive
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button
            data-testid="mobile-nav-close"
            onClick={() => setOpen(false)}
            className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            关闭
          </button>
        </nav>
      </Drawer>
    </>
  );
}

const QUICK_ACTIONS = [
  { path: '/', label: '概览', icon: '🏠', testId: 'overview' },
  { path: '/candidates', label: '候选人', icon: '👤', testId: 'candidates' },
  { path: '/interviews', label: '面试', icon: '🎤', testId: 'interviews' },
  { path: '/pipeline', label: '漏斗', icon: '📊', testId: 'pipeline' },
  { path: '/notifications', label: '通知', icon: '🔔', testId: 'notifications' },
];

export function MobileBottomBar() {
  if (!isMobileViewport()) return null;
  return (
    <nav
      aria-label="底部快捷导航"
      data-testid="mobile-bottom-bar"
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-slate-200 bg-white py-1 dark:border-slate-700 dark:bg-slate-900 lg:hidden"
    >
      {QUICK_ACTIONS.map((a) => (
        <NavLink
          key={a.path}
          to={a.path}
          end={a.path === '/'}
          data-testid={`mobile-bottom-${a.testId}`}
          className={({ isActive }) =>
            `flex flex-col items-center px-2 py-1 text-xs ${
              isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-slate-600 dark:text-slate-400'
            }`
          }
        >
          <span className="text-lg">{a.icon}</span>
          <span>{a.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const OFFLINE_DISMISS_KEY = 'ai-team-offline-dismissed';

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(OFFLINE_DISMISS_KEY) === '1';
  });

  function dismiss() {
    setDismissed(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(OFFLINE_DISMISS_KEY, '1');
    }
  }

  if (online || dismissed) return null;

  return (
    <div
      data-testid="offline-banner"
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900"
    >
      <span>⚠️ 当前离线，部分功能可能不可用</span>
      <button
        data-testid="offline-banner-dismiss"
        onClick={dismiss}
        className="rounded border border-amber-400 bg-white px-2 py-1 text-xs text-amber-700"
      >
        知道了
      </button>
    </div>
  );
}