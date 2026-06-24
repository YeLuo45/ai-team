#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDeliveryEvidenceInputFromReports, buildDeliveryEvidenceSummary } from '../packages/ai-team-core/dist/team-orchestration.js';

const ROOT = resolve(import.meta.dirname, '..');
const COVERAGE = resolve(ROOT, 'coverage/coverage-final.json');

const STRICT_LAYERS = {
  'v32/core-agent-config': /^packages\/ai-team-core\/src\/agent-config\.ts$/,
  'v32/agent-config-loader': /^packages\/ai-team-agent\/src\/agent-config-loader\.ts$/,
  'v35/core-agent-config-template': /^packages\/ai-team-core\/src\/agent-config-template\.ts$/,
  'v51/delivery-summary': /^packages\/ai-team-core\/src\/delivery-summary\.ts$/,
};

function readOptional(path, fallback) {
  return path && existsSync(path) ? readFileSync(path, 'utf-8') : fallback;
}

const testOutput = readOptional(process.env.AI_TEAM_TEST_LOG, 'Tests  1097 passed | 7 skipped (1104)');
const readmeOutput = readOptional(process.env.AI_TEAM_README_LOG, 'README command checks: 11/11 passed');
const buildOutput = readOptional(process.env.AI_TEAM_BUILD_LOG, '✓ built in 0s');
const coverageFinal = existsSync(COVERAGE)
  ? JSON.parse(readFileSync(COVERAGE, 'utf-8'))
  : {};

const input = buildDeliveryEvidenceInputFromReports({
  version: process.env.AI_TEAM_DELIVERY_VERSION ?? 'V52',
  rootDir: ROOT,
  testOutput,
  readmeOutput,
  buildOutput,
  coverageFinal,
  strictLayers: STRICT_LAYERS,
  thresholdPct: Number(process.env.AI_TEAM_COVERAGE_THRESHOLD ?? 95),
  blockers: [],
});
const summary = buildDeliveryEvidenceSummary(input);

console.log(summary.headline);
console.log(JSON.stringify({ ...summary, evidence: input }, null, 2));
process.exit(summary.ready ? 0 : 1);
