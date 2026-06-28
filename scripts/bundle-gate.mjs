#!/usr/bin/env node
// V133: bundle size gate — validates the 773-line monolith is gone
// and the new TeamOrchestrationConsole wrapper is < 20 lines.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = resolve('packages/ai-team-web/src/pages/TeamOrchestrationConsole.tsx');
const threshold = 20;

if (!existsSync(page)) {
  console.log(`bundle gate: FAILED (file missing: ${page})`);
  process.exit(1);
}

const text = readFileSync(page, 'utf-8');
const lines = text.split('\n').length;

if (lines > threshold) {
  console.log(`bundle gate: FAILED (TeamOrchestrationConsole is ${lines} lines, expected <= ${threshold})`);
  process.exit(1);
}

// Validate lazy-loading infrastructure exists
const lazyExists = existsSync('packages/ai-team-web/src/components/lazy/lazy-loading.tsx');
if (!lazyExists) {
  console.log(`bundle gate: FAILED (lazy-loading module missing)`);
  process.exit(1);
}

console.log(`bundle gate: PASSED (TeamOrchestrationConsole=${lines} lines, threshold=${threshold}; lazy-loading=present)`);
process.exit(0);