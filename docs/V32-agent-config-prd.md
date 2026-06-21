# V32: Per-Agent Independent Configuration

## 背景

每个 agent (interview / training / review / resume / score / legal / tech-policy / media-compliance / sibling-org-conflict / pipeline / insights / one-on-one / search) 当前共用同一个全局 LLM client (`createFromEnv()`)。boss 需要让每个 agent 拥有 **独立** 的运行时配置：

1. **soul.md** — agent 的"人格/价值观/目标"（system prompt 注入层）
2. **user.md** — 该 agent 服务的用户偏好（语气、长度、限制）
3. **memory.md** — 长期记忆摘要（注入 system 尾部）
4. **LLM model 字段独立** — 复用 V24 的 `ModelAssignment`，可指向不同 provider/model

要求：
- 增量代码覆盖率 ≥ 95%（仅统计本轮新增/改动文件）
- 测试通过率 100%
- README 中所有命令可执行不报错
- 交付报告含后续迭代方向

## 设计

### 数据模型（core 层）

新增 `core/src/agent-config.ts`：

```ts
import type { AgentKind } from './types/agent-audit.js';

export interface AgentLLMConfig {
  /** 指向 V24 SystemLLMSettings.providers[].id；缺省时回退到全局默认 */
  providerId?: string;
  /** 模型覆盖；缺省时使用 provider.defaultModel */
  model?: string;
  /** 独立温度（0-2） */
  temperature?: number;
  /** 独立 max tokens */
  maxTokens?: number;
}

export interface AgentConfig {
  agent: AgentKind;
  soul: string;        // system prompt 顶部注入（人格/价值观）
  user: string;        // system prompt 中部注入（用户偏好）
  memory: string;      // system prompt 尾部注入（长期记忆摘要）
  llm: AgentLLMConfig;
  updatedAt: string;
}

export interface AgentConfigPatch {
  soul?: string;
  user?: string;
  memory?: string;
  llm?: Partial<AgentLLMConfig>;
}
```

每个 agent 有**独立存储**：`data/agent-configs/<kind>.json`，互不影响。

### 运行时隔离（agent 层）

新增 `agent/src/agent-config-loader.ts`：

- `loadAgentConfig(kind)` → 读 disk → 返回 `AgentConfig | null`（缺失返回 null → 用全局默认）
- `applyConfigToRequest(config, baseRequest, kind)` → 给 LLM `chat()` request 注入：
  - `system` 角色消息合并 soul/user/memory（如 baseRequest.messages 含 system 则追加，否则 prepend）
  - `model`/`temperature`/`maxTokens` 由 `config.llm` 覆盖
- 提供独立 `LLMClient` 缓存：根据 `providerId + apiKey + baseUrl` 哈希缓存 client 实例，每 agent 一份

### HTTP API（server 层）

新增 `server/src/routes/agent-config.ts`：
- `GET /api/agent-config` → 列出所有 agent 的 config（缺省字段用空字符串）
- `GET /api/agent-config/:kind` → 单个
- `PUT /api/agent-config/:kind` → 全量替换（验证 soul/user/memory 长度 ≤ 20K 字符；llm.temperature 0-2；model 长度 ≤ 128）
- `DELETE /api/agent-config/:kind` → 重置（删除文件 + 内存缓存）
- `POST /api/agent-config/:kind/reset-llm` → 只重置 llm 子项，保留文案

`server/src/index.ts` 接入 `/api/agent-config`，并把 `new InterviewAgent(llm)` 改成 `new InterviewAgent(runtimeLLM)`，`runtimeLLM` 由 `resolveRuntimeLLM(kind, baseLLM)` 决定。

### 覆盖率/测试策略

增量文件清单（仅这些纳入增量统计）：
- `core/src/agent-config.ts`
- `core/test/agent-config.test.ts`
- `agent/src/agent-config-loader.ts`
- `agent/test/agent-config-loader.test.ts`
- `server/src/routes/agent-config.ts`
- `server/test/agent-config-routes.test.ts`

strict 95% 门禁；不再触动现有 8 层 strict 层。
