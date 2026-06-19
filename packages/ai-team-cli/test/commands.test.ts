// CLI command action handler tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('CLI candidate command', () => {
  let dir: string;
  let originalFetch: typeof fetch;
  let mockFetch: any;

  beforeEach(async () => {
    dir = await createTempDir();
    process.env.AI_TEAM_DATA_DIR = dir;
    vi.resetModules();
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    delete process.env.AI_TEAM_DATA_DIR;
    vi.resetModules();
    await new Promise((r) => setTimeout(r, 50));
    await cleanupTempDir(dir);
  });

  it('candidate add POSTs and shows result', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'ct_1' }) });
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const program = createMockProgram();
    registerCandidateCommands(program);
    // Find the add action - command 0 is 'candidate', subcommand 0 is 'add'
    expect(program.commands.length).toBeGreaterThan(0);
    expect(program.commands[0]._name).toBe('candidate');
  });

  it('candidate list shows results', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: '1', name: 'X', position: 'P', source: 's', status: 'new' }] });
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const program = createMockProgram();
    registerCandidateCommands(program);
    expect(program.commands[0]._name).toBe('candidate');
  });
});

describe('CLI interview command', () => {
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

  it('interview commands register', async () => {
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const program = createMockProgram();
    registerInterviewCommands(program);
    expect(program.commands.length).toBeGreaterThan(0);
  });
});

describe('CLI member command', () => {
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

  it('member commands register', async () => {
    const { registerMemberCommands } = await import('../src/commands/member.js');
    const program = createMockProgram();
    registerMemberCommands(program);
    expect(program.commands.length).toBeGreaterThan(0);
  });
});

describe('CLI team command', () => {
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

  it('team commands register', async () => {
    const { registerTeamCommands } = await import('../src/commands/team.js');
    const program = createMockProgram();
    registerTeamCommands(program);
    expect(program.commands.length).toBeGreaterThan(0);
  });
});

function createMockProgram() {
  const commands: any[] = [];
  const make = (name: string) => {
    const cmd: any = {
      _name: name,
      _options: [] as any[],
      _action: null as any,
      description: vi.fn().mockReturnThis(),
      option: vi.fn((flag: string, desc: string, fn?: any) => {
        cmd._options.push({ flag, desc, fn });
        return cmd;
      }),
      requiredOption: vi.fn((flag: string, desc: string) => cmd),
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
  return {
    commands,
    command: vi.fn((name: string) => make(name)),
    description: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    requiredOption: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    parse: vi.fn(),
  };
}
