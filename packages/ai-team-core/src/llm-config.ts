// V24: 多 LLM Provider 配置

export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'crs' | 'custom';

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;                  // display name
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelAssignment {
  agent: string;                 // e.g. 'interview', 'review', 'training'
  providerId: string;            // points to ProviderConfig.id
  model: string;                 // override model
  updatedAt: string;
}

export interface SystemLLMSettings {
  providers: ProviderConfig[];
  assignments: ModelAssignment[];
  activeProviderId?: string;      // default provider for new agents
  updatedAt: string;
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai-default',
    type: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    enabled: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'crs-default',
    type: 'crs',
    name: 'CRS (OpenAI 兼容)',
    baseUrl: 'https://givemetoken.cc.cd/v1',
    defaultModel: 'gpt-5.4-mini',
    enabled: true,
    createdAt: '',
    updatedAt: '',
  },
];

export const SUPPORTED_AGENTS = [
  'interview', 'training', 'one-on-one', 'review', 'resume', 'insights', 'score', 'search', 'legal',
] as const;
export type AgentName = typeof SUPPORTED_AGENTS[number];

// 验证 provider 配置
export function validateProviderConfig(p: Partial<ProviderConfig>): { valid: boolean; error?: string } {
  if (!p.type) return { valid: false, error: 'type is required' };
  if (!p.baseUrl) return { valid: false, error: 'baseUrl is required' };
  try {
    new URL(p.baseUrl);
  } catch {
    return { valid: false, error: 'baseUrl must be a valid URL' };
  }
  if (!p.defaultModel) return { valid: false, error: 'defaultModel is required' };
  if (p.type !== 'ollama' && !p.apiKey) {
    return { valid: false, error: `apiKey is required for ${p.type} provider (except ollama)` };
  }
  return { valid: true };
}

// 选择 provider for an agent
export function selectProviderForAgent(
  settings: SystemLLMSettings,
  agent: string
): ProviderConfig | null {
  // 1. Specific assignment takes priority
  const assignment = settings.assignments.find(a => a.agent === agent);
  if (assignment) {
    const provider = settings.providers.find(p => p.id === assignment.providerId);
    if (provider && provider.enabled) {
      // Use the assigned model if specified, otherwise provider's default
      return provider;
    }
  }
  // 2. Active provider
  if (settings.activeProviderId) {
    const active = settings.providers.find(p => p.id === settings.activeProviderId);
    if (active && active.enabled) return active;
  }
  // 3. First enabled provider
  return settings.providers.find(p => p.enabled) || null;
}

// Resolve the actual model for an agent (considers override)
export function resolveModel(settings: SystemLLMSettings, agent: string): { provider: ProviderConfig; model: string } | null {
  const assignment = settings.assignments.find(a => a.agent === agent);
  if (assignment) {
    const provider = settings.providers.find(p => p.id === assignment.providerId);
    if (provider && provider.enabled) {
      return { provider, model: assignment.model };
    }
  }
  const provider = selectProviderForAgent(settings, agent);
  if (!provider) return null;
  return { provider, model: provider.defaultModel };
}

// Build OpenAI-compatible request body
export function buildRequestBody(model: string, messages: any[], options?: { temperature?: number; maxTokens?: number }) {
  return {
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2000,
  };
}

// 构建请求 headers (per provider)
export function buildRequestHeaders(provider: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }
  return headers;
}

// Build full URL for chat completions
export function buildChatUrl(provider: ProviderConfig): string {
  const base = provider.baseUrl.replace(/\/+$/, '');
  // Anthropic-style providers don't have /chat/completions
  if (provider.type === 'anthropic') {
    return `${base}/messages`;
  }
  // Standard OpenAI-compatible
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

// 列出 provider 可用 models (call /models endpoint)
export async function listProviderModels(provider: ProviderConfig): Promise<string[]> {
  if (!provider.apiKey && provider.type !== 'ollama') return [];
  const base = provider.baseUrl.replace(/\/+$/, '');
  const url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
  try {
    const resp = await fetch(url, {
      headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.data || []).map((m: any) => m.id).filter(Boolean);
  } catch {
    return [];
  }
}

// 初始化默认 settings
export function defaultSettings(): SystemLLMSettings {
  const now = new Date().toISOString();
  return {
    providers: DEFAULT_PROVIDERS.map(p => ({ ...p, createdAt: now, updatedAt: now })),
    assignments: [],
    activeProviderId: 'crs-default',
    updatedAt: now,
  };
}

// 测试连接
export async function testProviderConnection(
  provider: ProviderConfig,
  model: string
): Promise<{ success: boolean; error?: string; latencyMs?: number; response?: string }> {
  const start = Date.now();
  try {
    const resp = await fetch(buildChatUrl(provider), {
      method: 'POST',
      headers: buildRequestHeaders(provider),
      body: JSON.stringify(buildRequestBody(model, [{ role: 'user', content: 'hi' }], { maxTokens: 10 })),
    });
    const latencyMs = Date.now() - start;
    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, error: `HTTP ${resp.status}: ${errText.slice(0, 200)}`, latencyMs };
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { success: true, latencyMs, response: content };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error', latencyMs: Date.now() - start };
  }
}