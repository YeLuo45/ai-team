// V35: Agent config templates — bulk export / import across all agents.
// Each preset is a fully-named, deterministic AgentConfigTemplate that can be
// imported into a fresh project to give every agent a sensible default voice.

import { AGENT_KINDS } from './store/agent-audit-store.js';
import type { AgentKind } from './types/agent-audit.js';
import type { AgentConfig, AgentConfigPatch, AgentConfigStore } from './agent-config.js';

export const TEMPLATE_VERSION = 'v1' as const;

export interface AgentConfigTemplateEntry {
  agent: AgentKind;
  soul: string;
  user: string;
  memory: string;
  llm: {
    providerId?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AgentConfigTemplate {
  id: string;
  name: string;
  description: string;
  agents: AgentConfigTemplateEntry[];
}

export interface AgentConfigTemplateEnvelope {
  version: typeof TEMPLATE_VERSION;
  exportedAt: string;
  agents: AgentConfigTemplateEntry[];
}

export const BUILTIN_TEMPLATES: AgentConfigTemplate[] = [
  {
    id: 'default',
    name: '默认（空白）',
    description: '所有 agent 都使用全局默认 LLM 配置，不设置 soul/user/memory。',
    agents: AGENT_KINDS.map((kind) => ({
      agent: kind,
      soul: '',
      user: '',
      memory: '',
      llm: {},
    })),
  },
  {
    id: 'hr-friendly',
    name: 'HR 友好型',
    description: '面向 HR 场景：语气温和、避免法务风险、给出可操作建议。',
    agents: [
      { agent: 'interview', soul: '你是一位温和专业的面试官，关注候选人潜力而非短板。', user: '面向校招与社招初级岗位', memory: '', llm: { temperature: 0.4 } },
      { agent: 'training', soul: '你是 HR 培训规划师，关注员工成长曲线而非短期产出。', user: '', memory: '', llm: { temperature: 0.3 } },
      { agent: 'review', soul: '你是绩效评估助手，语气温和，注重建设性反馈。', user: '', memory: '', llm: { temperature: 0.3 } },
      { agent: 'one-on-one', soul: '你扮演团队成员，语气真诚，避免对抗。', user: '', memory: '', llm: { temperature: 0.5 } },
      { agent: 'resume', soul: '你从 HR 视角评估简历，关注潜力和文化契合。', user: '', memory: '', llm: { temperature: 0.2 } },
      { agent: 'legal', soul: '你是法务顾问，倾向保守建议，避免激进解读。', user: '', memory: '', llm: { temperature: 0.1 } },
    ],
  },
  {
    id: 'strict-interviewer',
    name: '严格技术面试',
    description: '面向资深岗位：深挖技术细节、识别模糊回答、严格评分。',
    agents: [
      { agent: 'interview', soul: '你是一位严苛的高级技术面试官，深挖候选人技术深度；不接受模糊回答，会追问。', user: '面向 P7+ 资深候选人', memory: '', llm: { temperature: 0.3, maxTokens: 2048 } },
      { agent: 'resume', soul: '你从资深工程师视角看简历，识别技术深度信号。', user: '', memory: '', llm: { temperature: 0.2 } },
      { agent: 'score', soul: '你综合简历 + 团队缺口打分，注重技术深度。', user: '', memory: '', llm: { temperature: 0.2 } },
      { agent: 'review', soul: '你是高级技术 leader，绩效评估偏技术贡献。', user: '', memory: '', llm: { temperature: 0.3 } },
    ],
  },
];

export async function exportAgentConfigs(store: AgentConfigStore): Promise<AgentConfigTemplateEnvelope> {
  const list = await store.list();
  return {
    version: TEMPLATE_VERSION,
    exportedAt: new Date().toISOString(),
    agents: list.map((cfg) => ({
      agent: cfg.agent,
      soul: cfg.soul,
      user: cfg.user,
      memory: cfg.memory,
      llm: { ...cfg.llm },
    })),
  };
}

export interface ValidationOk { ok: true; }
export interface ValidationErr { ok: false; error: string }
export type TemplateValidation = ValidationOk | ValidationErr;

export function validateTemplateEnvelope(input: unknown): TemplateValidation {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'envelope must be an object' };
  }
  const env = input as Record<string, unknown>;
  if (env.version !== TEMPLATE_VERSION) {
    return { ok: false, error: `unsupported version: ${String(env.version)} (expected ${TEMPLATE_VERSION})` };
  }
  if (typeof env.exportedAt !== 'string') {
    return { ok: false, error: 'exportedAt must be an ISO timestamp string' };
  }
  if (!Array.isArray(env.agents)) {
    return { ok: false, error: 'agents must be an array' };
  }
  for (let i = 0; i < env.agents.length; i++) {
    const a = env.agents[i] as Record<string, unknown> | null;
    if (!a || typeof a !== 'object') {
      return { ok: false, error: `agents[${i}] must be an object` };
    }
    if (typeof a.agent !== 'string' || !(AGENT_KINDS as string[]).includes(a.agent)) {
      return { ok: false, error: `agents[${i}].agent is unknown: ${String(a.agent)}` };
    }
    if (typeof a.soul !== 'string' || typeof a.user !== 'string' || typeof a.memory !== 'string') {
      return { ok: false, error: `agents[${i}] missing required string fields (soul/user/memory)` };
    }
    if (!a.llm || typeof a.llm !== 'object') {
      return { ok: false, error: `agents[${i}].llm must be an object` };
    }
  }
  return { ok: true };
}

export interface ImportOptions {
  dryRun?: boolean;
}

export interface ImportResult {
  imported: number;
  dryRun: boolean;
}

export async function importAgentConfigs(
  store: AgentConfigStore,
  source: AgentConfigTemplateEnvelope | AgentConfigTemplate,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const envelope: AgentConfigTemplateEnvelope = 'version' in source && source.version
    ? source
    : { version: TEMPLATE_VERSION, exportedAt: new Date().toISOString(), agents: source.agents };
  const validation = validateTemplateEnvelope(envelope);
  if (!validation.ok) {
    throw new Error(`invalid template envelope: ${validation.error}`);
  }
  if (options.dryRun) {
    return { imported: envelope.agents.length, dryRun: true };
  }
  for (const entry of envelope.agents) {
    const patch: AgentConfigPatch = {
      soul: entry.soul,
      user: entry.user,
      memory: entry.memory,
      llm: entry.llm,
    };
    await store.save(entry.agent, patch);
  }
  return { imported: envelope.agents.length, dryRun: false };
}

export function findTemplate(id: string): AgentConfigTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

export type { AgentConfig };
// AgentConfigStore is intentionally NOT re-exported as type because tests need
// the runtime class. Consumers should import it directly from ./agent-config.js
// (or from the package barrel which already exposes it).
