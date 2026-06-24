import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
