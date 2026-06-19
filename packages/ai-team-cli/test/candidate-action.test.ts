// More CLI candidate command tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

const mockLog = () => vi.spyOn(console, 'log').mockImplementation(() => {});
const mockErr = () => vi.spyOn(console, 'error').mockImplementation(() => {});

function createRealProgram() {
  const commands: any[] = [];
  const make = (name: string) => {
    const cmd: any = {
      _name: name,
      _action: null as any,
      description: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      requiredOption: vi.fn().mockReturnThis(),
      action: vi.fn((fn: any) => { cmd._action = fn; return cmd; }),
      alias: vi.fn().mockReturnThis(),
      command: vi.fn((subname: string) => {
        const c = make(subname);
        commands.push(c);
        return c;
      }),
    };
    commands.push(cmd);
    return cmd;
  };
  const program: any = make('program');
  program.command = vi.fn((name: string) => {
    const c = make(name);
    commands.push(c);
    return c;
  });
  return { program, commands };
}

function findAction(commands: any[], subName: string) {
  return commands.find((c) => c._name === subName || c._name?.startsWith(subName + ' '))?._action;
}

async function prePopulate(dir: string) {
  await fs.writeFile(
    path.join(dir, 'candidates.json'),
    JSON.stringify([{ id: 'ct1', name: 'X', position: 'P', source: 'website', status: 'new', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]),
    'utf-8'
  );
}

describe('CLI candidate all subcommands', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await createTempDir();
    process.env.AI_TEAM_DATA_DIR = dir;
    vi.resetModules();
  });
  afterEach(async () => {
    delete process.env.AI_TEAM_DATA_DIR;
    vi.resetModules();
    await new Promise((r) => setTimeout(r, 50));
    await cleanupTempDir(dir);
  });

  it.skip('candidate show 404', async () => {
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const err = mockErr();
    const orig = process.exit;
    process.exit = vi.fn() as any;
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'show');
    expect(action).toBeDefined();
    await action('nonexistent');
    expect(process.exit).toHaveBeenCalledWith(1);
    process.exit = orig;
    err.mockRestore();
  });

  it('candidate show found', async () => {
    await prePopulate(dir);
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'show');
    await action('ct1');
    log.mockRestore();
  });

  it.skip('candidate update 404', async () => {
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const err = mockErr();
    const orig = process.exit;
    process.exit = vi.fn() as any;
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'update');
    expect(action).toBeDefined();
    await action('nonexistent', { status: 'interviewing' });
    expect(process.exit).toHaveBeenCalledWith(1);
    process.exit = orig;
    err.mockRestore();
  });

  it('candidate update status', async () => {
    await prePopulate(dir);
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'update');
    await action('ct1', { status: 'interviewing', notes: 'new note' });
    const data = JSON.parse(await fs.readFile(path.join(dir, 'candidates.json'), 'utf-8'));
    expect(data[0].status).toBe('interviewing');
    expect(data[0].notes).toBe('new note');
    log.mockRestore();
  });

  it('candidate list with status filter', async () => {
    await prePopulate(dir);
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'list');
    await action({ status: 'new' });
    log.mockRestore();
  });
});

describe('CLI member all subcommands', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await createTempDir();
    process.env.AI_TEAM_DATA_DIR = dir;
    vi.resetModules();
  });
  afterEach(async () => {
    delete process.env.AI_TEAM_DATA_DIR;
    vi.resetModules();
    await new Promise((r) => setTimeout(r, 50));
    await cleanupTempDir(dir);
  });

  it('member add with all fields', async () => {
    const { registerMemberCommands } = await import('../src/commands/member.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerMemberCommands(program);
    const action = findAction(commands, 'add');
    await action('Alice', { role: 'Dev', team: 'T', level: 'P6', status: 'active', manager: 'Bob' });
    const data = JSON.parse(await fs.readFile(path.join(dir, 'members.json'), 'utf-8'));
    expect(data[0].manager).toBe('Bob');
    log.mockRestore();
  });
});
