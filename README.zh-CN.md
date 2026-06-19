# ai-team

> AI 驱动的团队管理：智能面试、成员培养、技能追踪、成长轨迹、实时洞察。

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://yeluo45.github.io/ai-team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-blue)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-blue)](https://tailwindcss.com/)

基于 [pi-mono](https://github.com/YeLuo45/pi-mono) 干净架构 (pi-ai / pi-agent-core / pi-coding-agent / pi-tui) 的 TypeScript monorepo,应用于 **AI 团队管理** 领域。

## 已交付 (V1-V19, 19 个提案)

- 🎤 **智能面试** (V1) - AI 多轮对话 + 自动评估
- 🧑‍💼 **成员培养** (V1) - AI 生成技能培训计划
- 📊 **技能图谱** (V3) - D3.js 力导向技能/成员关系
- 🎭 **1:1 对话** (V4) - AI 扮演成员,经理 5 种场景
- ⭐ **绩效评估** (V4) - 基于历史自动生成 Review
- 📄 **简历解析** (V6) - PDF 上传 + LLM 提取 + 评分
- 🔌 **插件系统** (V7) - 钩子事件 + 3 个示例插件
- 📥📤 **数据导入导出** (V8b) - JSON / CSV / Markdown
- 🔔 **通知中心** (V8c) - 应用内通知聚合
- 🎛️ **自定义仪表盘** (V8d) - 拖拽 widgets
- 🧠 **AI 智能分析** (V14) - 漏斗/技能缺口/成长/建议/异常
- 📡 **实时 SSE** (V15) - Server-Sent Events
- 🔍 **全文搜索** (V16) - `⌘K` 命令面板 (跨 6 实体)
- 🎯 **上下文简历评分** (V19) - 综合简历 + 团队缺口

## 7 个包

| 包 | 描述 |
|----|------|
| **[@ai-team/core](./packages/ai-team-core)** | 领域类型 (Candidate/Member/Skill/Interview/Training/Review) + JSON 存储 + 工具 |
| **[@ai-team/ai](./packages/ai-team-ai)** | LLM 封装 (OpenAI 兼容 + Mock) + 面试/培训/洞察 prompt 模板 |
| **[@ai-team/agent](./packages/ai-team-agent)** | 8 个 agent: Interview/Training/1:1/Review/Resume/Insights/Score + 搜索引擎 |
| **[@ai-team/server](./packages/ai-team-server)** | Express REST API (3000) + 50+ 端点 + SSE + LLM 代理 |
| **[@ai-team/tui](./packages/ai-team-tui)** | Ink 交互式 TUI (4 视图 + 表单) |
| **[@ai-team/cli](./packages/ai-team-cli)** | Node CLI: `ai-team candidate add`, `interview start`, `team overview`, `tui` |
| **[@ai-team/web](./packages/ai-team-web)** | React 19 + Vite 6 + Tailwind 4 + D3.js (10 页面, 7 模态框, 命令面板, Toast) |

## 快速开始

### 前置条件

- Node.js ≥ 20 (Node 22+ 用于 `tsx watch` 自动重载)
- npm 10+
- (可选) `AI_TEAM_LLM_API_KEY` 用于真实 LLM (OpenAI 兼容)

### 安装

```bash
# WSL 用户请先看故障排除
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

### 4 种运行模式

#### 1. Server (Express REST, 3000)

```bash
# 生产模式 (用预编译的 dist/)
npm run dev:server

# 开发模式 (热重载)
cd packages/ai-team-server && npm run dev
```

**50+ 端点:** `/api/candidates`, `/api/members`, `/api/interviews`, `/api/trainings`, `/api/reviews`, `/api/skills`, `/api/plugins`, `/api/notifications`, `/api/insights/*`, `/api/search`, `/api/resume/*`, `/api/one-on-one/*`, `/api/export`, `/api/import`, `/api/events/stream` (SSE).

#### 2. CLI (一次性命令)

```bash
# 构建后,全局链接 CLI
cd packages/ai-team-cli && npm link
ai-team --help

# 或通过 node 调用
node packages/ai-team-cli/bin/ai-team --help

# 示例
ai-team candidate add "张三" --position "前端工程师" --source linkedin
ai-team member add "李四" --role "Tech Lead" --team "Platform" --level "P7"
ai-team interview start <candidate-id>
ai-team team overview
ai-team tui  # 启动交互式 TUI
```

#### 3. TUI (Ink 终端 UI)

```bash
ai-team tui
```

或: `node packages/ai-team-cli/bin/ai-team tui`

视图: Dashboard / Candidates / Members / Interviews. 按 `?` 看帮助, `q` 退出.

#### 4. Web (React 仪表盘)

```bash
cd packages/ai-team-web && npm run dev
# → http://localhost:5173 (代理 /api → :3000)
```

**页面:** Dashboard / Candidates / Members / Interviews / Skills / Trainings / Reviews / Plugins / Insights / Notifications / Data

**功能:**
- `⌘K` / `Ctrl+K` - 命令面板 (全局搜索)
- 6 个 dashboard widgets (可拖拽, localStorage 布局)
- Toast 通知
- AI 面试模拟器
- 简历上传 + 解析
- 技能图谱 (D3.js)

#### 5. 测试

```bash
# 运行全部 390 个测试 (100% 通过率)
npm test

# 带覆盖率
npm run test:coverage
```

## 架构

```
ai-team (root, npm workspaces)
├── packages/ai-team-core       (领域: 类型 + JSON 存储)
├── packages/ai-team-ai         (LLM: OpenAI 兼容 + Mock + prompts)
├── packages/ai-team-agent      (8 个 agent + 搜索引擎)
├── packages/ai-team-server     (Express: 50+ REST 端点 + SSE)
├── packages/ai-team-tui        (Ink 4 视图交互式终端)
├── packages/ai-team-cli        (commander.js CLI → tui 入口)
└── packages/ai-team-web        (React 19 + Vite 6 + Tailwind 4)
```

**数据流:** TUI / Web → Express Server (3000) → JSON 文件 (按实体) → `@ai-team/core`

**LLM 流:** 所有客户端 (CLI / TUI / Web) → REST `/api/*` → Server → LLM Client (OpenAI 兼容 或 Mock)

## LLM 提供方

设置 `AI_TEAM_LLM_API_KEY` (或 `OPENAI_API_KEY`) 使用真实 LLM. 不设置则用确定性 Mock.

```bash
export AI_TEAM_LLM_API_KEY=sk-xxx
export AI_TEAM_LLM_BASE_URL=https://api.openai.com/v1  # 可选
export AI_TEAM_LLM_MODEL=gpt-4o-mini  # 可选
```

支持任何 OpenAI 兼容 API: OpenAI / Azure / OpenRouter / Ollama / vLLM / LM Studio.

## 提案历史 (19 个)

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

## 测试

- **390 个测试** (100% 通过率, 7 个跳过)
- **vitest** + **@vitest/coverage-v8** + **supertest** + **happy-dom**
- 覆盖率重点: core (100%), ai (98%), agent (80-95%), server (87%), tui API (90%), web lib (53%), CLI (50-90%)

```bash
npm test              # 运行全部
npm run test:coverage # 带覆盖率报告
```

## 许可

MIT

## 故障排除

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
# 打开 WSL bash
wsl -e bash

# 或从 PowerShell 直接派发:
wsl -e bash -c "cd /home/hermes/projects/ai-team && npm install && npm run build"
```

如果必须留在 PowerShell,用 flat `node_modules` (无软链):

```powershell
npm install --install-strategy=nested
```

但这样更慢且占更多磁盘. **WSL bash 始终是首选.**

### WSL: `NODE_ENV=production` 静默跳过 devDependencies

如果 `tsc`, `vite` 等不在 `node_modules/.bin/`,检查:

```bash
echo $NODE_ENV    # 如果是 'production',npm 会省略 devDeps
```

修复: `npm install` 之前 `unset NODE_ENV` 或 `export NODE_ENV=development`.

### Server: `node: bad option: --experimental-strip-types`

这个选项只在 Node 22+ 可用. 如果你是 Node 20,用:

```bash
cd packages/ai-team-server
npx tsx watch src/index.ts
```

或者先构建再运行编译后的版本:

```bash
npm run build
npm run dev:server
```

### Web build: `useState` 已声明但未使用 / 找不到 `HashRouter`

通常是 React 或 React Router 的 import 被意外删了. 确保 `App.tsx` 有:

```ts
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
```

如果 `paletteOpen` 未使用,要么用它,要么删掉 `useState` 声明.

### CLI: `ai-team: command not found`

`npm install` 后,全局链接 CLI:

```bash
cd packages/ai-team-cli && npm link
```

或直接用 node 调用:

```bash
node packages/ai-team-cli/bin/ai-team --help
```

### Git on Windows 文件系统 (大小写不敏感)

`git status` 可能显示 "both modified" 幻像 (文件只差大小写). 在 WSL bash (大小写敏感的 ext4) 里跑 git,不要在 PowerShell 访问 `\\wsl$\Ubuntu\...` 跑.

## 文档

- **English**: [README.md](./README.md)
- **中文**: this file
