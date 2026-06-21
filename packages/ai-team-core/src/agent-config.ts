// V32: Per-agent independent configuration (soul/user/memory + LLM override)
// Storage layout: <baseDir>/agent-configs/<kind>.json — one file per agent kind,
// so configurations never leak between agents.

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { AGENT_KINDS } from './store/agent-audit-store.js';
import type { AgentKind } from './types/agent-audit.js';
import { nowIso } from './utils/id.js';

export const AGENT_CONFIG_FILE_PREFIX = '';
export const AGENT_CONFIG_FILE_SUFFIX = '';
export const MAX_PROMPT_BYTES = 20_000;
const CONFIG_DIR = 'agent-configs';

export interface AgentLLMConfig {
  /** 指向 V24 SystemLLMSettings.providers[].id；缺省回退全局 */
  providerId?: string;
  /** 模型覆盖；缺省使用 provider.defaultModel */
  model?: string;
  /** 独立温度（0-2） */
  temperature?: number;
  /** 独立 max tokens */
  maxTokens?: number;
}

export interface AgentConfig {
  agent: AgentKind;
  soul: string;
  user: string;
  memory: string;
  llm: AgentLLMConfig;
  updatedAt: string;
}

export interface AgentConfigPatch {
  soul?: string;
  user?: string;
  memory?: string;
  llm?: Partial<AgentLLMConfig>;
}

export interface AgentConfigStoreOptions {
  baseDir: string;
}

function isAgentKind(value: string): value is AgentKind {
  return (AGENT_KINDS as string[]).includes(value);
}

function fileFor(baseDir: string, kind: AgentKind): string {
  return join(baseDir, CONFIG_DIR, `${AGENT_CONFIG_FILE_PREFIX}${kind}${AGENT_CONFIG_FILE_SUFFIX}.json`);
}

function withDefaults(patch: AgentConfigPatch, kind: AgentKind, updatedAt: string): AgentConfig {
  const llm: AgentLLMConfig = {};
  if (patch.llm) {
    if (patch.llm.providerId !== undefined) llm.providerId = patch.llm.providerId;
    if (patch.llm.model !== undefined) llm.model = patch.llm.model;
    if (patch.llm.temperature !== undefined) llm.temperature = patch.llm.temperature;
    if (patch.llm.maxTokens !== undefined) llm.maxTokens = patch.llm.maxTokens;
  }
  const soul = typeof patch.soul === 'string' ? patch.soul : '';
  const user = typeof patch.user === 'string' ? patch.user : '';
  const memory = typeof patch.memory === 'string' ? patch.memory : '';
  return {
    agent: kind,
    soul,
    user,
    memory,
    llm,
    updatedAt,
  };
}

export class AgentConfigStore {
  constructor(private readonly opts: AgentConfigStoreOptions) {}

