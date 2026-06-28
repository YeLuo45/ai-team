// V133: TeamOrchestrationConsole is now a 1-line wrapper around ConsoleShell.
// The 773-line monolith is fully replaced. Legacy 9-test suite (team-orchestration-console.test.tsx)
// is removed and replaced by the 14-test parity suite in orchestration-shell-v132.test.tsx.

import { ConsoleShell } from '../components/orchestration/index.js';

export default function TeamOrchestrationConsole() {
  return <ConsoleShell />;
}