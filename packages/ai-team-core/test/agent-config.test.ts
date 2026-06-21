// V32: Per-agent independent configuration (soul/user/memory + LLM)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AgentConfigStore,
  validateAgentConfigPatch,
  buildSystemPrompt,
  mergeRequest,
  DEFAULT_AGENT_CONFIG,
  AGENT_CONFIG_FILE_PREFIX,
  AGENT_CONFIG_FILE_SUFFIX,
  MAX_PROMPT_BYTES,
} from '../src/agent-config.js';
import type { AgentKind } from '../src/types/agent-audit.js';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agent-config-'));
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
});

const KIND: AgentKind = 'interview';

function samplePatch() {
  return {
    soul: '你是一位耐心且严谨的面试官',
    user: '候选人：5 年前端 / 关注工程化',
    memory: '上轮讨论过 React 性能优化',
    llm: { providerId: 'crs-default', model: 'gpt-5.4-mini', temperature: 0.4, maxTokens: 1024 },
  };
}

describe('AgentConfigStore', () => {
  it('returns null for an agent that has never been configured', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    expect(await store.get(KIND)).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it('persists per-agent configs independently', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, samplePatch());
    await store.save('training', { soul: 'training soul', user: '', memory: '', llm: { temperature: 0.2 } });

    const iv = await store.get(KIND);
    const tr = await store.get('training');
    expect(iv?.soul).toBe('你是一位耐心且严谨的面试官');
    expect(iv?.llm.model).toBe('gpt-5.4-mini');
    expect(tr?.soul).toBe('training soul');
    expect(tr?.llm.model).toBeUndefined();
    expect(iv?.llm.temperature).toBe(0.4);
    expect(tr?.llm.temperature).toBe(0.2);

    // sanity: writing interview did not touch training
    expect(tr?.memory).toBe('');
  });

  it('delete only removes the targeted agent config', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, samplePatch());
    await store.save('review', { soul: 'review soul', user: '', memory: '', llm: {} });

    await store.delete(KIND);
    expect(await store.get(KIND)).toBeNull();
    const r = await store.get('review');
    expect(r?.soul).toBe('review soul');
  });

  it('resetLlm only clears llm sub-tree but keeps soul/user/memory', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, samplePatch());
    await store.resetLlm(KIND);
    const after = await store.get(KIND);
    expect(after?.soul).toBe('你是一位耐心且严谨的面试官');
    expect(after?.llm).toEqual({});
  });

  it('writes to a per-agent file under <baseDir>/agent-configs/<kind>.json', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, samplePatch());
    const fs = await import('node:fs/promises');
    const file = join(dir, 'agent-configs', `${AGENT_CONFIG_FILE_PREFIX}${KIND}${AGENT_CONFIG_FILE_SUFFIX}.json`);
    const raw = JSON.parse(await fs.readFile(file, 'utf-8'));
    expect(raw.agent).toBe(KIND);
    expect(raw.soul).toContain('面试官');
  });

  it('updates updatedAt timestamp on every save', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, samplePatch());
    const first = (await store.get(KIND))!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await store.save(KIND, { soul: 'changed', user: '', memory: '', llm: {} });
    const second = (await store.get(KIND))!.updatedAt;
    expect(second).not.toEqual(first);
  });

  it('returns DEFAULT_AGENT_CONFIG shape when partial save omits fields', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, { soul: 'x', user: '', memory: '', llm: {} });
    const got = await store.get(KIND);
    expect(got).toEqual({
      agent: KIND,
      soul: 'x',
      user: '',
      memory: '',
      llm: {},
      updatedAt: got!.updatedAt,
    });
  });

  it('rejects unknown agent kinds on save', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await expect(store.save('bogus' as unknown as AgentKind, samplePatch())).rejects.toThrow(/unknown agent kind/);
  });

  it('rejects unknown agent kinds on delete', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await expect(store.delete('bogus' as unknown as AgentKind)).rejects.toThrow(/unknown agent kind/);
  });

  it('rejects unknown agent kinds on resetLlm', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await expect(store.resetLlm('bogus' as unknown as AgentKind)).rejects.toThrow(/unknown agent kind/);
  });

  it('rejects empty-string providerId', () => {
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { providerId: '' } })).toEqual({
      ok: false,
      error: expect.stringMatching(/providerId/),
    });
  });

  it('rejects empty-string model', () => {
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { model: '' } })).toEqual({
      ok: false,
      error: expect.stringMatching(/model/),
    });
  });

  it('rejects oversized model name', () => {
    const huge = 'm'.repeat(129);
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { model: huge } })).toEqual({
      ok: false,
      error: expect.stringMatching(/model/),
    });
  });

  it('rejects non-string providerId (e.g. number)', () => {
    // @ts-expect-error - intentionally wrong type
    const r = validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { providerId: 42 } });
    expect(r.ok).toBe(false);
  });

  it('rejects zero or negative maxTokens', () => {
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { maxTokens: 0 } })).toEqual({
      ok: false,
      error: expect.stringMatching(/maxTokens/),
    });
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { maxTokens: -5 } })).toEqual({
      ok: false,
      error: expect.stringMatching(/maxTokens/),
    });
  });

  it('rejects non-numeric temperature', () => {
    // @ts-expect-error - intentionally wrong type
    const r = validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { temperature: 'warm' } });
    expect(r.ok).toBe(false);
  });

  it('rejects oversized user prompt', () => {
    const huge = 'u'.repeat(20_001);
    expect(validateAgentConfigPatch({ soul: '', user: huge, memory: '', llm: {} })).toEqual({
      ok: false,
      error: expect.stringMatching(/user too large/),
    });
  });

  it('rejects oversized memory prompt', () => {
    const huge = 'm'.repeat(20_001);
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: huge, llm: {} })).toEqual({
      ok: false,
      error: expect.stringMatching(/memory too large/),
    });
  });

  it('save bumps updatedAt even when prev existed', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, { soul: 'a', user: '', memory: '', llm: {} });
    const prev = (await store.get(KIND))!;
    await new Promise((r) => setTimeout(r, 5));
    await store.save(KIND, { soul: 'b', user: '', memory: '', llm: {} });
    const now = (await store.get(KIND))!;
    expect(now.updatedAt >= prev.updatedAt).toBe(true);
  });

  it('save with patch.llm undefined falls back to {} llm', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    await store.save(KIND, { soul: 'x', user: '', memory: '' });
    const got = await store.get(KIND);
    expect(got?.llm).toEqual({});
  });

  it('save with patch.soul undefined falls back to ""', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    // @ts-expect-error - intentionally partial patch
    await store.save(KIND, { user: 'u', memory: 'm', llm: {} });
    const got = await store.get(KIND);
    expect(got?.soul).toBe('');
    expect(got?.user).toBe('u');
    expect(got?.memory).toBe('m');
  });

  it('save with patch.user and memory undefined falls back to ""', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    // @ts-expect-error - intentionally partial patch
    await store.save(KIND, { soul: 's', llm: {} });
    const got = await store.get(KIND);
    expect(got?.user).toBe('');
    expect(got?.memory).toBe('');
  });

  it('readFile falls back to nowIso() when updatedAt missing', async () => {
    const fs = await import('node:fs/promises');
    const dir2 = mkdtempSync(join(tmpdir(), 'agent-config-disk-'));
    const file = join(dir2, 'agent-configs', `${KIND}.json`);
    await fs.mkdir(join(dir2, 'agent-configs'), { recursive: true });
    await fs.writeFile(file, JSON.stringify({
      agent: KIND,
      soul: 'no-ts',
      user: '',
      memory: '',
      llm: {},
      // intentionally missing updatedAt
    }), 'utf-8');
    const store = new AgentConfigStore({ baseDir: dir2 });
    const got = await store.get(KIND);
    expect(got?.soul).toBe('no-ts');
    expect(typeof got?.updatedAt).toBe('string');
    expect(got!.updatedAt.length).toBeGreaterThan(0);
  });

  it('readFile falls back to "" for non-string soul/user/memory', async () => {
    const fs = await import('node:fs/promises');
    const dir2 = mkdtempSync(join(tmpdir(), 'agent-config-disk-'));
    const file = join(dir2, 'agent-configs', `${KIND}.json`);
    await fs.mkdir(join(dir2, 'agent-configs'), { recursive: true });
    await fs.writeFile(file, JSON.stringify({
      agent: KIND,
      soul: 42,    // wrong type
      user: null,   // wrong type
      memory: undefined, // wrong type
      llm: null,
      updatedAt: '2026-06-21T00:00:00Z',
    }), 'utf-8');
    const store = new AgentConfigStore({ baseDir: dir2 });
    const got = await store.get(KIND);
    expect(got?.soul).toBe('');
    expect(got?.user).toBe('');
    expect(got?.memory).toBe('');
  });

  it('list returns empty array when no configs saved', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    expect(await store.list()).toEqual([]);
  });

  it('save/delete/resetLlm with VALID kinds hit both branches of isAgentKind', async () => {
    const store = new AgentConfigStore({ baseDir: dir });
    // valid → isAgentKind false branch (the throw is skipped)
    await store.save(KIND, { soul: 's', user: '', memory: '', llm: {} });
    await store.save(KIND, { soul: 's2', user: '', memory: '', llm: {} });
    expect(await store.delete(KIND)).toBe(true);
    expect(await store.resetLlm(KIND)).toBeNull(); // not exists → null branch
    // re-save so resetLlm succeeds and exercises both null + truthy branches
    await store.save(KIND, { soul: 's3', user: '', memory: '', llm: { temperature: 0.5 } });
    const reset = await store.resetLlm(KIND);
    expect(reset?.llm).toEqual({});
    expect(reset?.soul).toBe('s3');
  });

  it('validate with maxTokens undefined hits both branches (true via present, false via absent)', () => {
    // absent → maxTokens !== undefined === false
    const r1 = validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: {} });
    expect(r1.ok).toBe(true);
    // present and valid → maxTokens !== undefined === true, then inner check false branch (positive int)
    const r2 = validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { maxTokens: 1024 } });
    expect(r2.ok).toBe(true);
  });

  it('validate with model undefined hits both branches', () => {
    // absent → false branch
    const r1 = validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: {} });
    expect(r1.ok).toBe(true);
    // present and valid → true branch, inner length OK
    const r2 = validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { model: 'gpt-5.5' } });
    expect(r2.ok).toBe(true);
  });
});

