# 🎙️ 实时面试指导能力 — 迭代方向 PRD

**Boss 信号**: "提供下后续迭代方向（支持实时面试指导能力，即语音转文字-支持扩展切换、根据实时内容生成后续面试题建议，面试题建议是一个agent-支持配置）"

**状态**: 等待 boss 确认后无人值守实施

## 📋 核心诉求

为面试官提供**实时辅助系统**：

1. **🎤 语音转文字（STT）** — 把候选人/面试官的对话流实时转成文本
   - **可扩展切换**：默认 Web Speech API，可切换到第三方服务（Whisper/AssemblyAI/Deepgram 等）
2. **🧠 实时面试题建议** — 根据实时 transcript 内容生成下一道面试题建议
3. **🤖 QuestionSuggestionAgent** — 建议生成是**一个 agent**，支持配置（prompt/model/provider/触发频率）

## 🎯 价值

| 角色 | 价值 |
|------|------|
| 面试官 | 解放双手 + 不必记笔记 + 智能题目建议（避免题目太浅/太深/重复） |
| 招聘流程 | 提升面试质量 + 标准化流程 + 实时审计 |
| 候选人 | 避免重复提问 + 自然流畅对话 |

## 🧩 子方向拆分

### A. STT Provider 抽象层（V161，基础 + 高 ROI）

**目标**: 定义统一接口 + 提供 Web Speech API 默认实现 + 切换开关 UI

**核心代码**:
```typescript
// 新文件: packages/ai-team-web/src/lib/stt/types.ts
export interface SttProvider {
  readonly id: string;
  readonly label: string;
  readonly supported: boolean;
  start(session: SttSession): Promise<void>;
  stop(): Promise<void>;
}

// 新文件: packages/ai-team-web/src/lib/stt/web-speech-provider.ts
export class WebSpeechProvider implements SttProvider {
  // 使用浏览器 SpeechRecognition API
}

// 新文件: packages/ai-team-web/src/lib/stt/whisper-provider.ts (stub)
export class WhisperProvider implements SttProvider {
  // 未来: 调用 OpenAI Whisper API streaming
}

// 新文件: packages/ai-team-web/src/lib/stt/provider-registry.ts
export const STT_PROVIDERS: SttProvider[] = [WebSpeechProvider, WhisperProvider];
export function getSttProvider(id: string): SttProvider | undefined;
```

**UI**: 新组件 `SttSettingsPanel`：
- dropdown: 「STT Provider: [Web Speech ▼] / [Whisper / 第三方]」
- 显示当前麦克风权限状态
- "开始录音 / 停止录音" 大按钮
- 实时 transcript 流（candidate + interviewer 区分）

**依赖**: 无前置，全部新建

**测试**: 8-10 tests (provider registry / lifecycle / error handling)

**ROI**: ⭐⭐⭐⭐ （基础能力，必备）

### B. 实时 Transcript 流接入 InterviewSimulator（V162，应用接入）

**目标**: 把 STT 流接入 Interview Simulator，让 transcript 显示在现有对话窗口

**改动**:
- `InterviewSimulator` 增 `<LiveTranscriptStream />` 区域
- transcript 增量显示（每 100ms 渲染一次）
- 演讲者识别（candidate vs interviewer）
- "📌 标记"按钮（手动标记重要片段）
- 时间戳显示

**依赖**: A (STT 抽象层)

**测试**: 6-8 tests（流式渲染 + 标记 + 时间戳）

**ROI**: ⭐⭐⭐⭐ （完整闭环 — STT 真正可用）

### C. QuestionSuggestionAgent 接口（V163，Agent 定义）

**目标**: 定义 QuestionSuggestionAgent 接口 + 配置入口 + 默认实现

**核心代码**:
```typescript
// 新文件: packages/ai-team-core/src/agents/question-suggestion.ts
export interface QuestionSuggestionInput {
  readonly sessionId: string;
  readonly position: string;
  readonly candidateName: string;
  readonly previousQuestions: readonly { question: string; askedAt: number; focusTag?: string }[];
  readonly recentTranscript: string; // 最后 N 秒（默认 60s）
  readonly evaluationHistory: readonly EvaluationSummary[];
  readonly triggers: SuggestionTrigger; // time-based / content-based / manual
}

export interface QuestionSuggestion {
  readonly question: string;
  readonly rationale: string;
  readonly focusTag?: 'technical' | 'communication' | 'problem-solving' | 'culture';
  readonly difficulty: 'easy' | 'medium' | 'hard';
  readonly followUpHints?: readonly string[];
  readonly generatedAt: number;
}

export interface QuestionSuggestionAgent {
  readonly id: string;
  readonly label: string;
  suggest(input: QuestionSuggestionInput): Promise<QuestionSuggestion>;
}

// 新文件: packages/ai-team-agent/src/agents/llm-question-suggestion-agent.ts
export class LlmQuestionSuggestionAgent implements QuestionSuggestionAgent {
  // 用 org-memory + recent transcript 生成题目
}

// 新文件: packages/ai-team-agent/src/agents/mock-question-suggestion-agent.ts
export class MockQuestionSuggestionAgent implements QuestionSuggestionAgent {
  // 模板池 — 不依赖 LLM
}
```

**配置入口**: Settings → "Question Suggestion Agent"
- Provider: `[Mock ▼] / [LLM (gpt-5) ▼]`
- Model: `[gpt-5.4-mini (default) / 自定义]`
- 触发频率: `[实时 (每 30s) / 内容变化 / 手动按钮]`
- 上下文窗口: 默认 60s

**依赖**: A

**测试**: 8-10 tests (interface compliance / fallback / rate limit)

