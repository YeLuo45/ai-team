# Delivery Report — ai-team

**Ready**: yes
**Headline**: V171 Ollama Provider — 本地 LLM via Ollama HTTP (零云依赖)
**Proposal**: P-20260705-009
**Commit**: feat(V171): Ollama local-LLM provider

## Validation
- `npx vitest run packages/ai-team-web/test/llm-ollama-v171.test.tsx` (NODE_ENV=test) — 17/17 passed
- V164-V170 regression: 70/70 全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0

## Coverage
| File | Lines | Notes |
|---|---:|---|
| llm/types.ts | 100% | 全覆盖 (interface-only 数据) |
| llm/ollama-provider.ts | 96% | generate/health/list/generateStream |
| llm/index.ts | 100% | registry helpers |

## Changed Files
- A packages/ai-team-web/src/lib/llm/types.ts (47 行, 4 interfaces + LlmProvider contract)
- A packages/ai-team-web/src/lib/llm/ollama-provider.ts (220 行, Ollama HTTP client)
- A packages/ai-team-web/src/lib/llm/index.ts (registry)
- A packages/ai-team-web/test/llm-ollama-v171.test.tsx (17 tests)

## meetily Capability Mapping

Meetily 关键能力：
1. **4× 实时转录 (Parakeet/Whisper)** → 已有 STT Provider V161 (Web Speech, Whisper stub)
2. **扬声器日记 (Speaker Diarization)** → V172 方向
3. **Ollama 本地摘要** → V171 (this)
4. **100% 本地处理** → Ollama 默认 `local: true`, endpoint 默认 `http://localhost:11434`

## Features
- **`OllamaProvider`** — Ollama HTTP API 客户端 (`/api/tags`, `/api/generate`, `/api/generate?stream=true`)
- **`LlmProvider` interface** — 抽象层，未来可插入 llama.cpp / MLX / GGUF 直接调用
- **`generate(prompt, options)`** — 单次返回 (test fixtures / prompt-engineering)
- **`generateStream(prompt, onChunk, options)`** — NDJSON 逐行喂数据 (实时显示)
- **`list()`** — `/api/tags` 返回安装的模型列表
- **`health()`** — 端点连通性 + latencyMs (隐私徽章显示)
- **abort support** — `options.signal` 传导到 fetch
- **endpoint normalisation** — 去掉 trailing slash

## ROI
- **零云依赖**: Ollama 离线运行，符合 meetily "100% 本地处理" 定位
- **可插拔**: 与 STT Provider 抽象对称，未来 llama.cpp / MLX / GGUF slot-in
- **可审计**: 健康检查 + endpoint 显示让用户清楚数据流向

## Test Coverage (V171 test file 17/17)
- **Provider HTTP (12 tests)**: 端点归一化 / list / list 错误 / generate POST 体 / options 转发 / non-OK / NDJSON stream / 流 fallback / health 成功 / health 失败 / 自定义端点 / 默认值
- **Registry (5 tests)**: listLlmProviders / listLlmProviderOptions / getLlmProvider / getDefaultLlmProviderId

## Next Directions
1. **V172 Speaker Diarization UI** — SttSettings 增 speaker timeline (medium-high ROI, 5h)
2. **V173 Agent Eval Harness** — 回放历史 eval LLM agent (high ROI, 8h)
3. **V174 Privacy Badge** — 全链路 local mode 徽章 (low ROI, 2h)
4. **V175 LlamaCpp Provider** — 直接 llama.cpp 调用 (mid ROI, 6h)
