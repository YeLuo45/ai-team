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
import { Insights } from './pages/Insights';
import Pipeline from './pages/Pipeline';
import Heatmap from './pages/Heatmap';
import AuditConsole from './pages/AuditConsole';
import { ToastProvider } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div data-testid="app-header-shell" className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-6 py-4 lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 text-sm font-bold text-white" onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}>
              ai
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">ai-team</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI 驱动的团队管理 · 按 ⌘K 搜索</p>
            </div>
          </div>
          <nav data-testid="app-primary-nav" className="flex max-w-full flex-wrap items-center justify-center gap-1">
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
            <NavLink to="/insights" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              智能
            </NavLink>
            <NavLink to="/pipeline" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              漏斗
            </NavLink>
            <NavLink to="/heatmap" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              热力图
            </NavLink>
            <NavLink to="/audit" className={({ isActive }) => `btn ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'btn-ghost'}`}>
              审计
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

      <main data-testid="app-main-shell" className="mx-auto max-w-7xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/members" element={<Members />} />
          <Route path="/interviews" element={<Interviews />} />
          <Route path="/skills" element={<SkillGraph />} />
          <Route path="/trainings" element={<Trainings />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/heatmap" element={<Heatmap />} />
          <Route path="/audit" element={<AuditConsole />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/data" element={<Data />} />
        </Routes>
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-900">
        <div data-testid="app-footer-shell" className="mx-auto max-w-7xl px-6 text-center text-xs text-slate-500 dark:text-slate-400">
          ai-team · 基于 pi-mono 架构 · React 19 + Vite 6 + Tailwind 4 · D3.js 7
        </div>
      </footer>
        </div>
        <CommandPalette />
        <SearchTrigger />
    </ToastProvider>
  );
}

function SearchTrigger() {
  // Trigger palette via custom event (decoupled from CommandPalette internals)
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600"
      title="搜索 (⌘K)"
    >
      🔍
    </button>
  );
}