**ROI**: ⭐⭐⭐⭐⭐ （Agent 抽象 — 支持任意 provider 切换）

### D. 实时 Question 建议面板 + UI 集成（V164，最终用户体验）

**目标**: 把 QuestionSuggestionAgent 输出可视化，用户可一键"采纳"题目

**改动**:
- 新组件 `<RealtimeQuestionSuggester />` 嵌入 Interview 详情面板
- 显示当前建议（含 rationale + difficulty + focusTag）
- 「✅ 采纳」按钮：复制到剪贴板 / 记录到 session
- 「🔄 重新生成」按钮
- 「⚙️ Agent 设置」按钮：打开 Settings
- 触发指示器：「⏳ 分析中...」「⚡ 实时」「📝 手动」

**依赖**: A + C (要 STT 流 + Agent)

**测试**: 8-10 tests（UI 交互 + agent integration mock）

**ROI**: ⭐⭐⭐⭐⭐ （端到端可用 — 用户价值闭环）

### E. Org Memory 注入到 Question 建议（V165，质量提升）

**目标**: 让 QuestionSuggestionAgent 利用 team org-memory（角色偏好、技术栈、企业文化）生成更精准的题目

**改动**:
- `QuestionSuggestionInput` 注入 `orgMemory: OrgMemorySnapshot`
- Agent prompt 增加 "参考团队偏好" 段落
- 测试：mock org-memory → 看 prompt 变化

**依赖**: C

**测试**: 4-6 tests

**ROI**: ⭐⭐⭐ （质量增益，非必需）

## 🎯 实施顺序（按 ROI 排序）

```
V161 (A) STT Provider 抽象层 + Web Speech + 切换 UI
       ↓
V162 (B) 实时 transcript 流接入 InterviewSimulator
       ↓
V163 (C) QuestionSuggestionAgent 接口 + Mock/LLM 双实现
       ↓
V164 (D) RealtimeQuestionSuggester UI 面板 + "采纳" 流程
       ↓ (optional)
V165 (E) Org Memory 注入（质量提升）
```

预计 **5 轮 × 30-60 commits × 35-50 new tests**

## 🔧 技术挑战

1. **STT 多 Provider**: Web Speech API 仅 Chrome/Edge 完整支持，需要降级处理
2. **Streaming LLM**: Question Agent 需要 streaming response，SSE or chunk transfer
3. **Token 经济**: 实时 transcript 可能很长，需要滑动窗口 + 摘要策略
4. **Privacy**: transcript 含敏感信息，需要本地优先策略（默认 Web Speech → 本地处理）
5. **Rate Limit**: Mock agent 不限速，LLM agent 需要节流（每 30s 一次）

## 🎁 灵感来源

- **Notion AI Chat**: 实时建议面板嵌入主界面
- **Granola**: 会议录音转录 + AI 摘要
- **Google Meet caption**: 实时 subtitle
- **ClosedAI Whisper**: 远程 STT
- **Linear AI**: Agent 可配置（provider 切换）
- **VSCode Copilot Chat**: "采纳建议" 模式

## 🎬 失败模式 / Pitfalls

1. ❌ **不要默认启用 LLM** — 隐私 + 成本 + 延迟。Mock 必须是默认
2. ❌ **不要 hardcode provider** — 必须有 registry + 配置
3. ❌ **不要无限缓冲** — transcript 必须 sliding-window
4. ❌ **不要忽视权限拒绝** — microphone permission 必须显式处理
5. ❌ **不要无频率限制** — LLM 必须节流

## 📦 数据流

```
[候选人/面试官麦克风]
       ↓ (麦克风音频)
   [STT Provider] (Web Speech / Whisper)
       ↓ (实时 transcript chunk)
   [Transcript Stream Buffer]
       ├── <LiveTranscriptStream /> (UI)
       ├── [QuestionSuggestionAgent] (每 30s / 内容变化触发)
       ↓ (QuestionSuggestion)
       └── <RealtimeQuestionSuggester /> (UI: 采纳 / 重新生成)
```

## ✅ Next Actions

1. Boss 确认此 PRD 后，开始无人值守实施
2. 从 V161 STT 抽象层开始（P0 基础）
3. 每轮完成都按既有流程（commit + push + delivery report + update README）
4. verify:readme 增 + 1 gate，npm test ≥ + 6 tests，coverage ≥ 95%
5. V165 是可选 polish，可根据 V162-V164 反馈决定是否继续

## 📊 ROI 矩阵

| 方向 | 用户价值 | 技术复杂度 | 依赖 | ROI 综合 | 推荐 |
|------|---------|-----------|------|---------|------|
| V161-A STT 抽象层 | ⭐⭐⭐⭐ | ⭐⭐ | 无 | ⭐⭐⭐⭐ | ✅ 第一波 |
| V162-B Transcript UI | ⭐⭐⭐⭐ | ⭐⭐⭐ | V161 | ⭐⭐⭐⭐ | ✅ 第二波 |
| V163-C Agent 接口 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | V161 | ⭐⭐⭐⭐ | ✅ 第三波 |
| V164-D 采纳 UI | ⭐⭐⭐⭐⭐ | ⭐⭐ | V161+C | ⭐⭐⭐⭐⭐ | ✅ 第四波 |
| V165-E Org Memory | ⭐⭐⭐ | ⭐ | V163 | ⭐⭐⭐ | 🟡 可选 |

## 🔌 Bundle Size 影响

- Web Speech: 0 KB (浏览器原生)
- Whisper SDK: 估算 +150 KB gzipped
- LLM Agent: 0 KB (走 server)
- Reka UI (panel + buttons): +3 KB
- **估算 V164 总体影响**: ~20 KB gzipped（不含可选 Whisper SDK）

