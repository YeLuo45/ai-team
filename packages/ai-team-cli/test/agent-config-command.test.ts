// V35: agent-config CLI command tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';

let dir = '';
let originalDataDir: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agcfg-cli-'));
  originalDataDir = process.env.AI_TEAM_DATA_DIR;
  process.env.AI_TEAM_DATA_DIR = dir;
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.AI_TEAM_DATA_DIR;
  else process.env.AI_TEAM_DATA_DIR = originalDataDir;
  vi.restoreAllMocks();
});

async function loadCommand(): Promise<Command> {
  vi.resetModules();
  const program = new Command();
  program.exitOverride();
  const mod = await import('../src/commands/agent-config.js');
  mod.registerAgentConfigCommands(program);
  return program;
}

describe('ai-team agent-config CLI', () => {
  it('presets lists built-in presets', async () => {
    const program = await loadCommand();
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m) => { logs.push(String(m)); });
    await program.parseAsync(['node', 'ai-team', 'agent-config', 'presets']);
    const out = logs.join('\n');
    expect(out).toContain('default');
    expect(out).toContain('hr-friendly');
    expect(out).toContain('strict-interviewer');
  });

  it('export prints empty envelope when nothing configured', async () => {
    const program = await loadCommand();
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m) => { logs.push(String(m)); });
    await program.parseAsync(['node', 'ai-team', 'agent-config', 'export']);
    const out = logs.join('\n');
    const env = JSON.parse(out);
    expect(env.version).toBe('v1');
    expect(env.agents).toEqual([]);
  });

  it('apply <preset> writes configs and is observable via next export', async () => {
    const program = await loadCommand();
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((m) => { logs.push(String(m)); });
    await program.parseAsync(['node', 'ai-team', 'agent-config', 'apply', 'hr-friendly']);

    // re-load and export to confirm it persisted
    const program2 = new Command();
    program2.exitOverride();
    const mod = await import('../src/commands/agent-config.js');
    mod.registerAgentConfigCommands(program2);
    const logs2: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((m) => { logs2.push(String(m)); });
    await program2.parseAsync(['node', 'ai-team', 'agent-config', 'export']);
    const env = JSON.parse(logs2.join('\n'));
    expect(env.agents.length).toBeGreaterThan(0);
    expect(env.agents.find((a: { agent: string }) => a.agent === 'interview')).toBeTruthy();
  });

  it('apply --dry-run does NOT persist', async () => {
    const program = await loadCommand();
    vi.spyOn(console, 'log').mockImplementation(() => { /* swallow */ });
    await program.parseAsync(['node', 'ai-team', 'agent-config', 'apply', 'hr-friendly', '--dry-run']);

    const program2 = new Command();
    program2.exitOverride();
    const mod = await import('../src/commands/agent-config.js');
    mod.registerAgentConfigCommands(program2);
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((m) => { logs.push(String(m)); });
    await program2.parseAsync(['node', 'ai-team', 'agent-config', 'export']);
    const env = JSON.parse(logs.join('\n'));
    expect(env.agents).toEqual([]);
  });

  it('apply with unknown preset exits with code 1', async () => {
    const program = await loadCommand();
    vi.spyOn(console, 'log').mockImplementation(() => { /* swallow */ });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* swallow */ });
    await expect(program.parseAsync(['node', 'ai-team', 'agent-config', 'apply', 'bogus']))
      .rejects.toThrow(/process\.exit/);
    expect(errSpy).toHaveBeenCalled();
  });
});
