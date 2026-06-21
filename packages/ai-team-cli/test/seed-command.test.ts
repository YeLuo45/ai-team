// V24: Seed CLI command tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';

let dir: string;
let stdout: string[] = [];
let stderr: string[] = [];
let origLog: typeof console.log;
let origErr: typeof console.error;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'seed-cli-'));
  process.env.AI_TEAM_DATA_DIR = dir;
  vi.resetModules();
  stdout = [];
  stderr = [];
  origLog = console.log;
  origErr = console.error;
  console.log = (...args) => stdout.push(args.map(String).join(' '));
  console.error = (...args) => stderr.push(args.map(String).join(' '));
});

afterEach(async () => {
  console.log = origLog;
  console.error = origErr;
  delete process.env.AI_TEAM_DATA_DIR;
  vi.resetModules();
  rmSync(dir, { recursive: true, force: true });
});

async function loadProgram(): Promise<Command> {
  const { registerSeedCommands } = await import('../src/commands/seed.js');
  const program = new Command();
  program.exitOverride();
  registerSeedCommands(program);
  return program;
}

describe('CLI seed commands', () => {
  it('preview prints dataset summary', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'seed', 'preview', '-s', 'small']);
    expect(stdout.some((l) => l.includes('small'))).toBe(true);
    expect(stdout.some((l) => l.includes('候选人'))).toBe(true);
  });

  it('preview rejects invalid size', async () => {
    const p = await loadProgram();
    await expect(p.parseAsync(['node', 'cli', 'seed', 'preview', '-s', 'huge'])).rejects.toBeTruthy();
    expect(stderr.some((l) => l.includes('无效的 size'))).toBe(true);
  });

  it('fill small writes data to disk', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'seed', 'fill', '-s', 'small']);
    expect(stdout.some((l) => l.includes('已填充 small'))).toBe(true);
    expect(stdout.some((l) => l.includes('4 候选人'))).toBe(true);
    // Verify files were created
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(dir, 'candidates.json'))).toBe(true);
    expect(existsSync(join(dir, 'members.json'))).toBe(true);
    expect(existsSync(join(dir, 'skills.json'))).toBe(true);
  });

  it('fill medium prints correct counts', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'seed', 'fill', '-s', 'medium']);
    expect(stdout.some((l) => l.includes('12 候选人'))).toBe(true);
  });

  it('fill rejects invalid size', async () => {
    const p = await loadProgram();
    await expect(p.parseAsync(['node', 'cli', 'seed', 'fill', '-s', 'huge'])).rejects.toBeTruthy();
    expect(stderr.some((l) => l.includes('无效的 size'))).toBe(true);
  });

  it('fill --wipe removes existing data before writing', async () => {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(dir, 'candidates.json'), '[]');
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'seed', 'fill', '-s', 'small', '--wipe']);
    expect(stdout.some((l) => l.includes('已填充 small'))).toBe(true);
    const { readFileSync } = await import('node:fs');
    const parsed = JSON.parse(readFileSync(join(dir, 'candidates.json'), 'utf8'));
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('fill default size is medium when --size omitted', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'seed', 'fill']);
    expect(stdout.some((l) => l.includes('已填充 medium'))).toBe(true);
  });
});