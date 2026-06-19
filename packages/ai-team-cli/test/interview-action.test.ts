// CLI interview action tests

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

  it('interview list shows empty', async () => {
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerInterviewCommands(program);
    const action = findAction(commands, 'list');
    expect(action).toBeDefined();
    await action({});
    log.mockRestore();
  });

  it('interview list shows items', async () => {
    // Pre-populate
    await fs.writeFile(
      path.join(dir, 'interviews.json'),
      JSON.stringify([{ id: 'iv1', candidateId: 'c1', position: 'P', type: 'technical', status: 'completed', turns: [], aiConducted: true, startedAt: '2026-01-01', completedAt: '2026-01-01', evaluation: { overall: 80, breakdown: { technical: 80, communication: 80, problemSolving: 80, culture: 80 }, strengths: ['a'], concerns: [], recommendation: 'hire' } }]),
      'utf-8'
    );
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerInterviewCommands(program);
    const action = findAction(commands, 'list');
    await action({});
    log.mockRestore();
  });

  it('interview show shows interview', async () => {
    await fs.writeFile(
      path.join(dir, 'interviews.json'),
      JSON.stringify([{ id: 'iv1', candidateId: 'c1', position: 'P', type: 'technical', status: 'completed', turns: [{ role: 'interviewer', content: 'Q', timestamp: '2026-01-01' }], aiConducted: true, startedAt: '2026-01-01' }]),
      'utf-8'
    );
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerInterviewCommands(program);
    const action = findAction(commands, 'show');
    expect(action).toBeDefined();
    await action('iv1');
    log.mockRestore();
  });

  it.skip('interview show 404 path exits', async () => {
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const err = mockErr();
    const orig = process.exit;
    process.exit = vi.fn() as any;
    const { program, commands } = createRealProgram();
    registerInterviewCommands(program);
    const action = findAction(commands, 'show');
    await action('nonexistent');
    expect(process.exit).toHaveBeenCalledWith(1);
    process.exit = orig;
    err.mockRestore();
  });

  it.skip('interview start with nonexistent candidate exits', async () => {
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const err = mockErr();
    const orig = process.exit;
    process.exit = vi.fn() as any;
    const { program, commands } = createRealProgram();
    registerInterviewCommands(program);
    const action = findAction(commands, 'start');
    expect(action).toBeDefined();
    // Pre-create a candidate
    await fs.writeFile(
      path.join(dir, 'candidates.json'),
      JSON.stringify([{ id: 'ct1', name: 'X', position: 'P', source: 'website', status: 'new', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]),
      'utf-8'
    );
    // Mock readline to prevent hanging
    vi.doMock('node:readline/promises', () => ({
      createInterface: () => ({
        question: () => Promise.resolve(''),
        close: () => {},
      }),
    }));
    await action('ct1', { type: 'technical', maxTurns: '4' });
    vi.doUnmock('node:readline/promises');
    err.mockRestore();
  });
});

describe('CLI member action handlers - list', () => {
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

  it('member list with pre-populated data', async () => {
    await fs.writeFile(
      path.join(dir, 'members.json'),
      JSON.stringify([{ id: 'm1', name: 'X', role: 'R', team: 'T', status: 'active', joinedAt: '2025-01-01' }]),
      'utf-8'
    );
    const { registerMemberCommands } = await import('../src/commands/member.js');
    const log = mockLog();
    const { program, commands } = createRealProgram();
    registerMemberCommands(program);
    const action = findAction(commands, 'list');
    await action({});
    log.mockRestore();
  });
});

describe('CLI team action handlers - list', () => {
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

  it('team overview shows teams', async () => {
    await fs.writeFile(
      path.join(dir, 'members.json'),
      JSON.stringify([{ id: 'm1', name: 'X', role: 'R', team: 'T1', status: 'active', joinedAt: '2025-01-01' }]),
      'utf-8'
    );
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
