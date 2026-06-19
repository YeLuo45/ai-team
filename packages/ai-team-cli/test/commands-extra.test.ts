// Integration tests that invoke CLI action handlers

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

// Mock console.log to suppress output
const mockLog = () => vi.spyOn(console, 'log').mockImplementation(() => {});
const mockErr = () => vi.spyOn(console, 'error').mockImplementation(() => {});

function createRealProgram() {
  const commands: any[] = [];
  const make = (name: string) => {
    const cmd: any = {
      _name: name,
      _options: [] as any[],
      _action: null as any,
      description: vi.fn().mockReturnThis(),
      option: vi.fn((flag: string, desc: string, fn?: any) => {
        if (typeof fn === 'function') cmd._options.push({ flag, parser: fn });
        else cmd._options.push({ flag });
        return cmd;
      }),
      requiredOption: vi.fn().mockReturnThis(),
      action: vi.fn((fn: any) => {
        cmd._action = fn;
        return cmd;
      }),
      alias: vi.fn().mockReturnThis(),
      command: vi.fn((subname: string) => make(subname)),
    };
    commands.push(cmd);
    return cmd;
  };
  const program: any = make('program');
  // Override command to not be tracked
  program.command = vi.fn((name: string) => {
    const c = make(name);
    commands.push(c);
    return c;
  });
  return { program, commands };
}

function findSubcommand(commands: any[], parentName: string, subName: string) {
  const parent = commands.find((c) => c._name === parentName);
  if (!parent) return null;
  // Subcommands are added via parent.command(subName)
  return commands.find((c) => c._name === subName);
}

function findAction(commands: any[], subName: string) {
  // Find by suffix match (since some commands have args)
  const sub = commands.find((c) => c._name === subName || c._name?.startsWith(subName + ' '));
  return sub?._action;
}

describe('CLI candidate action handlers', () => {
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

  it('candidate add action creates candidate', async () => {
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'add');
    expect(action).toBeDefined();
    await action('Alice', { position: 'Dev', email: 'a@e.com', source: 'linkedin', tags: 'React,TS' });
    const data = JSON.parse(await fs.readFile(path.join(dir, 'candidates.json'), 'utf-8'));
    expect(data.length).toBe(1);
    expect(data[0].name).toBe('Alice');
    log.mockRestore();
  });

  it('candidate add with invalid source exits', async () => {
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const err = mockErr();
    const orig = process.exit;
    process.exit = vi.fn() as any;
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'add');
    await action('X', { source: 'invalid_source' });
    expect(process.exit).toHaveBeenCalledWith(1);
    process.exit = orig;
    err.mockRestore();
  });

  it('candidate list shows results', async () => {
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerCandidateCommands(program);
    const action = findAction(commands, 'list');
    expect(action).toBeDefined();
    await action({ status: 'all' });
    log.mockRestore();
  });
});

describe('CLI member action handlers', () => {
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

  it('member add action creates member', async () => {
    const { registerMemberCommands } = await import('../src/commands/member.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerMemberCommands(program);
    const action = findAction(commands, 'add');
    await action('Alice', { role: 'Dev', team: 'T', level: 'P6', status: 'active' });
    const data = JSON.parse(await fs.readFile(path.join(dir, 'members.json'), 'utf-8'));
    expect(data.length).toBe(1);
    expect(data[0].name).toBe('Alice');
    log.mockRestore();
  });

  it('member list shows results', async () => {
    const { registerMemberCommands } = await import('../src/commands/member.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerMemberCommands(program);
    const action = findAction(commands, 'list');
    expect(action).toBeDefined();
    await action({});
    log.mockRestore();
  });
});

describe('CLI team action handlers', () => {
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

  it('team overview shows stats', async () => {
    const { registerTeamCommands } = await import('../src/commands/team.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerTeamCommands(program);
    const action = findAction(commands, 'overview');
    expect(action).toBeDefined();
    await action({});
    log.mockRestore();
  });
});

describe('CLI interview action handlers', () => {
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

  it('interview list shows results', async () => {
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerInterviewCommands(program);
    const action = findAction(commands, 'list');
    expect(action).toBeDefined();
    await action({});
    log.mockRestore();
  });
});