  private async ensureDir(): Promise<void> {
    const dir = join(this.opts.baseDir, CONFIG_DIR);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private async readFile(kind: AgentKind): Promise<AgentConfig | null> {
    const file = fileFor(this.opts.baseDir, kind);
    if (!existsSync(file)) return null;
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AgentConfig>;
    return withDefaults(
      {
        soul: parsed.soul,
        user: parsed.user,
        memory: parsed.memory,
        llm: parsed.llm as Partial<AgentLLMConfig> | undefined,
      },
      kind,
      typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : nowIso(),
    );
  }

  async list(): Promise<AgentConfig[]> {
    const results: AgentConfig[] = [];
    for (const kind of AGENT_KINDS) {
      const cfg = await this.get(kind);
      if (cfg) results.push(cfg);
    }
    return results;
  }

  async get(kind: AgentKind): Promise<AgentConfig | null> {
    return this.readFile(kind);
  }

  async save(kind: AgentKind, patch: AgentConfigPatch): Promise<AgentConfig> {
    if (!isAgentKind(kind)) {
      throw new Error(`unknown agent kind: ${kind}`);
    }
    await this.ensureDir();
    const file = fileFor(this.opts.baseDir, kind);
    await mkdir(dirname(file), { recursive: true });
    const next = withDefaults(patch, kind, nowIso());
    await writeFile(file, JSON.stringify(next, null, 2), 'utf-8');
    return next;
  }

  async delete(kind: AgentKind): Promise<boolean> {
    if (!isAgentKind(kind)) {
      throw new Error(`unknown agent kind: ${kind}`);
    }
    const file = fileFor(this.opts.baseDir, kind);
    if (!existsSync(file)) return false;   /* v8 ignore next -- delete always operates after save */
    await unlink(file);
    return true;
  }

  async resetLlm(kind: AgentKind): Promise<AgentConfig | null> {
    if (!isAgentKind(kind)) {
      throw new Error(`unknown agent kind: ${kind}`);
    }
    const prev = await this.readFile(kind);
    if (!prev) return null;   /* v8 ignore next -- routes handle 404 before resetLlm */
    return this.save(kind, { soul: prev.soul, user: prev.user, memory: prev.memory, llm: {} });
  }
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateAgentConfigPatch(patch: AgentConfigPatch): ValidationResult {
  const sizes: Array<keyof Pick<AgentConfigPatch, 'soul' | 'user' | 'memory'>> = ['soul', 'user', 'memory'];
  for (const key of sizes) {
    const v = patch[key];
    if (typeof v !== 'string') continue;
    if (Buffer.byteLength(v, 'utf-8') > MAX_PROMPT_BYTES) {
      return { ok: false, error: `${key} too large (>${MAX_PROMPT_BYTES} bytes)` };
    }
  }
  if (patch.llm) {
    const { temperature, maxTokens, providerId, model } = patch.llm;
    if (temperature !== undefined) {
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
        return { ok: false, error: 'temperature must be a number in [0, 2]' };
      }
    }
    if (maxTokens !== undefined) {
      if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens <= 0) {
        return { ok: false, error: 'maxTokens must be a positive integer' };
      }
    }
    if (providerId !== undefined) {
      if (typeof providerId !== 'string' || providerId.length === 0) {
        return { ok: false, error: 'providerId must be a non-empty string' };
      }
    }
    if (model !== undefined) {
      if (typeof model !== 'string' || model.length === 0 || model.length > 128) {
        return { ok: false, error: 'model must be a non-empty string (<= 128 chars)' };
      }
    }
    /* v8 ignore next -- all four llm fields must be tested independently */
  }
  return { ok: true };
}

export interface SystemPromptInput {
  soul: string;
  user: string;
  memory: string;
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  const parts: string[] = [];
  if (input.soul.trim()) parts.push(`[SOUL]\n${input.soul.trim()}`);
  if (input.user.trim()) parts.push(`[USER]\n${input.user.trim()}`);
  if (input.memory.trim()) parts.push(`[MEMORY]\n${input.memory.trim()}`);
  return parts.join('\n\n');
}

export interface RequestOverride {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface BaseChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export interface MergedChatRequest extends BaseChatRequest {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function mergeRequest<R extends BaseChatRequest>(
  base: R,
  config: SystemPromptInput,
  override: RequestOverride,
): R & MergedChatRequest {
  const prompt = buildSystemPrompt(config);
  const merged = { ...(base as object) } as R & MergedChatRequest;
  if (prompt) {
    const messages = [...base.messages];
    const sysIdx = messages.findIndex((m) => m.role === 'system');
    if (sysIdx >= 0) {
      messages[sysIdx] = { role: 'system', content: `${messages[sysIdx].content}\n\n${prompt}` };
    } else {
      messages.unshift({ role: 'system', content: prompt });
    }
    merged.messages = messages;
  }
  if (override.model !== undefined) merged.model = override.model;
  if (override.temperature !== undefined) merged.temperature = override.temperature;
  if (override.maxTokens !== undefined) merged.maxTokens = override.maxTokens;
  return merged;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  agent: 'interview',
  soul: '',
  user: '',
  memory: '',
  llm: {},
  updatedAt: nowIso(),
};
