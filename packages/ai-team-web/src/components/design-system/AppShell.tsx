// V107: AppShell — Sidebar + Topbar + centered Main layout

import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PRIMARY_NAV_GROUPS } from './nav-groups.js';
import { ThemeSwitcher } from './theme.js';

export function Sidebar() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside
      data-testid="app-sidebar"
      className="hidden w-60 shrink-0 border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900 lg:block"
    >
      <nav aria-label="主导航" className="space-y-4">
        {PRIMARY_NAV_GROUPS.map((group) => (
          <div key={group.key} data-testid={`nav-group-${group.key}`}>
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>{group.icon}</span>
              <span>{group.label}</span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    data-testid={item.testId}
                    className={() =>
                      `flex items-center rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isActive(item.path)
                          ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
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
      </nav>
    </aside>
  );
}

export function Topbar({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <header
      data-testid="app-topbar"
      className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div className="flex items-center gap-3">
        <button
          data-testid="topbar-search-trigger"
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          title="搜索 (⌘K)"
        >
          <span>🔍</span>
          <span>搜索 · ⌘K</span>
        </button>
        {title && <h1 className="ml-2 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <ThemeSwitcher />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main
            data-testid="app-main-shell"
            className="mx-auto w-full max-w-7xl flex-1 px-6 py-8"
          >
            {children}
          </main>
          <footer
            data-testid="app-footer-shell"
            className="mx-auto w-full max-w-7xl border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
          >
            ai-team · 基于 pi-mono 架构 · React 19 + Vite 6 + Tailwind 4 · D3.js 7
          </footer>
        </div>
      </div>
    </div>
  );
}