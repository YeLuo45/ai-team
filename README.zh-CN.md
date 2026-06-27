# ai-team

> AI 驱动的团队管理：智能面试、成员培养、技能追踪、成长轨迹、实时洞察。

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://yeluo45.github.io/ai-team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-blue)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-blue)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/tests-852%20passing-brightgreen)](./vitest.config.ts)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

基于 [pi-mono](https://github.com/YeLuo45/pi-mono) 干净架构 (pi-ai / pi-agent-core / pi-coding-agent / pi-tui) 的 TypeScript monorepo,应用于 **AI 团队管理** 领域。

## 🚀 30 秒快速启动

```bash
git clone https://github.com/YeLuo45/ai-team.git
cd ai-team
unset NODE_ENV && NODE_ENV=development npm install --include=dev
npm run build
npm run dev           # ← 一键同时启动 server (3000) + web (5173)
```

打开浏览器:
- **Web UI**: http://localhost:5173 (自动代理 `/api` → 3000)
- **API**: http://localhost:3000/api/health

按 `Ctrl+C` 干净退出.

> 完整故障排除见下方 [故障排除](#故障排除) 章节. WSL 用户先看 WSL 5 大坑.

## ✅ 已交付 (V1-V19, 19 个提案)

| 类别 | 功能 | 版本 |
|------|------|------|
| 🎤 **智能面试** | AI 多轮对话 + 自动评估 | V1 |
| 🧑‍💼 **成员培养** | AI 生成技能培训计划 | V1 |
| 📊 **技能图谱** | D3.js 力导向技能/成员关系 | V3 |
| 🎭 **1:1 对话** | AI 扮演成员,经理 5 种场景 | V4 |
| ⭐ **绩效评估** | 基于历史自动生成 Review | V4 |
| 📄 **简历解析** | PDF 上传 + LLM 提取 + 评分 | V6 |
| 🔌 **插件系统** | 钩子事件 + 3 个示例插件 | V7 |
| 📥📤 **数据导入导出** | JSON / CSV / Markdown | V8b |
| 🔔 **通知中心** | 应用内通知聚合 | V8c |
| 🎛️ **自定义仪表盘** | 拖拽 widgets | V8d |
| 🧠 **AI 智能分析** | 漏斗/技能缺口/成长/建议/异常 | V14 |
| 📡 **实时 SSE** | Server-Sent Events | V15 |
| 🔍 **全文搜索** | `⌘K` 命令面板 (跨 6 实体) | V16 |
| 🎯 **上下文简历评分** | 综合简历 + 团队缺口 | V19 |
| 🧪 **测试基础设施** | vitest + 859 tests (852 passed, 7 skipped) | V9-V13 |
| 📊 **招聘漏斗看板** | sourced→screening→interview→evaluation→offer→hired | V21 |
| 🛰️ **Agent 审计台** | 调用/耗时/失败率统计 + stats endpoint | V22 |
| 🔥 **能力热力图** | 团队×岗位 × 技能 三维聚合 | V23 |
| 🌱 **Demo 数据工厂** | small/medium/large 三档一键填充 | V24 |
| ⚡ **Coverage Gate 3.0** | 95% 分支阈值 + 死分支清理 | V25 |
| 📊 **Web 漏斗 + 热力图** | React 页面 + loading/error/retry | V26 |
| 📡 **审计 SSE 推送** | /api/agent-audit/stream + 实时控制台 | V27 |
| 🚀 **`ai-team dev`** | 清空 → seed → 启动 server+web | V28 |
| 🔗 **Pipeline 自动推进** | 面试结束 → pipeline evaluation | V29 |
| ⚖️ **Legal 风险 Agent + 居中 Web Shell** | 法务风险分级 + 对称响应式布局 | V30 |
| 🛡️ **Tech Policy Agent** | 安全/合规/运营/治理风险评分 + 整改 | V31 |
| 📺 **Media Compliance Agent** | 微信/抖音/小红书/B站 渠道感知 PII + 授权审查 | V31 |
| 🧭 **Multi-Agent Workflow Orchestrator** | Resume→Interview→Score→Legal→TechPolicy→MediaCompliance→Recommendation 编排 | V36 |
| 🧑‍⚖️ **Human Approval Gate** | 高/关键风险自动进入人工复核队列 | V37 |
| 🧪 **What-if Lab + Org Memory + LLMOps** | 团队影响模拟、组织记忆上下文、Token/成本/延迟摘要 | V38-V40 |
| ✅ **README Command Verification** | `npm run verify:readme` 真实验收 README 核心命令 | V41 |
| 🖥️ **Workflow Web Console** | `/orchestration` 可视化执行 workflow、审批队列、LLMOps 告警 | V42 |
| 💾 **Approval Persistence API** | `/api/team-orchestration/approvals` 创建/列表/决策复核记录 | V43 |
| 🚨 **LLMOps Alerting API** | `/api/team-orchestration/llmops/alerts` 成本/延迟/fallback/error 策略告警 | V44 |
| 🧠 **Org Memory Store** | JSON 持久化 `OrchestrationOrgMemoryStore` 与带引用上下文构建 | V45 |
| 🧮 **Scenario Batch Runner** | `buildScenarioBatch` 多候选人排序，返回 winners/dropped | V46 |
| 🚦 **Release Hardening Report** | `npm run release:check` 汇总命令/覆盖率/文档成单一就绪信号 | V47 |
| 🧠 **Org Memory into Agent Prompt** | `injectOrgMemory` 把组织记忆嵌入面试/培训/评估 prompt | V48 |
| 🪝 **Pre-commit Hook** | `npm run hooks:install` 把 `verify:readme` + `release:check` 接到 `.git/hooks/pre-commit` | V50 |
| 📊 **Delivery Evidence Summary** | `npm run delivery:summary` 汇总测试/覆盖率/README/构建交付证据 | V51-V52 |
| 🧱 **编排模块拆分** | 拆分 500+ 行 orchestration 巨型模块，保留 barrel import 兼容 | V53 |
| 🖥️ **Web 编排台补齐** | `/orchestration` 支持批量场景、组织记忆编辑、交付摘要、候选人参数输入 | V54/V56/V59 |
| 📝 **交付报告自动化** | `npm run delivery:report` 写入 `docs/delivery/<version>-delivery-report.md`，`release:check` 串联构建/测试/README/覆盖率/报告 | V55/V58/V60 |
| 🗂️ **交付报告索引** | `npm run delivery:index` 生成 `docs/delivery/index.md` 与浏览器安全 release evidence JSON | V61/V63 |
| 🎛️ **编排台预设 + 证据下载** | `/orchestration` 新增 Security preset 与一键下载 release evidence JSON | V62/V65 |
| 🔁 **提案同步规划器** | 纯函数生成 MCP 安全正向状态路径，避免跳级/回退状态 | V64 |
| 🧰 **交付驾驶舱强化** | 证据筛选/导入查看器、提案交付向导、发布就绪看板、MCP 状态回退防护、可提交 diff 分类 | V66-V72 |
| 🚚 **交付闭环自动化** | 浏览器安全证据、MCP 执行确认计划、驾驶舱服务端/Web 恢复持久化、证据 schema 批量审计、质量门禁、后续方向生成、CI 证据摄取、审计时间线、Release Ops API、上传桥接、审计回放门禁、历史快照、签名来源、回放 diff | V73-V103 |
| 🎨 **Web 交互体验底盘** | Design System 12 原语 + 4 主题（light/dark/sepia/nord）+ AppShell（Sidebar 4 分组 + Topbar + 居中 Main）+ Candidates/Pipeline/Heatmap 改造 | V107-V108 |
| 🧠 **Web 统一数据层** | ResourceCache + EventBus + useResource/useResourceMutation + SSE Bridge（topic→resource 自动失效）+ 15 useXxx hook + 4 乐观更新（Pipeline/Approval/Interview/Candidate）| V109-V111 |
| 🧪 **Web 测试 + 协同视图** | 5 路径 happy-dom e2e flow（登录/列表/面试/终结/审批）+ CandidateDrawer/MemberDrawer/InterviewCalendar + 8 个 calendar helper | V112-V114 |
| ⌨️ **状态统一 + 键盘 + 权限 + PWA + a11y** | ErrorBoundary + ErrorState + 12 键盘快捷键（palette/help/4 分组/5 go-to）+ KeyboardHelpOverlay + 4 角色 22 permission RBAC + useOnlineStatus + useSkipToMain + announceToScreenReader | V115-V116 |
| 🔌 **SSE Bridge 接入 + 移动端 + Onboarding** | AppSseBootstrap（3 默认 bridge 接入 + topic→resource 失效）+ HamburgerNav/MobileBottomBar/OfflineBanner（lg:hidden 移动导航）+ PWA manifest/service worker/PwaInstallPrompt + 3 步 Onboarding Tour（候选人→面试→Pipeline） | V117-V119 |
| 🚀 **App 生产接入 + Orchestration 拆分 + PWA 真服务化** | App.tsx 接入 SSE/HamburgerNav/OfflineBanner/OnboardingTour + useOrchestrationData/useApprovalData/useDeliveryData/useWorkflowRunner 4 hooks + OrchestrationProvider + buildServiceWorkerScript（cache-first + network-first + offline）+ manifest.json + 192/512 PNG icons | V120-V122 |
| 🧱 **Orchestration 4 Panels + SkillGraph V2** | WorkflowPanel / ApprovalPanel / DeliveryPanel / OperationsPanel 4 子组件 + DEFAULT_PANEL_TABS + 9 纯函数 helpers（selectors / filters / transforms）+ ZoomController/NodeSelector/TooltipRenderer + SkillGraphV2 React 组件（zoom/pan/下钻/过滤） | V123-V124 |
| 🪟 **ConsoleShell 4 Tabs + A11y CI Gate** | ConsoleShell（4 tabs: workflow/approvals/delivery/operations）+ useShellTab/useConsoleTab（localStorage 持久化）+ 7 纯函数 helpers + A11yChecker（6 默认规则: image-alt/button-name/link-name/form-label/img-presentation/heading-order）+ 9 纯函数 helpers（accessible name/aria role/contrast/focusable）+ violationsToReport + useA11yChecker + A11yAuditBadge | V125-V126 |
| 🪪 **App A11y 接入 + verify:readme a11y gate** | A11yGateProvider/useA11yGate + A11yGateConfig + 6 gate helpers + runA11yGateCheck + useSkipToMainElement + A11yBadgeSlot + AppAccessibilityRoot + scripts/a11y-gate.mjs（verify:readme 集成 15/16） + App.tsx /orchestration 改用 ConsoleShell | V127-V128 |

## 7 个包

| 包 | 描述 |
|----|------|
| **[@ai-team/core](./packages/ai-team-core)** | 领域类型 (Candidate/Member/Skill/Interview/Training/Review) + JSON 存储 + 工具 |
| **[@ai-team/ai](./packages/ai-team-ai)** | LLM 封装 (OpenAI 兼容 + Mock) + 面试/培训/洞察 prompt 模板 |
| **[@ai-team/agent](./packages/ai-team-agent)** | 11 个 agent: Interview/Training/1:1/Review/Resume/Insights/Score/Legal/TechPolicy/MediaCompliance + 搜索引擎 |
| **[@ai-team/server](./packages/ai-team-server)** | Express REST API (3000) + 50+ 端点 + SSE + LLM 代理 |
| **[@ai-team/tui](./packages/ai-team-tui)** | Ink 交互式 TUI (4 视图 + 表单) |
| **[@ai-team/cli](./packages/ai-team-cli)** | Node CLI: `ai-team candidate add`, `interview start`, `team overview`, `tui` |
| **[@ai-team/web](./packages/ai-team-web)** | React 19 + Vite 6 + Tailwind 4 + D3.js (10 页面, 7 模态框, 命令面板, Toast) |

## 🛠️ 快速开始 (详细)

### 前置条件

- Node.js ≥ 20 (Node 22+ 用于 `tsx watch` 自动重载)
- npm 10+
- (可选) `AI_TEAM_LLM_API_KEY` 用于真实 LLM (OpenAI 兼容)

### 安装

```bash
# WSL 用户先看故障排除
npm install
```

如果 `tsc`, `vite` 等不在 `node_modules/.bin/`,可能需要:

```bash
unset NODE_ENV
NODE_ENV=development npm install --include=dev
```

### 构建全部 7 个包

```bash
npm run build
```

按顺序构建: `core → ai → agent → server → tui → cli → web`.

## 🎯 运行模式 (3 种)

### 模式 1: `npm run dev` — **推荐** (一键启动 server + web)

```bash
npm run dev
# → [server] listening on http://localhost:3000
# → [web]    VITE ready, http://localhost:5173
```

两个进程并发运行,着色输出 (蓝色=server, 绿色=web), `Ctrl+C` 干净退出.

> 如果你只想要开发模式 (热重载): `npm run dev:tsc` (用 `tsx watch` 替代 dist)

### 模式 2: CLI (一次性命令)

```bash
# 构建后,全局链接 CLI
cd packages/ai-team-cli && npm link
ai-team --help

# 或直接通过 node 调用
node packages/ai-team-cli/bin/ai-team --help

# 示例
ai-team candidate add "张三" --position "前端工程师" --source linkedin
ai-team member add "李四" --role "Tech Lead" --team "Platform" --level "P7"
ai-team interview start <candidate-id>
ai-team team overview
ai-team tui  # 启动交互式 TUI
```

### 模式 3: TUI (Ink 终端 UI)

```bash
ai-team tui
```

或: `node packages/ai-team-cli/bin/ai-team tui`

视图: Dashboard / Candidates / Members / Interviews. 按 `?` 看帮助, `q` 退出.

### 模式 4: 单独启动 server 或 web (高级)

```bash
# 只启动 server
npm run dev:server

# 只启动 web (需 server 已运行,否则 503)
npm run dev:web
```

### 模式 5: 测试

```bash
# 运行全部测试
npm test

# 单包测试
cd packages/ai-team-core && npm test

# 带覆盖率
npm run test:coverage

# 验证 README 核心命令可交付
npm run verify:readme

# 输出交付验收证据摘要
npm run delivery:summary
```

覆盖率门槛：确定性库/运行时模块 95%+；UI 页面、CLI 命令胶水、LLM 编排和环境 fallback 不计入全局阈值。
当前覆盖率门槛结果：statements 99.15%，branches 96.18%，functions 98.83%，lines 99.68%。

## 🌐 API 端点 (50+)

**核心 CRUD:**
- `/api/candidates` / `/api/members` / `/api/interviews` / `/api/trainings` / `/api/reviews` / `/api/skills` / `/api/plugins` / `/api/notifications`

**AI 功能:**
- `/api/interviews/start` - 启动 AI 面试
- `/api/interviews/:id/answer` - 提交回答
- `/api/interviews/:id/finalize` - 结束并评分
- `/api/one-on-one/start|message|end` - 1:1 对话
- `/api/resume/parse` - PDF 解析
- `/api/resume/score-with-context` - 上下文简历评分
- `/api/trainings/generate` - AI 培训计划
- `/api/performance-reviews/generate` - Review 草稿

**智能分析 (V14):**
- `/api/insights/funnel` - 招聘漏斗
- `/api/insights/skill-gaps?required=...` - 技能缺口
- `/api/insights/member-growth/:id` - 成员成长
- `/api/insights/recommendations` - AI 建议
- `/api/insights/anomalies` - 异常检测

**团队编排 (V36-V41):**
- `/api/team-orchestration/workflow` - 多 Agent 候选人链路编排 + 推荐
- `/api/team-orchestration/simulate` - What-if 团队技能/人头影响模拟
- `/api/team-orchestration/org-memory` - 组织记忆上下文与引用生成
- `/api/team-orchestration/llmops` - LLM Token/成本/延迟/fallback 摘要
- `/api/team-orchestration/llmops/alerts` - LLMOps 成本/延迟/fallback/error 策略告警
- `/api/team-orchestration/approvals` - 人工复核记录创建与列表
- `/api/team-orchestration/approvals/:id/decision` - 人工复核 approve/reject/edit 决策
- `/api/team-orchestration/readme-checklist` - README 命令交付检查清单

**V45 Org Memory:**
- `/api/team-orchestration/org-memory/:team` - 上报团队组织记忆
- `/api/team-orchestration/org-memory/:team/context` - 用引用生成上下文

**V46 Batch Scenario:**
- `/api/team-orchestration/simulate/batch` - 多候选人批量排序

**V47 Release Report:**
- `/api/team-orchestration/release-report` - 命令/覆盖率/文档汇总就绪信号
- `npm run release:check` - 终端就绪自检（build + test + verify:readme + coverage）

**V51 Delivery Evidence:**
- `npm run delivery:summary` - 从 `coverage/coverage-final.json` 与可选 `AI_TEAM_TEST_LOG` / `AI_TEAM_README_LOG` / `AI_TEAM_BUILD_LOG` 输出测试、增量覆盖率、README 命令和构建状态的交付摘要

**V101-V103 Release Operations:**
- `/api/team-orchestration/release-operations/history` - 生成 Release Ops 历史快照
- `/api/team-orchestration/ci-artifact-provenance` - 校验 CI artifact 签名来源/commit/workflow 元数据
- `/api/team-orchestration/audit-replay-diff` - 渲染提案 replay 前后状态路径 diff
- `ai-team delivery release-operations-history` / `ci-artifact-provenance` / `proposal-replay-diff` - 终端侧同等只读模型输出

**实用工具:**
- `/api/search?q=&type=&limit=` - 全文搜索
- `/api/export?format=json|csv|md` - 数据导出
- `/api/import` - 数据导入
- `/api/team` - 聚合数据 (单端点拉所有)
- `/api/stats` - 统计
- `/api/events/stream` - SSE 实时事件

## 🏗️ 架构

```
ai-team (root, npm workspaces)
├── packages/ai-team-core       (领域: 类型 + JSON 存储)
├── packages/ai-team-ai         (LLM: OpenAI 兼容 + Mock + prompts)
├── packages/ai-team-agent      (11 个 agent + 搜索引擎)
├── packages/ai-team-server     (Express: 50+ REST 端点 + SSE)
├── packages/ai-team-tui        (Ink 4 视图交互式终端)
├── packages/ai-team-cli        (commander.js CLI → tui 入口)
└── packages/ai-team-web        (React 19 + Vite 6 + Tailwind 4)
```

**数据流:** TUI / Web → Express Server (3000) → JSON 文件 (按实体) → `@ai-team/core`

**LLM 流:** 所有客户端 (CLI / TUI / Web) → REST `/api/*` → Server → LLM Client (OpenAI 兼容 或 Mock)

**依赖规则:**
- `core` → 任何包都不能依赖 (无依赖)
- `ai` → 只能依赖 LLM 库
- `agent` → core, ai
- `server` → core, ai, agent
- `tui` → core, ai, agent
- `cli` → 全部
- `web` → **只能**通过 HTTP 依赖 server (不能直接 import core/ai/agent)

## 🧠 LLM 提供方

设置 `AI_TEAM_LLM_API_KEY` (或 `OPENAI_API_KEY`) 使用真实 LLM. 不设置则用确定性 Mock.

```bash
export AI_TEAM_LLM_API_KEY=sk-xxx
export AI_TEAM_LLM_BASE_URL=https://api.openai.com/v1  # 可选
export AI_TEAM_LLM_MODEL=gpt-4o-mini  # 可选
```

支持任何 OpenAI 兼容 API: OpenAI / Azure / OpenRouter / Ollama / vLLM / LM Studio.

## 📝 提案历史 (19 个)

| # | 版本 | 描述 |
|---|------|------|
| P-20260618-001 | V1 | 启动 (TS monorepo + 5 agents + 5 包) |
| P-20260618-002 | V2 | TUI 模式 (Ink) + Web 模式 + Express server |
| P-20260619-001 | V3 | 技能图谱 (D3.js) + 培训计划 UI |
| P-20260619-002 | V4+V5 | 1:1 对话模拟 + 绩效评估 |
| P-20260619-003 | V6+V7 | 简历解析 (PDF/LLM) + 插件系统 |
| P-20260619-004 | V8b/c/d | 数据导入导出 + 通知中心 + 自定义仪表盘 |
| P-20260619-005 | V9-V13 | 测试基础设施 (vitest) + 覆盖率 |
| P-20260619-006 | V14+V15 | AI 智能分析 + 实时 SSE |
| P-20260619-007 | V16+V19 | 全文搜索 (⌘K) + 上下文简历评分 |

## 🧪 测试

- **1201 个测试** (1194 passed, 7 skipped)
- **vitest** + **@vitest/coverage-v8** + **supertest** + **happy-dom**
- 覆盖率重点: core (100%), ai (98%), agent (80-95%), server (87%+), tui API (90%), web lib (53%+), CLI (50-90%)

```bash
npm test              # 运行全部
npm run test:coverage # 带覆盖率报告
```

## 🚀 后续迭代方向 (V20+)

### 🌟 V20: 多用户与认证 (推荐下一步)
- 用户账户 (注册/登录 + 密码哈希)
- 角色: admin / manager / interviewer / viewer
- 操作审计日志 (谁改了什么)
- 数据隔离 (按 team)
- 邀请机制
- **SSE 鉴权** (解决 V15 的安全问题)
- 预计: 3-5 天, 600+ 行

### 📬 V21: 集成通知
- Slack Notifier (webhook URL 配 plugin config, 事件自动推送)
- Email Digest (每日/每周摘要, nodemailer)
- 通用 Webhook Out (自定义 JSON payload)
- 复用现有 `pluginManager.fireHook()` 架构
- 预计: 2-3 天, 400 行

### 🌐 V22: 国际化 (i18n)
- 中英双语切换
- react-i18next 集成
- 邮件/Slack 通知双语模板
- 预计: 1-2 天, 200 行

### 📱 V23: PWA + 移动适配
- vite-plugin-pwa (Service Worker)
- manifest.json + installable
- 移动端响应式优化
- 离线缓存 (查看数据)
- 预计: 1-2 天, 150 行

### 🤖 V24: 多 LLM Provider 配置
- 设置页: AI_TEAM_LLM_API_KEY / MODEL / BASE_URL 可在 Web 配
- 切换 provider (OpenAI / Anthropic / Ollama)
- 按 agent 选择不同模型 (interview 用 fast model, review 用 strong model)
- 预计: 2-3 天, 300 行

### 🔐 V25: 数据加密 + 备份
- JSON 文件透明加密 (AES-256)
- 自动每日备份 (zip 打包)
- 从备份还原
- 预计: 1-2 天, 200 行

### 💡 V26+: 高级功能
- **AI 自动反馈**: 面试后自动给候选人发反馈邮件
- **视频面试集成**: Zoom / 腾讯会议 API
- **候选人门户**: 候选人自己上传简历 + 查看面试进度
- **多语言支持** (V22)
- **GraphQL API** (替代 REST)
- **WebSocket 双向** (替代 SSE)

## 📂 项目状态

```
代码:       7 packages / 11 agents / 50+ 端点 / 10 页面 / 7 模态框
测试:       852 passed / 859 total / 7 skipped
文档:       README 中英双版 + 故障排除 + 5 步快速开始
提案:       19 个 (P-20260618-001 ~ P-20260620-003)
沉淀:       5 个 pi-mono skill + WSL 故障排除补丁
GitHub:     https://github.com/YeLuo45/ai-team
```

## 📄 许可

MIT

## 🛠️ 故障排除

### WSL: `npm install` 报 `EISDIR` 或 `ERR_MODULE_NOT_FOUND @ai-team/core`

**症状** (PowerShell 访问 `\\wsl$\Ubuntu\...` 路径):
```
npm error code EISDIR
npm error syscall symlink
```
或
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@ai-team/core'
```

**根因**: PowerShell 通过 9P/drvfs 挂载 (`\\wsl$\Ubuntu\...`) 访问 WSL 文件. 这个挂载是大小写不敏感的,软链语义有问题,npm workspace 软链会失败.

**修复**: 始终在 **WSL bash** 里运行,不要用 PowerShell:

```powershell
wsl -e bash -c "cd /home/hermes/projects/ai-team && npm install && npm run build"
```

或:

```bash
# WSL bash 里
unset NODE_ENV
NODE_ENV=development npm install --include=dev
```

### WSL: `NODE_ENV=production` 静默跳过 devDependencies

```bash
echo $NODE_ENV    # 如果是 'production',npm 会省略 devDeps
```

修复: `npm install` 之前 `unset NODE_ENV` 或 `export NODE_ENV=development`.

### Server: `node: bad option: --experimental-strip-types` 或 `Cannot find module 'tsx/cjs'`

这个选项只在 Node 22.6+ 可用. 如果你是 Node 20,用 `npm run dev:server` (内部用 `tsx`):
```json
"dev": "node --import tsx --watch src/index.ts"
```

或者先构建再运行:
```bash
npm run build && npm run dev:server
```

### Web: 浏览器空白 + `You cannot render a <Router> inside another <Router>`

`main.tsx` 已经包了 `<HashRouter>`, `App.tsx` 不能也包. 修复: 移除 App.tsx 内的 HashRouter.

**约定:** Entry = Router, App = routed app, App 内不放 Router.

### Server: `Error: listen EADDRINUSE: address already in use :::3000`

前一个 server 没杀干净:
```bash
ss -tlnp 2>/dev/null | grep :3000    # 找 PID
kill <PID>                            # 杀
npm run dev:server
```

或一键:
```bash
pkill -f "node.*src/index" 2>/dev/null
pkill -f "node.*dist/index" 2>/dev/null
sleep 1
npm run dev
```

### CLI: `ai-team: command not found`

`npm install` 后,全局链接 CLI:
```bash
cd packages/ai-team-cli && npm link
```

或直接用 node 调用:
```bash
node packages/ai-team-cli/bin/ai-team --help
```

### Git 在 Windows 文件系统 (大小写不敏感) 出现 "both modified" 幻像

在 WSL bash (大小写敏感的 ext4) 里跑 git,不要在 PowerShell 访问 `\\wsl$\Ubuntu\...` 跑.

### Web 构建: `useState` / `HashRouter` 找不到

检查 import 列表是否完整. App.tsx 必须:
```ts
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
```

或如果用 `main.tsx` 包 Router, App.tsx 只 import `Routes, Route, NavLink`.

## 📚 文档

- **English**: [README.md](./README.md)
- **中文**: this file

## 🧠 沉淀到 pi-mono 知识库

5 个新 skills (在 `~/.hermes/skills/`):
- `architecture/ai-monorepo-architecture` - 7 包架构
- `software-development/mock-llm-context-priority` - mock LLM 设计模式
- `software-development/vitest-monorepo-setup` - 测试基础设施
- `devops/wsl-npm-dev-environment` - WSL + npm + Node 全套坑
- `workflow/ai-monorepo-iteration-workflow` - P-XXX 迭代模式
