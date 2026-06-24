import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';

async function loadProgram(): Promise<Command> {
  const { registerDeliveryCommands } = await import('../src/commands/delivery.js');
  const program = new Command();
  program.exitOverride();
  registerDeliveryCommands(program);
  return program;
}

describe('V81 delivery CLI commands', () => {
  let dir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ai-team-delivery-cli-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('migrates release evidence files to schema v2', async () => {
    const file = join(dir, 'evidence.json');
    writeFileSync(file, JSON.stringify({
      version: 'V72',
      summary: { ready: true, headline: 'V72 ready', blockers: [] },
      reportMarkdown: '# R',
      indexMarkdown: '# I',
    }), 'utf-8');

    const program = await loadProgram();
    await program.parseAsync(['node', 'ai-team', 'delivery', 'evidence-migrate', '--file', file]);

    expect(JSON.parse(readFileSync(file, 'utf-8')).schemaVersion).toBe(2);
    expect(logSpy.mock.calls.join('\n')).toContain('changed=true');
  });

  it('supports dry-run without rewriting the evidence file', async () => {
    const file = join(dir, 'evidence.json');
    const original = JSON.stringify({
      version: 'V72',
      summary: { ready: true, headline: 'V72 ready', blockers: [] },
      reportMarkdown: '# R',
      indexMarkdown: '# I',
    });
    writeFileSync(file, original, 'utf-8');

    const program = await loadProgram();
    await program.parseAsync(['node', 'ai-team', 'delivery', 'evidence-migrate', '--file', file, '--dry-run']);

    expect(readFileSync(file, 'utf-8')).toBe(original);
    expect(logSpy.mock.calls.join('\n')).toContain('dryRun=true');
  });

  it('audits a directory of release evidence files and reports migration counts', async () => {
    writeFileSync(join(dir, 'legacy.json'), JSON.stringify({
      version: 'V72',
      summary: { ready: true, headline: 'V72 ready', blockers: [] },
      reportMarkdown: '# R',
      indexMarkdown: '# I',
    }), 'utf-8');
    writeFileSync(join(dir, 'current.json'), JSON.stringify({
      schemaVersion: 2,
      version: 'V81',
      summary: { ready: true, headline: 'V81 ready', blockers: [] },
      reportMarkdown: '# R',
      indexMarkdown: '# I',
    }), 'utf-8');

    const program = await loadProgram();
    await program.parseAsync(['node', 'ai-team', 'delivery', 'evidence-audit', '--dir', dir]);

    const output = logSpy.mock.calls.join('\n');
    expect(output).toContain('total=2');
    expect(output).toContain('migrated=1');
    expect(output).toContain('current=1');
  });

  it('prints a deterministic CI artifact import command plan', async () => {
    const program = await loadProgram();
    await program.parseAsync([
      'node', 'ai-team', 'delivery', 'ci-artifact-import-plan',
      '--artifact', 'artifacts/release-check.json',
      '--version', 'V94',
      '--output', 'docs/delivery/ai-team-v94-release-evidence.json',
      '--dry-run',
    ]);

    const output = logSpy.mock.calls.join('\n');
    expect(output).toContain('ci artifact import ready commands=1');
    expect(output).toContain('node scripts/import-ci-artifact.mjs --version V94 --artifact artifacts/release-check.json --output docs/delivery/ai-team-v94-release-evidence.json --dry-run');
  });

  it('ingests a CI artifact and writes release evidence JSON', async () => {
    const artifact = join(dir, 'release-check.json');
    const outputPath = join(dir, 'ai-team-v97-release-evidence.json');
    writeFileSync(artifact, JSON.stringify({
      tests: { passed: 1161, total: 1168, skipped: 7 },
      coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.5, thresholdPct: 95 },
      readme: { passed: 15, total: 15 },
      build: { passed: true },
    }), 'utf-8');

    const program = await loadProgram();
    await program.parseAsync([
      'node', 'ai-team', 'delivery', 'ci-artifact-ingest',
      '--artifact', artifact,
      '--version', 'V97',
      '--output', outputPath,
    ]);

    const output = logSpy.mock.calls.join('\n');
    expect(output).toContain('ci artifact ingestion ready dryRun=false');
    expect(output).toContain(`wrote ${outputPath}`);
    expect(JSON.parse(readFileSync(outputPath, 'utf-8')).version).toBe('V97');
  });

  it('prints CI artifact upload bridge commands', async () => {
    const artifact = join(dir, 'release-check.json');
    const outputPath = join(dir, 'ai-team-v100-release-evidence.json');
    writeFileSync(artifact, JSON.stringify({
      tests: { passed: 1164, total: 1171, skipped: 7 },
      coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.3, thresholdPct: 95 },
      readme: { passed: 14, total: 14 },
      build: { passed: true },
    }), 'utf-8');

    const program = await loadProgram();
    await program.parseAsync([
      'node', 'ai-team', 'delivery', 'ci-artifact-upload-bridge',
      '--artifact', artifact,
      '--version', 'V100',
      '--output', outputPath,
      '--target', 'release-asset',
    ]);

    const output = logSpy.mock.calls.join('\n');
    expect(output).toContain('ci artifact upload bridge ready target=release-asset');
    expect(output).toContain('gh release upload v100');
  });

  it('prints release operations history, provenance, and replay diff commands', async () => {
    const evidenceDir = join(dir, 'delivery');
    mkdirSync(evidenceDir);
    writeFileSync(join(evidenceDir, 'ai-team-v101-release-evidence.json'), JSON.stringify({
      version: 'V101',
      generatedAt: '2026-06-25T00:00:00Z',
      summary: { ready: true, headline: 'V101 ready' },
      reportMarkdown: '**Proposal**: P-20260625-001',
    }), 'utf-8');

    const program = await loadProgram();
    await program.parseAsync(['node', 'ai-team', 'delivery', 'release-operations-history', '--dir', evidenceDir]);
    await program.parseAsync([
      'node', 'ai-team', 'delivery', 'ci-artifact-provenance',
      '--version', 'V102',
      '--artifact-name', 'release-check.json',
      '--sha256', 'a'.repeat(64),
      '--commit', '7d7cf06',
      '--workflow-run-id', '123456789',
      '--signer', 'github-actions',
      '--generated-at', '2026-06-25T00:00:00Z',
    ]);
    await program.parseAsync([
      'node', 'ai-team', 'delivery', 'proposal-replay-diff',
      '--proposal-id', 'P-20260625-001',
      '--before', 'accepted',
      '--after', 'accepted,deployed,delivered',
    ]);

    const output = logSpy.mock.calls.join('\n');
    expect(output).toContain('release operations history latest=V101 ready=1 blocked=0');
    expect(output).toContain('provenance ready subject=release-check.json@aaaaaaaaaaaa');
    expect(output).toContain('proposal replay diff changed=true added=2 removed=0');
  });

  it('prints guarded proposal execution commands without running them', async () => {
    const program = await loadProgram();
    await program.parseAsync([
      'node', 'ai-team', 'delivery', 'proposal-execute-plan',
      '--proposal-id', 'P-20260624-010',
      '--project-path', '/home/hermes/projects/ai-team',
      '--deployment-url', 'https://yeluo45.github.io/ai-team/',
      '--report-path', 'docs/delivery/v96-delivery-report.md',
      '--evidence-note', 'strict 16/16 pass',
      '--current-status', 'in_dev',
      '--confirm', 'EXECUTE P-20260624-010',
    ]);

    const output = logSpy.mock.calls.join('\n');
    expect(output).toContain('ready=true');
    expect(output).toContain('update-proposal-fields');
    expect(output).toContain('--status delivered');
  });
});
