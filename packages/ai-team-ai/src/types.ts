// LLM client interface — provider-agnostic
// Inspired by pi-mono's pi-ai unified LLM API

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  model?: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface ChatStreamChunk {
  delta: string;
  done: boolean;
}

export interface LLMClient {
  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest, onChunk: (chunk: ChatStreamChunk) => void): Promise<ChatResponse>;
}
