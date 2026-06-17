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
