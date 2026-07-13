// V107: AppShell integration — Sidebar (4 groups) + Topbar (search/theme) + centered Main
// V108: replaces the flat 17-NavLink horizontal header with grouped sidebar nav
// V120: AppSseBootstrap + HamburgerNav + OfflineBanner + OnboardingTour production wiring
// V127: ConsoleShell replaces /orchestration + A11yAuditBadge in Topbar + skip-to-main
// V133: removed /orchestration-legacy fallback (773-line monolith is now a 1-line wrapper)

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
import { EvalDashboard } from './pages/EvalDashboard';
import { PrivacyOverrideLogPage } from './pages/PrivacyOverrideLogPage';
// V133: TeamOrchestrationConsole is now a 1-line wrapper around ConsoleShell
// (kept the import for backward compatibility with any external consumers)
import TeamOrchestrationConsole from './pages/TeamOrchestrationConsole';
void TeamOrchestrationConsole; // legacy shim — re-export kept in case any import expects the symbol
import { ToastProvider } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { AppShell, ThemeProvider } from './components/design-system';
import { AppSseBootstrap } from './components/sse';
import { HamburgerNav, MobileBottomBar, OfflineBanner } from './components/mobile';
import { OnboardingTour } from './components/onboarding';
import { ConsoleShell } from './components/orchestration';
import { A11yGateProvider, AppAccessibilityRoot } from './components/a11y';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <A11yGateProvider>
          <AppSseBootstrap>
            <AppShell>
              <AppAccessibilityRoot targetId="app-main-shell">
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
                  <Route path="/eval-dashboard" element={<EvalDashboard />} />
                  <Route path="/privacy-override-log" element={<PrivacyOverrideLogPage />} />
                  <Route path="/agents" element={<AgentReviewConsole />} />
                  <Route path="/agent-config" element={<AgentConfig />} />
                  <Route
                    path="/orchestration"
                    element={<ConsoleShell />}
                  />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/data" element={<Data />} />
                </Routes>
                <MobileBottomBar />
              </AppAccessibilityRoot>
            </AppShell>
            <CommandPalette />
            <OnboardingTour />
          </AppSseBootstrap>
        </A11yGateProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}