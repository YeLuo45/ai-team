import { Routes, Route, NavLink } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Candidates } from './pages/Candidates';
import { Members } from './pages/Members';
import { Interviews } from './pages/Interviews';
import { SkillGraph } from './pages/SkillGraph';
import { Trainings } from './pages/Trainings';
import { Reviews } from './pages/Reviews';
import { Plugins } from './pages/Plugins';
import { Notifications } from './pages/Notifications';
import { Data } from './pages/Data';

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
            <NavLink to="/skills" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              技能
            </NavLink>
            <NavLink to="/trainings" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              培训
            </NavLink>
            <NavLink to="/reviews" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              Review
            </NavLink>
            <NavLink to="/plugins" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              插件
            </NavLink>
            <NavLink to="/notifications" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              通知
            </NavLink>
            <NavLink to="/data" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              数据
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
          <Route path="/skills" element={<SkillGraph />} />
          <Route path="/trainings" element={<Trainings />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/data" element={<Data />} />
        </Routes>
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-slate-500 dark:text-slate-400">
          ai-team · 基于 pi-mono 架构 · React 19 + Vite 6 + Tailwind 4 · D3.js 7
        </div>
      </footer>
    </div>
  );
}
