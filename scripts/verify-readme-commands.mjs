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
record('test targeted core', run('npm', ['test', '--', 'packages/ai-team-core/test/team-orchestration.test.ts']), /8 passed/);
record('test targeted server', run('npm', ['test', '--', 'packages/ai-team-server/test/team-orchestration-routes.test.ts']), /23 passed/);

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
