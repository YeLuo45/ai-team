# ai-team

> AI 驱动的团队管理：智能面试、成员培养、技能追踪、成长轨迹。

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://yeluo45.github.io/ai-team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-blue)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-blue)](https://tailwindcss.com/)

一个 TypeScript monorepo，受 [pi-mono](https://github.com/YeLuo45/pi-mono) 架构启发（pi-ai / pi-agent-core / pi-coding-agent / pi-tui），应用到 **AI 团队管理** 领域：智能面试、成员培养、技能追踪、成长轨迹。

## 截图

**Dashboard** - 团队概览、统计卡片、最近面试/候选人
**面试详情** - 总评分 + 四维评分条 + 对话记录

👉 在线访问：https://yeluo45.github.io/ai-team/

## 包结构

| 包 | 职责 |
|----|------|
| **[@ai-team/core](./packages/ai-team-core)** | 领域类型 (Candidate/Member/Skill/Interview/Training/Review) + JSON 文件存储 |
| **[@ai-team/ai](./packages/ai-team-ai)** | LLM 包装 (OpenAI 兼容 + Mock) + 面试/培训 prompt 模板 |
| **[@ai-team/agent](./packages/ai-team-agent)** | 面试 Agent (多轮对话 + 评估) + 培训计划 Agent |
| **[@ai-team/cli](./packages/ai-team-cli)** | Node CLI: `ai-team candidate add`, `interview start`, `team overview` |
| **[@ai-team/web](./packages/ai-team-web)** | React 19 + Vite 6 + Tailwind 4 Dashboard |

## 快速开始

```bash
# 安装
npm install

# 构建所有包
npm run build

# 运行 CLI（无 API key 会用 Mock client）
node packages/ai-team-cli/bin/ai-team --help

# 录入候选人
node packages/ai-team-cli/bin/ai-team candidate add "张三" \
  --position "前端工程师" --source linkedin \
  --email "zhangsan@example.com" --tags "React,TypeScript"

# 启动 AI 面试（交互式，需要 TTY）
node packages/ai-team-cli/bin/ai-team interview start <candidate-id>

# 团队概览
node packages/ai-team-cli/bin/ai-team team overview

# 构建并预览 Web Dashboard
cd packages/ai-team-web && npm run build && npm run preview
```

> **⚠️ WSL 用户**: 永远在 **WSL bash** 里跑 `npm install` 和 `node`，不要在 PowerShell 里通过 `\\wsl$\Ubuntu\...` 路径访问。9P/drvfs 挂载是 case-insensitive 且 symlink 语义损坏 — npm workspace 软链会 `EISDIR` 失败，运行时找不到 `@ai-team/core`。详见下方 [常见问题](#常见问题)。

### 🚀 PowerShell 一键搭建 (WSL 用户推荐)

如果你在 PowerShell，但项目在 WSL 里:

```powershell
wsl -e bash -c "cd /home/hermes/projects/ai-team && unset NODE_ENV && npm install --include=dev && npm run build"
```

之后可以在 PowerShell 通过 WSL 调用 CLI:

```powershell
wsl -e bash -c "cd /home/hermes/projects/ai-team && node packages/ai-team-cli/bin/ai-team --help"
wsl -e bash -c "cd /home/hermes/projects/ai-team && node packages/ai-team-cli/bin/ai-team team overview"
```

或者在 PowerShell 里定义个 wrapper:

```powershell
function ai-team { wsl -e bash -c "cd /home/hermes/projects/ai-team && node packages/ai-team-cli/bin/ai-team $args" }
ai-team --help
ai-team team overview
ai-team candidate add "李四" --position "PM" --source referral
```

## 端到端 Demo

1. CLI 录入候选人
2. 启动 AI 面试（多轮对话）
3. 打开 Dashboard `https://yeluo45.github.io/ai-team/` 查看评估结果

## LLM 提供商

设置 `AI_TEAM_LLM_API_KEY` (或 `OPENAI_API_KEY`) 启用真实 LLM。无 key 时使用确定性 Mock client。

```bash
export AI_TEAM_LLM_API_KEY=sk-xxx
export AI_TEAM_LLM_BASE_URL=https://api.openai.com/v1  # 或 OpenRouter / Ollama
export AI_TEAM_LLM_MODEL=gpt-4o-mini
```

支持所有 OpenAI 兼容 API：OpenAI / Azure / OpenRouter / Ollama / vLLM / LM Studio。

## 后续规划 (V2+)

- V2: 技能图谱可视化 (D3.js force graph)
- V3: 培训计划 + 课程推荐
- V4: 1:1 对话模拟 + 绩效评估
- V5: 团队组成分析 + 自动 JD 生成

## 许可

MIT

## 常见问题

### WSL: `npm install` 报 `EISDIR` 或 `ERR_MODULE_NOT_FOUND @ai-team/core`

**症状** (在 PowerShell 通过 `\\wsl$\Ubuntu\...` 访问时):
```
npm error code EISDIR
npm error syscall symlink
npm error path \\wsl$\Ubuntu\wsl$\Ubuntu\...
```
或
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@ai-team/core'
```

**根因**: PowerShell 通过 9P/drvfs 挂载访问 WSL 文件 (`\\wsl$\Ubuntu\...`)。这个挂载是 case-insensitive 且 symlink 语义损坏，所以 npm workspace 软链会失败。

**解决**: 永远在 **WSL bash** 里跑，不要在 PowerShell 里:

```powershell
# 打开 WSL bash
wsl -e bash

# 或者从 PowerShell 直接派发到 WSL:
wsl -e bash -c "cd /home/hermes/projects/ai-team && npm install && npm run build"
```

如果必须在 PowerShell，强制使用扁平 `node_modules`（无软链）:

```powershell
npm install --install-strategy=nested
```

但这样更慢且占更多磁盘。**推荐用 WSL bash。**

### WSL: `NODE_ENV=production` 静默跳过 devDependencies

如果 `tsc`、`vite` 等不在 `node_modules/.bin/` 里，检查:

```bash
echo $NODE_ENV    # 如果是 'production'，npm 会 omit devDeps
```

修复: `unset NODE_ENV` 或在 `npm install` 前 `export NODE_ENV=development`。

### Windows 文件系统上 git 大小写问题

`git status` 可能显示只有大小写差异的文件（如 `AgentRegistry.ts` vs `agentRegistry.ts`）为 "both modified"。所有 git 操作请在 WSL bash 的 case-sensitive ext4 文件系统上跑，不要在 PowerShell 的 `\\wsl$\Ubuntu\...` 路径上。
