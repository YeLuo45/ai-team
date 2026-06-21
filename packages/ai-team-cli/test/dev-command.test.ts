// V28: `ai-team dev` command tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { CandidateStore, MemberStore, JsonStore, nowIso } from '@ai-team/core';
import type { Candidate, Skill } from '@ai-team/core';

let dir: string;
let origCwd: string;
let origEnv: string | undefined;
let stdout: string[] = [];
let stderr: string[] = [];
let origLog: typeof console.log;
let origErr: typeof console.error;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dev-cli-'));
  origCwd = process.cwd();
  origEnv = process.env.AI_TEAM_DATA_DIR;
  process.env.AI_TEAM_DATA_DIR = dir;
  vi.resetModules();
  stdout = [];
  stderr = [];
  origLog = console.log;
  origErr = console.error;
  console.log = (...args) => stdout.push(args.map(String).join(' '));
  console.error = (...args) => stderr.push(args.map(String).join(' '));
  // Patch spawn to do nothing (avoid actually starting server/web)
  vi.doMock('node:child_process', async () => {
    const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    return {
      ...actual,
      spawn: vi.fn(() => ({
        pid: 99999,
        on: vi.fn((_ev: string, _cb: () => void) => {}),
        kill: vi.fn(),
      })),
    };
  });
});

afterEach(async () => {
  console.log = origLog;
  console.error = origErr;
  process.chdir(origCwd);
  if (origEnv === undefined) delete process.env.AI_TEAM_DATA_DIR;
  else process.env.AI_TEAM_DATA_DIR = origEnv;
  vi.resetModules();
  vi.doUnmock('node:child_process');
  rmSync(dir, { recursive: true, force: true });
});

async function loadProgram(): Promise<Command> {
  const { registerDevCommands } = await import('../src/commands/dev.js');
  const program = new Command();
  program.exitOverride();
  registerDevCommands(program);
  return program;
}

async function seedFake(dir: string) {
  // pre-create some old candidate so wipe test is meaningful
  writeFileSync(join(dir, 'candidates.json'), '[]');
  const cs = CandidateStore.create(dir);
  await cs.add({
    id: 'ct_old', name: 'Old', position: 'X', source: 'other', status: 'new',
    createdAt: nowIso(), updatedAt: nowIso(),
  } satisfies Candidate);
}

describe('CLI dev command', () => {
  it('seeds small data with --size small', async () => {
    const p = await loadProgram();
    const promise = p.parseAsync(['node', 'cli', 'dev', '-s', 'small', '--no-server', '--no-web']);
    await promise;
    const cs = CandidateStore.create(dir);
    const candidates = await cs.list();
    // SEED_SIZE_SPECS.small = 4 candidates
    expect(candidates.length).toBe(4);
  });

  it('wipes existing data before seeding', async () => {
    await seedFake(dir);
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'dev', '-s', 'small', '--no-server', '--no-web']);
    const cs = CandidateStore.create(dir);
    const ids = (await cs.list()).map((c) => c.id);
    expect(ids).not.toContain('ct_old');
    expect(ids.length).toBe(4);
  });

  it('rejects invalid size', async () => {
    const p = await loadProgram();
    await expect(p.parseAsync(['node', 'cli', 'dev', '-s', 'huge', '--no-server', '--no-web'])).rejects.toBeTruthy();
    expect(stderr.some((l) => l.includes('无效的 size'))).toBe(true);
  });

  it('skips seed when --no-seed', async () => {
    // pre-seed with 2 candidates
    const cs = CandidateStore.create(dir);
    await cs.add({ id: 'ct_keep', name: 'Keep', position: 'X', source: 'other', status: 'new', createdAt: nowIso(), updatedAt: nowIso() });
    await cs.add({ id: 'ct_keep2', name: 'Keep2', position: 'X', source: 'other', status: 'new', createdAt: nowIso(), updatedAt: nowIso() });
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'dev', '--no-seed', '--no-server', '--no-web']);
    const after = await CandidateStore.create(dir).list();
    expect(after.length).toBe(2);
    expect(after.map((c) => c.id).sort()).toEqual(['ct_keep', 'ct_keep2']);
  });

  it('--no-server --no-web just seeds', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'dev', '-s', 'medium', '--no-server', '--no-web']);
    // Verify medium data exists
    const ms = MemberStore.create(dir);
    const ms_list = await ms.list();
    expect(ms_list.length).toBeGreaterThan(0);
  });

  it('seeds large dataset', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'dev', '-s', 'large', '--no-server', '--no-web']);
    const cs = CandidateStore.create(dir);
    // SEED_SIZE_SPECS.large = 30
    expect((await cs.list()).length).toBe(30);
  });
});