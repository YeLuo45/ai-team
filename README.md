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
| **[@ai-team/server](./packages/ai-team-server)** | Express REST API server (port 3000) + LLM proxy |
| **[@ai-team/tui](./packages/ai-team-tui)** | Ink-based interactive TUI (4 views + forms) |
| **[@ai-team/cli](./packages/ai-team-cli)** | Node CLI: `ai-team candidate add`, `interview start`, `team overview`, `tui` |
| **[@ai-team/web](./packages/ai-team-web)** | React 19 + Vite 6 + Tailwind 4 dashboard (interactive with forms & interview simulator) |

## Quick Start

```bash
# Install
npm install

# Build all 7 packages
npm run build

# 1. Start the server (one terminal)
npm run dev:server
# → listening on http://localhost:3000

# 2. Use CLI (another terminal)
node packages/ai-team-cli/bin/ai-team --help
node packages/ai-team-cli/bin/ai-team candidate add "张三" \
  --position "前端工程师" --source linkedin --email "zhangsan@example.com"

# 3. Launch TUI mode (interactive terminal UI)
node packages/ai-team-cli/bin/ai-team tui

# 4. Launch Web mode (interactive browser)
cd packages/ai-team-web && npm run dev
# → http://localhost:5173 (proxies /api → :3000)
```

## Three Modes (V2+)

### 🖥️ CLI mode — one-shot commands
```bash
ai-team candidate add "张三" --position "前端工程师"
ai-team interview start <candidate-id>
ai-team team overview
```

### ⌨️ TUI mode — interactive terminal UI
```bash
ai-team tui
```
Ink-based 4 views: Dashboard / Candidates / Members / Interviews. Forms to add candidates/members. Start AI interviews from Candidates page. Press `?` for help, `q` to quit.

### 🌐 Web mode — interactive browser
```bash
# Requires server running on 3000
cd packages/ai-team-web && npm run dev
```
React 19 dashboard with:
- "Add" buttons on Candidates / Members pages (live data)
- "Start interview" button per candidate → in-browser AI chat
- Real-time data refresh

**Note**: Web mode auto-detects whether the server is running:
- If yes → live data with forms, add buttons, interview simulator
- If no → falls back to static build-time data (read-only)

> **⚠️ WSL users**: Always run `npm install` and `node` from **WSL bash**, not from PowerShell on the `\\wsl$\Ubuntu\...` path. The 9P/drvfs mount is case-insensitive and has broken symlink semantics — npm workspace symlinks will fail with `EISDIR` and `ERR_MODULE_NOT_FOUND`. See [Troubleshooting](#troubleshooting) below.

### 🚀 One-shot PowerShell setup (recommended for WSL users)

If you're in PowerShell but the project lives in WSL, run this:

```powershell
wsl -e bash -c "cd /home/hermes/projects/ai-team && unset NODE_ENV && npm install --include=dev && npm run build"
```

After that, you can run the CLI from PowerShell via WSL dispatch:

```powershell
wsl -e bash -c "cd /home/hermes/projects/ai-team && node packages/ai-team-cli/bin/ai-team --help"
wsl -e bash -c "cd /home/hermes/projects/ai-team && node packages/ai-team-cli/bin/ai-team team overview"
```

Or define a PowerShell wrapper:

```powershell
function ai-team { wsl -e bash -c "cd /home/hermes/projects/ai-team && node packages/ai-team-cli/bin/ai-team $args" }
ai-team --help
ai-team team overview
ai-team candidate add "李四" --position "PM" --source referral
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

## Troubleshooting

### WSL: `npm install` fails with `EISDIR` or `ERR_MODULE_NOT_FOUND @ai-team/core`

**Symptom** (PowerShell on `\\wsl$\Ubuntu\...` path):
```
npm error code EISDIR
npm error syscall symlink
npm error path \\wsl$\Ubuntu\wsl$\Ubuntu\...
```
or
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@ai-team/core'
```

**Root cause**: PowerShell accesses WSL files via the 9P/drvfs mount (`\\wsl$\Ubuntu\...`). This mount is case-insensitive and has broken symlink semantics, so npm workspace symlinks fail.

**Fix**: Always run from **WSL bash**, not PowerShell:

```powershell
# Open a WSL bash session
wsl -e bash

# Or from PowerShell, dispatch into WSL directly:
wsl -e bash -c "cd /home/hermes/projects/ai-team && npm install && npm run build"
```

If you must stay in PowerShell, force a flat `node_modules` (no symlinks):

```powershell
npm install --install-strategy=nested
```

But this is slower and uses more disk. **WSL bash is always preferred.**

### WSL: `NODE_ENV=production` silently skips devDependencies

If `tsc`, `vite` etc. don't appear in `node_modules/.bin/`, check:

```bash
echo $NODE_ENV    # if 'production', npm omits devDeps
```

Fix: `unset NODE_ENV` or `export NODE_ENV=development` before `npm install`.

### Git on Windows filesystem (case-insensitive)

`git status` may show phantom "both modified" entries for files that differ only in case (e.g. `AgentRegistry.ts` vs `agentRegistry.ts`). Run all git operations from WSL bash on the case-sensitive ext4 filesystem, not from PowerShell on `\\wsl$\Ubuntu\...`.
