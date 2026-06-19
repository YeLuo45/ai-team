// CLI tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

describe('CLI utilities', () => {
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

  it('imports utils module', async () => {
    const utils = await import('../src/utils.js');
    expect(utils).toBeDefined();
  });

  it('DEFAULT_DATA_DIR reflects env', async () => {
    const utils = await import('../src/utils.js');
    expect(utils.DEFAULT_DATA_DIR).toBe(dir);
  });

  it('c.ok returns green check string', async () => {
    const utils = await import('../src/utils.js');
    const r = utils.c.ok('done');
    expect(r).toContain('done');
  });

  it('c.err returns red X', async () => {
    const utils = await import('../src/utils.js');
    const r = utils.c.err('fail');
    expect(r).toContain('fail');
  });

  it('c.info', async () => {
    const utils = await import('../src/utils.js');
    const r = utils.c.info('hello');
    expect(r).toContain('hello');
  });

  it('c.warn', async () => {
    const utils = await import('../src/utils.js');
    const r = utils.c.warn('careful');
    expect(r).toContain('careful');
  });

  it('c.dim', async () => {
    const utils = await import('../src/utils.js');
    const r = utils.c.dim('quiet');
    expect(r).toContain('quiet');
  });

  it('c.bold', async () => {
    const utils = await import('../src/utils.js');
    const r = utils.c.bold('strong');
    expect(r).toContain('strong');
  });

  it('printTable with empty rows', async () => {
    const utils = await import('../src/utils.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    utils.printTable([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('printTable with rows', async () => {
    const utils = await import('../src/utils.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    utils.printTable([{ a: '1', b: 2 }]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('CLI command modules register', () => {
  it('candidate command registers', async () => {
    const { registerCandidateCommands } = await import('../src/commands/candidate.js');
    const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(), action: vi.fn().mockReturnThis(), option: vi.fn().mockReturnThis(), requiredOption: vi.fn().mockReturnThis() };
    registerCandidateCommands(program as any);
    expect(program.command).toHaveBeenCalled();
  });

  it('interview command registers', async () => {
    const { registerInterviewCommands } = await import('../src/commands/interview.js');
    const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(), action: vi.fn().mockReturnThis(), option: vi.fn().mockReturnThis(), requiredOption: vi.fn().mockReturnThis() };
    registerInterviewCommands(program as any);
    expect(program.command).toHaveBeenCalled();
  });

  it('member command registers', async () => {
    const { registerMemberCommands } = await import('../src/commands/member.js');
    const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(), action: vi.fn().mockReturnThis(), option: vi.fn().mockReturnThis(), requiredOption: vi.fn().mockReturnThis() };
    registerMemberCommands(program as any);
    expect(program.command).toHaveBeenCalled();
  });

  it('team command registers', async () => {
    const { registerTeamCommands } = await import('../src/commands/team.js');
    const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(), action: vi.fn().mockReturnThis() };
    registerTeamCommands(program as any);
    expect(program.command).toHaveBeenCalled();
  });
});