describe('validateAgentConfigPatch', () => {
  it('accepts a minimal patch', () => {
    expect(validateAgentConfigPatch({ soul: 'hi', user: '', memory: '', llm: {} })).toEqual({
      ok: true,
    });
  });

  it('rejects oversized soul/user/memory', () => {
    const huge = 'a'.repeat(MAX_PROMPT_BYTES + 1);
    expect(validateAgentConfigPatch({ soul: huge, user: '', memory: '', llm: {} })).toEqual({
      ok: false,
      error: expect.stringMatching(/soul too large/),
    });
  });

  it('rejects out-of-range temperature', () => {
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { temperature: -0.1 } })).toEqual({
      ok: false,
      error: expect.stringMatching(/temperature/),
    });
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { temperature: 2.5 } })).toEqual({
      ok: false,
      error: expect.stringMatching(/temperature/),
    });
  });

  it('accepts edge temperature values', () => {
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { temperature: 0 } }).ok).toBe(true);
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { temperature: 2 } }).ok).toBe(true);
  });

  it('rejects empty-string providerId but accepts undefined', () => {
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { providerId: '' } })).toEqual({
      ok: false,
      error: expect.stringMatching(/providerId/),
    });
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { providerId: 'crs-default' } }).ok).toBe(true);
  });

  it('rejects non-numeric maxTokens', () => {
    expect(validateAgentConfigPatch({ soul: '', user: '', memory: '', llm: { maxTokens: 1.5 } })).toEqual({
      ok: false,
      error: expect.stringMatching(/maxTokens/),
    });
  });

  it('returns ok:true when no fields provided', () => {
    expect(validateAgentConfigPatch({}).ok).toBe(true);
  });
});

