// V107: AppShell integration — Sidebar (4 groups) + Topbar (search/theme) + centered Main
// V108: replaces the flat 17-NavLink horizontal header with grouped sidebar nav
// V120: AppSseBootstrap + HamburgerNav + OfflineBanner + OnboardingTour production wiring

import { Routes, Route } from 'react-router-dom';
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
import AgentReviewConsole from './pages/AgentReviewConsole';
import AgentConfig from './pages/AgentConfig';
import TeamOrchestrationConsole from './pages/TeamOrchestrationConsole';
import { ToastProvider } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { AppShell, ThemeProvider } from './components/design-system';
import { AppSseBootstrap } from './components/sse';
import { HamburgerNav, MobileBottomBar, OfflineBanner } from './components/mobile';
import { OnboardingTour } from './components/onboarding';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppSseBootstrap>
          <AppShell>
            <HamburgerNav />
            <OfflineBanner />
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
              <Route path="/agents" element={<AgentReviewConsole />} />
              <Route path="/agent-config" element={<AgentConfig />} />
              <Route path="/orchestration" element={<TeamOrchestrationConsole />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/data" element={<Data />} />
            </Routes>
            <MobileBottomBar />
          </AppShell>
          <CommandPalette />
          <OnboardingTour />
        </AppSseBootstrap>
      </ToastProvider>
    </ThemeProvider>
  );
}