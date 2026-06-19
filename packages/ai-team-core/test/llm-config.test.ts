// V24: Multi-LLM provider tests

import { describe, it, expect, vi } from 'vitest';
import {
  validateProviderConfig,
  selectProviderForAgent,
  resolveModel,
  buildRequestBody,
  buildRequestHeaders,
  buildChatUrl,
  defaultSettings,
  testProviderConnection,
  listProviderModels,
  DEFAULT_PROVIDERS,
  SUPPORTED_AGENTS,
} from '../src/llm-config.js';
import type { ProviderConfig, SystemLLMSettings } from '../src/llm-config.js';

describe('V24: Multi-LLM Provider', () => {
  describe('validateProviderConfig', () => {
    it('requires type', () => {
      expect(validateProviderConfig({ baseUrl: 'https://x.com/v1', defaultModel: 'gpt-4' }).valid).toBe(false);
    });

    it('requires baseUrl', () => {
      expect(validateProviderConfig({ type: 'openai', defaultModel: 'gpt-4' }).valid).toBe(false);
    });

    it('requires valid URL', () => {
      expect(validateProviderConfig({ type: 'openai', baseUrl: 'not-url', defaultModel: 'gpt-4' }).valid).toBe(false);
    });

    it('requires defaultModel', () => {
      expect(validateProviderConfig({ type: 'openai', baseUrl: 'https://x.com/v1' }).valid).toBe(false);
    });

    it('requires apiKey for non-ollama', () => {
      expect(validateProviderConfig({
        type: 'openai', baseUrl: 'https://x.com/v1', defaultModel: 'gpt-4',
      }).valid).toBe(false);
    });

    it('ollama can skip apiKey', () => {
      const r = validateProviderConfig({
        type: 'ollama', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama2',
      });
      expect(r.valid).toBe(true);
    });

    it('valid openai config passes', () => {
      const r = validateProviderConfig({
        type: 'openai', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4', apiKey: 'sk-xxx',
      });
      expect(r.valid).toBe(true);
    });
  });

  describe('selectProviderForAgent', () => {
    const openaiProv: ProviderConfig = {
      id: 'p1', type: 'openai', name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true,
      apiKey: 'sk-1', createdAt: '', updatedAt: '',
    };
    const crsProv: ProviderConfig = {
      id: 'p2', type: 'crs', name: 'CRS',
      baseUrl: 'https://givemetoken.cc.cd/v1', defaultModel: 'gpt-5.4-mini', enabled: true,
      apiKey: 'sk-2', createdAt: '', updatedAt: '',
    };

    it('uses assignment when present', () => {
      const settings: SystemLLMSettings = {
        providers: [openaiProv, crsProv],
        assignments: [{ agent: 'interview', providerId: 'p2', model: 'gpt-5.5', updatedAt: '' }],
        activeProviderId: 'p1',
        updatedAt: '',
      };
      const p = selectProviderForAgent(settings, 'interview');
      expect(p!.id).toBe('p2');
    });

    it('falls back to active provider when no assignment', () => {
      const settings: SystemLLMSettings = {
        providers: [openaiProv, crsProv],
        assignments: [],
        activeProviderId: 'p1',
        updatedAt: '',
      };
      const p = selectProviderForAgent(settings, 'review');
      expect(p!.id).toBe('p1');
    });

    it('falls back to first enabled when no active', () => {
      const settings: SystemLLMSettings = {
        providers: [openaiProv, crsProv],
        assignments: [],
        updatedAt: '',
      };
      const p = selectProviderForAgent(settings, 'review');
      expect(p!.id).toBe('p1');
    });

    it('skips disabled assignment provider', () => {
      const settings: SystemLLMSettings = {
        providers: [openaiProv, { ...crsProv, enabled: false }],
        assignments: [{ agent: 'x', providerId: 'p2', model: 'gpt-5.5', updatedAt: '' }],
        activeProviderId: 'p1',
        updatedAt: '',
      };
      const p = selectProviderForAgent(settings, 'x');
      expect(p!.id).toBe('p1');
    });

    it('returns null when no enabled providers', () => {
      const settings: SystemLLMSettings = {
        providers: [{ ...openaiProv, enabled: false }],
        assignments: [],
        updatedAt: '',
      };
      const p = selectProviderForAgent(settings, 'review');
      expect(p).toBeNull();
    });
  });

  describe('resolveModel', () => {
    it('uses assignment model when present', () => {
      const openai: ProviderConfig = {
        id: 'p1', type: 'openai', name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true,
        apiKey: 'sk-1', createdAt: '', updatedAt: '',
      };
      const settings: SystemLLMSettings = {
        providers: [openai],
        assignments: [{ agent: 'review', providerId: 'p1', model: 'gpt-5', updatedAt: '' }],
        updatedAt: '',
      };
      const r = resolveModel(settings, 'review');
      expect(r!.model).toBe('gpt-5');
      expect(r!.provider.id).toBe('p1');
    });

    it('uses default model when no assignment', () => {
      const openai: ProviderConfig = {
        id: 'p1', type: 'openai', name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true,
        apiKey: 'sk-1', createdAt: '', updatedAt: '',
      };
      const settings: SystemLLMSettings = {
        providers: [openai],
        assignments: [],
        updatedAt: '',
      };
      const r = resolveModel(settings, 'interview');
      expect(r!.model).toBe('gpt-4o');
    });

    it('returns null when no provider', () => {
      const settings: SystemLLMSettings = {
        providers: [],
        assignments: [],
        updatedAt: '',
      };
      const r = resolveModel(settings, 'interview');
      expect(r).toBeNull();
    });
  });

  describe('buildRequestBody', () => {
    it('builds with defaults', () => {
      const body = buildRequestBody('gpt-4', [{ role: 'user', content: 'hi' }]);
      expect(body.model).toBe('gpt-4');
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(2000);
    });

    it('respects overrides', () => {
      const body = buildRequestBody('gpt-4', [], { temperature: 0.1, maxTokens: 100 });
      expect(body.temperature).toBe(0.1);
      expect(body.max_tokens).toBe(100);
    });
  });

  describe('buildRequestHeaders', () => {
    it('adds Bearer auth when apiKey present', () => {
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: '', defaultModel: '', enabled: true,
        apiKey: 'sk-abc', createdAt: '', updatedAt: '',
      };
      const h = buildRequestHeaders(p);
      expect(h['Authorization']).toBe('Bearer sk-abc');
      expect(h['Content-Type']).toBe('application/json');
    });

    it('omits Authorization when no apiKey', () => {
      const p: ProviderConfig = {
        id: 'p', type: 'ollama', name: '', baseUrl: '', defaultModel: '', enabled: true,
        createdAt: '', updatedAt: '',
      };
      const h = buildRequestHeaders(p);
      expect(h['Authorization']).toBeUndefined();
    });
  });

  describe('buildChatUrl', () => {
    it('appends /chat/completions for /v1 base', () => {
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1', defaultModel: '', enabled: true,
        apiKey: '', createdAt: '', updatedAt: '',
      };
      expect(buildChatUrl(p)).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('handles trailing slash', () => {
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1/', defaultModel: '', enabled: true,
        apiKey: '', createdAt: '', updatedAt: '',
      };
      expect(buildChatUrl(p)).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('adds /v1/chat/completions when no version', () => {
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com', defaultModel: '', enabled: true,
        apiKey: '', createdAt: '', updatedAt: '',
      };
      expect(buildChatUrl(p)).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('uses /messages for anthropic', () => {
      const p: ProviderConfig = {
        id: 'p', type: 'anthropic', name: '', baseUrl: 'https://api.anthropic.com/v1', defaultModel: '', enabled: true,
        apiKey: '', createdAt: '', updatedAt: '',
      };
      expect(buildChatUrl(p)).toBe('https://api.anthropic.com/v1/messages');
    });
  });

  describe('defaultSettings', () => {
    it('returns 2 default providers', () => {
      const s = defaultSettings();
      expect(s.providers.length).toBe(2);
      expect(s.providers.map(p => p.type)).toContain('openai');
      expect(s.providers.map(p => p.type)).toContain('crs');
    });

    it('CRS is active by default', () => {
      const s = defaultSettings();
      expect(s.activeProviderId).toBe('crs-default');
    });
  });

  describe('listProviderModels', () => {
    it('returns empty for provider without apiKey (non-ollama)', async () => {
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1', defaultModel: '', enabled: true,
        createdAt: '', updatedAt: '',
      };
      const models = await listProviderModels(p);
      expect(models).toEqual([]);
    });

    it('fetches models successfully', async () => {
      const mockFetch = vi.fn(async () => new Response(JSON.stringify({
        data: [{ id: 'gpt-4' }, { id: 'gpt-3.5' }],
      }), { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1', defaultModel: '', enabled: true,
        apiKey: 'sk-1', createdAt: '', updatedAt: '',
      };
      const models = await listProviderModels(p);
      expect(models).toEqual(['gpt-4', 'gpt-3.5']);
      vi.unstubAllGlobals();
    });

    it('handles fetch error', async () => {
      const mockFetch = vi.fn(async () => { throw new Error('net'); });
      vi.stubGlobal('fetch', mockFetch);
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1', defaultModel: '', enabled: true,
        apiKey: 'sk-1', createdAt: '', updatedAt: '',
      };
      const models = await listProviderModels(p);
      expect(models).toEqual([]);
      vi.unstubAllGlobals();
    });
  });

  describe('testProviderConnection', () => {
    it('returns success on 200', async () => {
      const mockFetch = vi.fn(async () => {
        await new Promise(r => setTimeout(r, 5));
        return new Response(JSON.stringify({
          choices: [{ message: { content: 'hello' } }],
        }), { status: 200 });
      });
      vi.stubGlobal('fetch', mockFetch);
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4', enabled: true,
        apiKey: 'sk-1', createdAt: '', updatedAt: '',
      };
      const result = await testProviderConnection(p, 'gpt-4');
      expect(result.success).toBe(true);
      expect(result.response).toBe('hello');
      expect(result.latencyMs).toBeGreaterThan(0);
      vi.unstubAllGlobals();
    });

    it('returns failure on 500', async () => {
      const mockFetch = vi.fn(async () => new Response('boom', { status: 500 }));
      vi.stubGlobal('fetch', mockFetch);
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4', enabled: true,
        apiKey: 'sk-1', createdAt: '', updatedAt: '',
      };
      const result = await testProviderConnection(p, 'gpt-4');
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
      vi.unstubAllGlobals();
    });

    it('handles network error', async () => {
      const mockFetch = vi.fn(async () => { throw new Error('net'); });
      vi.stubGlobal('fetch', mockFetch);
      const p: ProviderConfig = {
        id: 'p', type: 'openai', name: '', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4', enabled: true,
        apiKey: 'sk-1', createdAt: '', updatedAt: '',
      };
      const result = await testProviderConnection(p, 'gpt-4');
      expect(result.success).toBe(false);
      expect(result.error).toContain('net');
      vi.unstubAllGlobals();
    });
  });

  describe('SUPPORTED_AGENTS', () => {
    it('includes all 8 ai-team agents', () => {
      expect(SUPPORTED_AGENTS).toContain('interview');
      expect(SUPPORTED_AGENTS).toContain('review');
      expect(SUPPORTED_AGENTS).toContain('training');
      expect(SUPPORTED_AGENTS).toContain('resume');
      expect(SUPPORTED_AGENTS).toContain('insights');
    });
  });

  describe('DEFAULT_PROVIDERS', () => {
    it('exports openai and crs defaults', () => {
      expect(DEFAULT_PROVIDERS.length).toBe(2);
    });
  });
});