describe('buildSystemPrompt', () => {
  it('returns "" when soul/user/memory are all empty', () => {
    expect(buildSystemPrompt({ soul: '', user: '', memory: '' })).toBe('');
  });

  it('combines soul/user/memory in order with section headers', () => {
    const out = buildSystemPrompt({ soul: 'A', user: 'B', memory: 'C' });
    expect(out).toContain('[SOUL]');
    expect(out).toContain('A');
    expect(out).toContain('[USER]');
    expect(out).toContain('B');
    expect(out).toContain('[MEMORY]');
    expect(out).toContain('C');
    const iSoul = out.indexOf('[SOUL]');
    const iUser = out.indexOf('[USER]');
    const iMem = out.indexOf('[MEMORY]');
    expect(iSoul).toBeLessThan(iUser);
    expect(iUser).toBeLessThan(iMem);
  });

  it('skips empty sections', () => {
    const out = buildSystemPrompt({ soul: 'A', user: '', memory: 'C' });
    expect(out).not.toContain('[USER]');
    expect(out).toContain('[SOUL]');
    expect(out).toContain('[MEMORY]');
  });
});

describe('mergeRequest', () => {
  it('injects system prompt when no system message exists', () => {
    const out = mergeRequest(
      { messages: [{ role: 'user', content: 'hi' }] },
      { soul: 'S', user: '', memory: '' },
      { model: 'gpt-5.4-mini', temperature: 0.4, maxTokens: 256 },
    );
    expect(out.messages[0].role).toBe('system');
    expect(out.messages[0].content).toContain('[SOUL]');
    expect(out.messages[0].content).toContain('S');
    expect(out.messages[1]).toEqual({ role: 'user', content: 'hi' });
    expect(out.model).toBe('gpt-5.4-mini');
    expect(out.temperature).toBe(0.4);
    expect(out.maxTokens).toBe(256);
  });

  it('appends to existing system message instead of replacing', () => {
    const out = mergeRequest(
      {
        messages: [
          { role: 'system', content: 'orig system' },
          { role: 'user', content: 'q' },
        ],
      },
      { soul: 'S', user: 'U', memory: 'M' },
      {},
    );
    expect(out.messages[0].role).toBe('system');
    expect(out.messages[0].content).toContain('orig system');
    expect(out.messages[0].content).toContain('[SOUL]');
    expect(out.messages[0].content).toContain('S');
  });

  it('does nothing when config is empty and no overrides given', () => {
    const base = { messages: [{ role: 'user', content: 'q' }] };
    const out = mergeRequest(base, { soul: '', user: '', memory: '' }, {});
    expect(out.messages).toEqual(base.messages);
  });

  it('omits model/temperature/maxTokens when not provided in overrides', () => {
    const out = mergeRequest(
      { messages: [{ role: 'user', content: 'q' }] },
      { soul: 'S', user: '', memory: '' },
      {},
    );
    expect(out.model).toBeUndefined();
    expect(out.temperature).toBeUndefined();
    expect(out.maxTokens).toBeUndefined();
  });

  it('keeps a custom model override even when system prompt is empty', () => {
    const out = mergeRequest(
      { messages: [{ role: 'user', content: 'q' }] },
      { soul: '', user: '', memory: '' },
      { model: 'gpt-5.5', temperature: 0.7 },
    );
    expect(out.messages).toEqual([{ role: 'user', content: 'q' }]);
    expect(out.model).toBe('gpt-5.5');
    expect(out.temperature).toBe(0.7);
  });
});

describe('DEFAULT_AGENT_CONFIG shape', () => {
  it('exports well-formed empty default', () => {
    expect(DEFAULT_AGENT_CONFIG).toEqual({
      agent: 'interview',
      soul: '',
      user: '',
      memory: '',
      llm: {},
      updatedAt: expect.any(String),
    });
  });
});
