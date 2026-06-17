# @ai-team/ai

LLM wrapper layer for ai-team. Inspired by pi-mono's `pi-ai` package.

## Architecture

```
+----------------------------+
|   prompts/                 |   Interview/Training/Eval prompt templates
+----------------------------+
|   providers/               |   LLM client implementations
|   - openai-compat.ts       |   OpenAI-compatible HTTP client (works with
|                            |   OpenAI/Azure/OpenRouter/Ollama/Anthropic-proxy)
|   - mock.ts                |   Deterministic mock for testing/demo
|   - index.ts               |   Factory: createLLMClient / createFromEnv
+----------------------------+
|   types.ts                 |   ChatMessage/ChatRequest/ChatResponse/LLMClient
+----------------------------+
```

## Provider Config

| Env var | Default | Description |
|---------|---------|-------------|
| `AI_TEAM_LLM_API_KEY` | (none) | API key (falls back to `OPENAI_API_KEY`) |
| `AI_TEAM_LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible base URL |
| `AI_TEAM_LLM_MODEL` | `gpt-4o-mini` | Default model |

If no API key is set, the MockClient is used (deterministic responses for demo).

## Usage

```ts
import { createFromEnv, buildInterviewMessages } from '@ai-team/ai';

const llm = createFromEnv();
const messages = buildInterviewMessages('前端工程师', '张三', undefined, []);
const resp = await llm.chat({ messages });
console.log(resp.content);
```

## Supported Providers

Any OpenAI-compatible API:
- OpenAI
- Azure OpenAI
- OpenRouter
- Anthropic (via proxy)
- Local Ollama (`http://localhost:11434/v1`)
- LM Studio
- vLLM
