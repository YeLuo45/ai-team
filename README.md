# ai-team

> AI-powered team management: smart interviews, member development, skill tracking, growth trajectories.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://yeluo45.github.io/ai-team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-blue)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-blue)](https://tailwindcss.com/)

A TypeScript monorepo inspired by [pi-mono](https://github.com/YeLuo45/pi-mono)'s clean architecture (pi-ai / pi-agent-core / pi-coding-agent / pi-tui), applied to the **AI team management** domain: smart interviews, member training, skill tracking, and growth trajectories.

## Packages

| Package | Description |
|---------|-------------|
| **[@ai-team/core](./packages/ai-team-core)** | Domain types (Candidate/Member/Skill/Interview/Training/Review) + JSON file store |
| **[@ai-team/ai](./packages/ai-team-ai)** | LLM wrapper (OpenAI-compatible + Mock) + interview/training prompt templates |
| **[@ai-team/agent](./packages/ai-team-agent)** | Interview agent (multi-turn dialogue + evaluation) + Training plan agent |
| **[@ai-team/cli](./packages/ai-team-cli)** | Node CLI: `ai-team candidate add`, `interview start`, `team overview` |
| **[@ai-team/web](./packages/ai-team-web)** | React 19 + Vite 6 + Tailwind 4 dashboard |

## Quick Start

```bash
# Install
npm install

# Build all packages
npm run build

# Run CLI (no API key → uses Mock client)
node packages/ai-team-cli/bin/ai-team --help

# Add a candidate
node packages/ai-team-cli/bin/ai-team candidate add "张三" \
  --position "前端工程师" --source linkedin \
  --email "zhangsan@example.com" --tags "React,TypeScript"

# Start an AI interview (interactive, requires TTY)
node packages/ai-team-cli/bin/ai-team interview start <candidate-id>

# View team overview
node packages/ai-team-cli/bin/ai-team team overview

# Build & preview the web dashboard
cd packages/ai-team-web && npm run build && npm run preview
```

## End-to-End Demo

1. Add a candidate via CLI
2. Run an AI interview (LLM-driven multi-turn dialogue)
3. Open the dashboard at `https://yeluo45.github.io/ai-team/` to see results

## LLM Provider

Set `AI_TEAM_LLM_API_KEY` (or `OPENAI_API_KEY`) to use a real LLM. Without a key, a deterministic Mock client is used.

```bash
export AI_TEAM_LLM_API_KEY=sk-xxx
export AI_TEAM_LLM_BASE_URL=https://api.openai.com/v1
export AI_TEAM_LLM_MODEL=gpt-4o-mini
```

Works with any OpenAI-compatible API: OpenAI / Azure / OpenRouter / Ollama / vLLM / LM Studio.

## License

MIT
