// V21: Pipeline CLI command tests (vi.resetModules + dynamic import pattern)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { PipelineStore } from '@ai-team/core';

let dir: string;
let stdout: string[] = [];
let stderr: string[] = [];
let origLog: typeof console.log;
let origErr: typeof console.error;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pipeline-cli-'));
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
  const { registerPipelineCommands } = await import('../src/commands/pipeline.js');
  const program = new Command();
  program.exitOverride();
  registerPipelineCommands(program);
  return program;
}

describe('CLI pipeline commands', () => {
  it('advance creates an entry and prints success', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'sourced']);
    expect(stdout.some((l) => l.includes('候选人 c1') && l.includes('已投递'))).toBe(true);
    const store = PipelineStore.create(dir);
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].stage).toBe('sourced');
  });

  it('advance records previous stage', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'sourced']);
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'screening']);
    const store = PipelineStore.create(dir);
    const all = await store.list();
    const cur = store.currentEntry(all, 'c1');
    expect(cur?.stage).toBe('screening');
    expect(cur?.previousStage).toBe('sourced');
  });

  it('advance with note records note', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'sourced']);
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'screening', '-n', 'phone OK']);
    const store = PipelineStore.create(dir);
    const all = await store.list();
    const cur = store.currentEntry(all, 'c1');
    expect(cur?.note).toBe('phone OK');
  });

  it('advance with invalid stage exits 1', async () => {
    const p = await loadProgram();
    await expect(p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'bogus'])).rejects.toBeTruthy();
    expect(stderr.some((l) => l.includes('无效的 stage'))).toBe(true);
  });

  it('advance defaults to screening when stage omitted', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1']);
    const store = PipelineStore.create(dir);
    const all = await store.list();
    expect(all[0].stage).toBe('screening');
  });

  it('funnel prints funnel report', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'sourced']);
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'screening']);
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c2', '--stage', 'sourced']);
    stdout = [];
    await p.parseAsync(['node', 'cli', 'pipeline', 'funnel']);
    expect(stdout.some((l) => l.includes('招聘漏斗'))).toBe(true);
    expect(stdout.some((l) => l.includes('已投递'))).toBe(true);
    expect(stdout.some((l) => l.includes('整体转化'))).toBe(true);
  });

  it('show lists history', async () => {
    const p = await loadProgram();
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'sourced']);
    await p.parseAsync(['node', 'cli', 'pipeline', 'advance', 'c1', '--stage', 'screening', '--note', 'OK']);
    stdout = [];
    await p.parseAsync(['node', 'cli', 'pipeline', 'show', 'c1']);
    expect(stdout.some((l) => l.includes('已投递'))).toBe(true);
    expect(stdout.some((l) => l.includes('筛选中'))).toBe(true);
    expect(stdout.some((l) => l.includes('OK'))).toBe(true);
  });

  it('show for unknown candidate exits 1', async () => {
    const p = await loadProgram();
    await expect(p.parseAsync(['node', 'cli', 'pipeline', 'show', 'c-unknown'])).rejects.toBeTruthy();
    expect(stderr.some((l) => l.includes('无漏斗记录'))).toBe(true);
  });
});