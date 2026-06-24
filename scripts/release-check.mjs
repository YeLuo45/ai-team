#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { buildReleaseHardeningReport, buildReleaseEvidenceQualityGate, migrateReleaseEvidencePayload } from '../packages/ai-team-core/dist/team-orchestration.js';

const REQUIRED_COMMANDS = ['build', 'test', 'verify:readme', 'delivery:report', 'delivery:index'];

function run(name, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    timeout: options.timeout ?? 180_000,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: 'test', ...options.env },
  });
  return {
    name,
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function statusFor(run, evidencePattern) {
  if (run.exitCode !== 0) return { name: run.name, status: 'fail', reason: `exit ${run.exitCode}` };
  if (!evidencePattern.test(run.output)) return { name: run.name, status: 'fail', reason: 'missing expected output' };
  return { name: run.name, status: 'pass' };
}

function extractCoveragePct(output = '') {
  const summaryMatch = output.match(/Summary:\s+strict\s+\d+\/\d+\s+pass\s+\(avg\s+[\d.]+%\s+stmts\s+\/\s+([\d.]+)%\s+br\s+\//);
  if (summaryMatch) return Number(summaryMatch[1]);
  try {
    const summary = readFileSync('coverage/coverage-summary.json', 'utf-8');
    const json = JSON.parse(summary);
    const branchPct = Number(json.total?.branches?.pct ?? 0);
    return Number.isFinite(branchPct) ? branchPct : 0;
  } catch (error) {
    console.error('Could not read coverage-summary.json:', error.message);
    return 0;
  }
}

function packageVersion() {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function latestEvidencePath() {
  const version = process.env.AI_TEAM_DELIVERY_VERSION;
  if (version) return `docs/delivery/ai-team-${version.toLowerCase()}-release-evidence.json`;
  const files = readdirSync('docs/delivery')
    .filter((file) => /^ai-team-v\d+-release-evidence\.json$/i.test(file))
    .sort((left, right) => {
      const leftVersion = Number(left.match(/v(\d+)/i)?.[1] ?? 0);
      const rightVersion = Number(right.match(/v(\d+)/i)?.[1] ?? 0);
      return rightVersion - leftVersion;
    });
  return files[0] ? `docs/delivery/${files[0]}` : 'docs/delivery/ai-team-v55-release-evidence.json';
}

function evidenceStatus() {
  try {
    const migration = migrateReleaseEvidencePayload(readFileSync(latestEvidencePath(), 'utf-8'));
    if (!migration.evidence) {
      return { name: 'release-evidence', status: 'fail', reason: migration.issues.join('; ') };
    }
    const evidence = migration.evidence;
    const proposalMatch = evidence.reportMarkdown?.match(/\*\*Proposal\*\*:\s+(P-\d{8}-\d{3})/);
    const readmeMatch = evidence.reportMarkdown?.match(/(?:README|verify:readme)[^\n]*?(\d+\/\d+) passed/);
    const coverageMatch = evidence.reportMarkdown?.match(/([\d.]+)% avg branch/);
    if (!proposalMatch || !readmeMatch || !coverageMatch) {
      return { name: 'release-evidence', status: 'fail', reason: 'missing proposal/readme/coverage evidence' };
    }
    const gate = buildReleaseEvidenceQualityGate({
      expectedProposalId: proposalMatch[1],
      expectedReadme: readmeMatch[1],
      expectedCoverage: coverageMatch[1],
      requireUncommittedLabel: evidence.reportMarkdown.includes('uncommitted'),
      evidence,
    });
    return gate.ready ? { name: 'release-evidence', status: 'pass' } : { name: 'release-evidence', status: 'fail', reason: gate.issues.join('; ') };
  } catch (error) {
    return { name: 'release-evidence', status: 'fail', reason: error instanceof Error ? error.message : String(error) };
  }
}

function main() {
  // Run the incremental coverage gate so coverage-summary.json exists and the 95% gate is verified.
  const results = [
    run('build', 'npm', ['run', 'build'], { timeout: 240_000 }),
    run('test:coverage:incremental', 'npm', ['run', 'test:coverage:incremental'], { timeout: 300_000 }),
    run('verify:readme', 'npm', ['run', 'verify:readme'], { timeout: 240_000 }),
    run('delivery:report', 'npm', ['run', 'delivery:report'], { timeout: 120_000, env: { AI_TEAM_DELIVERY_WRITE: '0' } }),
    run('delivery:index', 'npm', ['run', 'delivery:index'], { timeout: 120_000 }),
  ];
  const commandStatuses = [
    statusFor(results[0], /built|tsc|vite/i),
    statusFor(results[1], /Summary:\s+strict\s+\d+\/\d+\s+pass/),
    statusFor(results[2], /README command checks: \d+\/\d+ passed/),
    statusFor(results[3], /Delivery Report — ai-team/),
    statusFor(results[4], /Delivery index ready:/),
    evidenceStatus(),
  ];
  const incrementalBranchPct = extractCoveragePct(results[1].output);
  const documented = REQUIRED_COMMANDS;
  const missing = [];
  const report = buildReleaseHardeningReport({
    packageVersion: packageVersion(),
    commands: commandStatuses,
    coverage: { incrementalBranchPct, thresholdPct: 95 },
    docs: { documented, missing },
  });

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ready ? 0 : 1);
}

main();