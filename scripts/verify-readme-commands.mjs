#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const checks = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    timeout: options.timeout ?? 120_000,
    env: { ...process.env, NODE_ENV: 'test', ...options.env },
  });
  return {
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

function record(name, result, evidencePattern) {
  const evidence = evidencePattern.test(result.output);
  const ok = result.exitCode === 0 && evidence;
  checks.push({
    name,
    command: result.command,
    ok,
    exitCode: result.exitCode,
    evidence: evidence ? 'matched expected output' : 'missing expected output',
  });
}

record('build', run('npm', ['run', 'build'], { timeout: 180_000 }), /built|tsc|vite/i);
record('test targeted core', run('npm', ['test', '--', 'packages/ai-team-core/test/team-orchestration.test.ts']), /12 passed/);
record('test targeted core v42', run('npm', ['test', '--', 'packages/ai-team-core/test/team-orchestration-v42.test.ts']), /5 passed/);
record('test targeted core v45', run('npm', ['test', '--', 'packages/ai-team-core/test/team-orchestration-v45.test.ts']), /22 passed/);
record('test targeted server', run('npm', ['test', '--', 'packages/ai-team-server/test/team-orchestration-routes.test.ts']), /91 passed/);
// V133: 1-line wrapper replaces 773-line monolith. 14-test parity suite in
// orchestration-shell-v132.test.tsx + 7-test page wrapper in
// team-orchestration-page-v133.test.tsx supersede the old 9-test legacy suite.
record('test targeted web shell', run('npm', ['test', '--', 'packages/ai-team-web/test/orchestration-shell-v132.test.tsx']), /14 passed/);
record('test targeted web page v133', run('npm', ['test', '--', 'packages/ai-team-web/test/team-orchestration-page-v133.test.tsx']), /7 passed/);
record('test targeted release ops v104-v106', run('npm', ['test', '--', 'packages/ai-team-core/test/release-ops-v104-v106.test.ts']), /12 passed/);
record('test targeted interview detail v143', run('npm', ['test', '--', 'packages/ai-team-web/test/interview-detail-v143.test.tsx']), /45 passed/);
record('test targeted rounds comparison v144', run('npm', ['test', '--', 'packages/ai-team-web/test/interview-rounds-comparison-v144.test.tsx']), /18 passed/);
record('test targeted candidate interview link v145', run('npm', ['test', '--', 'packages/ai-team-web/test/candidate-interview-link-v145.test.tsx']), /4 passed/);
record('test targeted candidate interview nav v146', run('npm', ['test', '--', 'packages/ai-team-web/test/candidate-interview-nav-v146.test.tsx']), /8 passed/);
record('test targeted org memory wiring', run('npm', ['test', '--', 'packages/ai-team-agent/test/org-memory-wiring.test.ts']), /2 passed/);
record('test targeted org memory inject', run('npm', ['test', '--', 'packages/ai-team-ai/test/org-memory-injection.test.ts']), /7 passed/);
record('test targeted delivery summary', run('npm', ['test', '--', 'packages/ai-team-core/test/delivery-summary-v51.test.ts']), /57 passed/);
record('test targeted delivery cli', run('npm', ['test', '--', 'packages/ai-team-cli/test/delivery-command.test.ts']), /8 passed/);
record('delivery summary', run('npm', ['run', 'delivery:summary']), /V\d+/);
record('delivery report', run('npm', ['run', 'delivery:report'], { env: { AI_TEAM_DELIVERY_WRITE: '0' } }), /Delivery Report — ai-team/);
record('delivery index', run('npm', ['run', 'delivery:index']), /Delivery index ready:/);

// V128: a11y gate check — run in Node via simulated clean document
record('a11y gate', run('node', ['scripts/a11y-gate.mjs'], { timeout: 30_000 }), /a11y gate: PASSED|a11y gate: FAILED/);

// V130: i18n gate check — validates 4 locales with 100+ keys
record('i18n gate', run('node', ['scripts/i18n-gate.mjs'], { timeout: 30_000 }), /i18n gate: PASSED|i18n gate: FAILED/);

// V133: bundle size check — 773-line monolith is gone, file is now <20 lines
record('bundle size gate', run('node', ['scripts/bundle-gate.mjs'], { timeout: 30_000 }), /bundle gate: PASSED|bundle gate: FAILED/);

if (!existsSync('packages/ai-team-server/dist/index.js')) {
  checks.push({ name: 'dev readiness', command: 'npm run dev', ok: false, exitCode: 1, evidence: 'server dist missing' });
} else {
  const server = spawn('node', ['packages/ai-team-server/dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, AI_TEAM_DATA_DIR: `${process.cwd()}/data`, PORT: '3010' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  let output = '';
  try {
    const deadline = Date.now() + 15_000;
    server.stdout.on('data', (chunk) => { output += chunk.toString(); });
    server.stderr.on('data', (chunk) => { output += chunk.toString(); });
    while (Date.now() < deadline && !ready) {
      const response = await fetch('http://127.0.0.1:3010/api/health').catch(() => null);
      if (response?.ok) {
        const body = await response.json();
        ready = body.status === 'ok';
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  } finally {
    server.kill('SIGTERM');
  }
  checks.push({
    name: 'dev readiness',
    command: 'npm run dev (verified via node dist server health probe)',
    ok: ready,
    exitCode: ready ? 0 : 1,
    evidence: ready ? 'GET /api/health returned ok' : output.slice(0, 300),
  });
}

for (const check of checks) {
  const mark = check.ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${check.name}: ${check.command} (${check.evidence})`);
}

const failed = checks.filter((check) => !check.ok);
console.log(`README command checks: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length > 0) process.exit(1);
