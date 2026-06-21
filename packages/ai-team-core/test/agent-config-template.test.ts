// V35: Agent config templates — bulk export / import across all agents
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exportAgentConfigs,
  importAgentConfigs,
  validateTemplateEnvelope,
  BUILTIN_TEMPLATES,
} from '../src/agent-config-template.js';
import { AgentConfigStore } from '../src/agent-config.js';
import type { AgentKind } from '../src/types/agent-audit.js';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agent-template-'));
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
});

describe('BUILTIN_TEMPLATES', () => {
  it('exports at least one preset (default + hr-friendly + strict-interviewer)', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('default');
    expect(ids).toContain('hr-friendly');
    expect(ids).toContain('strict-interviewer');
  });

  it('every preset has a unique id and at least one agent config', () => {
    const seen = new Set<string>();
    for (const t of BUILTIN_TEMPLATES) {
      expect(seen.has(t.id)).toBe(false);
      seen.add(t.id);
      expect(t.agents.length).toBeGreaterThan(0);
      for (const a of t.agents) {
        expect(typeof a.agent).toBe('string');
        expect(typeof a.soul).toBe('string');
        expect(typeof a.user).toBe('string');
        expect(typeof a.memory).toBe('string');
      }
    }
  });

  it('findTemplate returns preset by id', () => {
    expect(BUILTIN_TEMPLATES.find((t) => t.id === 'hr-friendly')).toBeTruthy();
    expect(BUILTIN_TEMPLATES.find((t) => t.id === 'missing')).toBeUndefined();
  });
});

describe('exportAgentConfigs', () => {
  it('exports an empty envelope when nothing configured', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    const env = await exportAgentConfigs(store);
    expect(env.version).toBe('v1');
    expect(env.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(env.agents).toEqual([]);
  });

  it('exports all configured agents', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save('interview' as AgentKind, { soul: 's', user: '', memory: '', llm: { model: 'm' } });
    await store.save('review' as AgentKind, { soul: 'r', user: '', memory: '', llm: {} });
    const env = await exportAgentConfigs(store);
    expect(env.agents).toHaveLength(2);
    const interview = env.agents.find((a) => a.agent === 'interview');
    expect(interview?.llm.model).toBe('m');
  });
});

describe('validateTemplateEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    const env = {
      version: 'v1',
      exportedAt: '2026-06-21T00:00:00Z',
      agents: [{ agent: 'interview', soul: 'a', user: '', memory: '', llm: {} }],
    };
    expect(validateTemplateEnvelope(env).ok).toBe(true);
  });

  it('rejects non-object envelope (null)', () => {
    const r = validateTemplateEnvelope(null);
    expect(r.ok).toBe(false);
  });

  it('rejects non-object envelope (primitive)', () => {
    const r = validateTemplateEnvelope('not-an-object');
    expect(r.ok).toBe(false);
  });

  it('rejects envelope with wrong version', () => {
    const r = validateTemplateEnvelope({ version: 'v99', exportedAt: '', agents: [] });
    expect(r.ok).toBe(false);
  });

  it('rejects envelope with non-string exportedAt', () => {
    const r = validateTemplateEnvelope({ version: 'v1', exportedAt: 42, agents: [] });
    expect(r.ok).toBe(false);
  });

  it('rejects envelope with non-array agents', () => {
    const r = validateTemplateEnvelope({ version: 'v1', exportedAt: '', agents: 'x' as unknown as [] });
    expect(r.ok).toBe(false);
  });

  it('rejects agent entry that is null', () => {
    const r = validateTemplateEnvelope({ version: 'v1', exportedAt: '', agents: [null] });
    expect(r.ok).toBe(false);
  });

  it('rejects agent entry with unknown kind', () => {
    const r = validateTemplateEnvelope({
      version: 'v1', exportedAt: '',
      agents: [{ agent: 'bogus' as AgentKind, soul: '', user: '', memory: '', llm: {} }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects agent entry missing required fields', () => {
    const r = validateTemplateEnvelope({
      version: 'v1', exportedAt: '',
      agents: [{ agent: 'interview' } as unknown as { agent: AgentKind; soul: string; user: string; memory: string; llm: {} }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects agent entry with non-object llm', () => {
    const r = validateTemplateEnvelope({
      version: 'v1', exportedAt: '',
      agents: [{ agent: 'interview', soul: 's', user: '', memory: '', llm: 'oops' as unknown as object }],
    });
    expect(r.ok).toBe(false);
  });
});

describe('importAgentConfigs', () => {
  it('imports every agent from a preset, replacing existing', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save('interview' as AgentKind, { soul: 'old', user: '', memory: '', llm: { model: 'old' } });

    const preset = BUILTIN_TEMPLATES.find((t) => t.id === 'strict-interviewer')!;
    const result = await importAgentConfigs(store, preset);
    expect(result.imported).toBe(preset.agents.length);
    const after = await store.get('interview' as AgentKind);
    expect(after?.soul).not.toBe('old');
  });

  it('refuses to import an invalid envelope', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await expect(importAgentConfigs(store, {
      version: 'v99', exportedAt: '', agents: [],
    })).rejects.toThrow(/version/);
  });

  it('dry-run reports count without writing', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    const preset = BUILTIN_TEMPLATES.find((t) => t.id === 'hr-friendly')!;
    const result = await importAgentConfigs(store, preset, { dryRun: true });
    expect(result.imported).toBe(preset.agents.length);
    expect(result.dryRun).toBe(true);
    const list = await store.list();
    expect(list).toEqual([]);
  });

  it('importAgentConfigs with explicit envelope and dryRun works', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    const env = {
      version: 'v1' as const,
      exportedAt: '2026-06-21T00:00:00Z',
      agents: [{ agent: 'training' as AgentKind, soul: 's', user: '', memory: '', llm: {} }],
    };
    const result = await importAgentConfigs(store, env, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.imported).toBe(1);
    expect(await store.list()).toEqual([]);
  });

  it('findTemplate returns the matching preset and undefined otherwise', async () => {
    const { findTemplate } = await import('../src/agent-config-template.js');
    expect(findTemplate('hr-friendly')?.id).toBe('hr-friendly');
    expect(findTemplate('does-not-exist')).toBeUndefined();
  });
});
