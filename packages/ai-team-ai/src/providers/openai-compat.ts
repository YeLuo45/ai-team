// OpenAI-compatible HTTP client
// Works with: OpenAI, Azure OpenAI, OpenRouter, Anthropic-via-proxy, Ollama, etc.

import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatStreamChunk,
} from '../types.js';

export interface OpenAICompatConfig {
  baseUrl: string;          // e.g. https://api.openai.com/v1
  apiKey: string;
  defaultModel: string;     // e.g. gpt-4o-mini
  organization?: string;
  headers?: Record<string, string>;
}

interface OpenAICompatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompatRequest {
  model: string;
  messages: OpenAICompatMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
  stream?: boolean;
}

interface OpenAICompatChoice {
  index: number;
  message: OpenAICompatMessage;
  finish_reason: string;
}

interface OpenAICompatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAICompatResponse {
  id: string;
  model: string;
  choices: OpenAICompatChoice[];
  usage?: OpenAICompatUsage;
}

export class OpenAICompatClient implements LLMClient {
  constructor(private config: OpenAICompatConfig) {}

  private toApiMessages(messages: ChatMessage[]): OpenAICompatMessage[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  private buildHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
    if (this.config.organization) {
      h['OpenAI-Organization'] = this.config.organization;
    }
    return h;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body: OpenAICompatRequest = {
      model: req.model ?? this.config.defaultModel,
      messages: this.toApiMessages(req.messages),
      ...(req.temperature !== undefined && { temperature: req.temperature }),
      ...(req.maxTokens !== undefined && { max_tokens: req.maxTokens }),
      ...(req.stopSequences && { stop: req.stopSequences }),
    };

    const resp = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`LLM API error ${resp.status}: ${text.slice(0, 500)}`);
    }

    const data = (await resp.json()) as OpenAICompatResponse;
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('LLM API returned no choices');
    }

    return {
      content: choice.message.content,
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason,
    };
  }

  async chatStream(req: ChatRequest, onChunk: (chunk: ChatStreamChunk) => void): Promise<ChatResponse> {
    const body: OpenAICompatRequest = {
      model: req.model ?? this.config.defaultModel,
      messages: this.toApiMessages(req.messages),
      stream: true,
      ...(req.temperature !== undefined && { temperature: req.temperature }),
      ...(req.maxTokens !== undefined && { max_tokens: req.maxTokens }),
    };

    const resp = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok || !resp.body) {
      const text = await resp.text();
      throw new Error(`LLM stream error ${resp.status}: ${text.slice(0, 500)}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let model = body.model;
    let finishReason: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (!line || !line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          onChunk({ delta: '', done: true });
          return {
            content: fullContent,
            model,
            finishReason: finishReason ?? 'stop',
          };
        }
        try {
          const parsed = JSON.parse(data) as {
            model?: string;
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          };
          if (parsed.model) model = parsed.model;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onChunk({ delta, done: false });
          }
          if (parsed.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    return {
      content: fullContent,
      model,
      finishReason: finishReason ?? 'stop',
    };
  }
}
