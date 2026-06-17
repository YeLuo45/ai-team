import { Routes, Route, NavLink } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Candidates } from './pages/Candidates';
import { Members } from './pages/Members';
import { Interviews } from './pages/Interviews';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 text-sm font-bold text-white">
              ai
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">ai-team</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI 驱动的团队管理</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              概览
            </NavLink>
            <NavLink to="/candidates" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              候选人
            </NavLink>
            <NavLink to="/members" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              成员
            </NavLink>
            <NavLink to="/interviews" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              面试
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/members" element={<Members />} />
          <Route path="/interviews" element={<Interviews />} />
        </Routes>
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-slate-500 dark:text-slate-400">
          ai-team · 基于 pi-mono 架构 · React 19 + Vite 6 + Tailwind 4
        </div>
      </footer>
    </div>
  );
}
