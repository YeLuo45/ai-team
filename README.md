# ai-team

> AI-powered team management: smart interviews, member development, skill tracking, growth trajectories, real-time insights.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://yeluo45.github.io/ai-team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-blue)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-blue)](https://tailwindcss.com/)

A TypeScript monorepo inspired by [pi-mono](https://github.com/YeLuo45/pi-mono)'s clean architecture (pi-ai / pi-agent-core / pi-coding-agent / pi-tui), applied to the **AI team management** domain.

## What's Inside (V1-V19, 19 proposals)

- 🎤 **Smart Interviews** (V1) — AI-driven multi-turn dialogue + auto-evaluation
- 🧑‍💼 **Member Training** (V1) — AI-generated training plans from skills
- 📊 **Skill Graph** (V3) — D3.js force-directed skill/member visualization
- 🎭 **1:1 Conversations** (V4) — AI plays the member, manager has 5-scenario dialogue
- ⭐ **Performance Reviews** (V4) — Auto-generated Review drafts from history
- 📄 **Resume Parsing** (V6) — PDF upload + LLM extract + score
- 🔌 **Plugin System** (V7) — Hookable events, 3 sample plugins
- 📥📤 **Data Import/Export** (V8b) — JSON / CSV / Markdown
- 🔔 **Notifications** (V8c) — In-app notification center
- 🎛️ **Customizable Dashboard** (V8d) — Drag-and-drop widgets
- 🧠 **AI Insights** (V14) — Funnel / Skill Gaps / Growth / Recommendations / Anomalies
- 📡 **Real-time SSE** (V15) — Server-Sent Events for live updates
- 🔍 **Full-text Search** (V16) — `⌘K` command palette across all entities
- 🎯 **Context-aware Resume Scoring** (V19) — Combines resume + team gaps

## Packages (7)

| Package | Description |
|---------|-------------|
| **[@ai-team/core](./packages/ai-team-core)** | Domain types (Candidate/Member/Skill/Interview/Training/Review) + JSON file store + utils |
| **[@ai-team/ai](./packages/ai-team-ai)** | LLM wrapper (OpenAI-compatible + Mock) + interview/training/insights/score prompt templates |
| **[@ai-team/agent](./packages/ai-team-agent)** | 8 agents: Interview / Training / 1:1 / Review / Resume / Insights / Score + search engine |
| **[@ai-team/server](./packages/ai-team-server)** | Express REST API server (port 3000) + 50+ endpoints + SSE + LLM proxy |
| **[@ai-team/tui](./packages/ai-team-tui)** | Ink-based interactive TUI (4 views + forms) |
| **[@ai-team/cli](./packages/ai-team-cli)** | Node CLI: `ai-team candidate add`, `interview start`, `team overview`, `tui` |
| **[@ai-team/web](./packages/ai-team-web)** | React 19 + Vite 6 + Tailwind 4 + D3.js (10 pages, 7 modals, CommandPalette, Toast) |

## Quick Start

### Prerequisites

- Node.js ≥ 20
- npm 10+
- (Optional) `AI_TEAM_LLM_API_KEY` for real LLM (OpenAI-compatible)

### Install

```bash
# IMPORTANT: WSL users see Troubleshooting first
npm install
```

If `tsc`, `vite` etc. don't appear in `node_modules/.bin/`, you may need:

```bash
unset NODE_ENV
NODE_ENV=development npm install --include=dev
```

### Build all 7 packages

```bash
npm run build
```

This builds in order: `core → ai → agent → server → tui → cli → web`.

### Run the four modes

#### 1. Server (Express REST API, port 3000)

```bash
# Production (uses prebuilt dist/)
npm run dev:server

# Development with auto-reload (uses tsx)
cd packages/ai-team-server && npm run dev
```

**Endpoints (50+):** `/api/candidates`, `/api/members`, `/api/interviews`, `/api/trainings`, `/api/reviews`, `/api/skills`, `/api/plugins`, `/api/notifications`, `/api/insights/*`, `/api/search`, `/api/resume/*`, `/api/one-on-one/*`, `/api/export`, `/api/import`, `/api/events/stream` (SSE).

#### 2. CLI (one-shot commands)

```bash
# After build, link the CLI globally (or call via node)
cd packages/ai-team-cli && npm link
ai-team --help

# Or call via node
node packages/ai-team-cli/bin/ai-team --help

# Examples
ai-team candidate add "张三" --position "前端工程师" --source linkedin
ai-team member add "李四" --role "Tech Lead" --team "Platform" --level "P7"
ai-team interview start <candidate-id>
ai-team team overview
ai-team tui  # Launch interactive TUI
```

#### 3. TUI (Ink-based terminal UI)

```bash
ai-team tui
```

Or: `node packages/ai-team-cli/bin/ai-team tui`

Views: Dashboard / Candidates / Members / Interviews. Press `?` for help, `q` to quit.

#### 4. Web (React dashboard)

```bash
cd packages/ai-team-web && npm run dev
# → http://localhost:5173 (proxies /api → :3000)
```

**Pages:** Dashboard / Candidates / Members / Interviews / Skills / Trainings / Reviews / Plugins / Insights / Notifications / Data

**Features:**
- `⌘K` / `Ctrl+K` — open command palette (global search)
- 6 dashboard widgets (draggable, localStorage layout)
- Toast notifications
- AI interview simulator
- Resume upload + parse
- Skill graph (D3.js)

#### 5. Tests

```bash
# Run all 390 tests (100% pass rate)
npm test

# With coverage
npm run test:coverage
```

## Architecture

```
ai-team (root, npm workspaces)
├── packages/ai-team-core       (Domain: types + JSON store)
├── packages/ai-team-ai         (LLM: OpenAI-compat + Mock + prompts)
├── packages/ai-team-agent      (8 agents: Interview/Training/1:1/Review/Resume/Insights/Score + search)
├── packages/ai-team-server     (Express: 50+ REST endpoints + SSE)
├── packages/ai-team-tui        (Ink 4-view interactive terminal)
├── packages/ai-team-cli        (commander.js CLI → tui entry)
└── packages/ai-team-web        (React 19 + Vite 6 + Tailwind 4)
```

**Data flow:** TUI / Web → Express Server (3000) → JSON files (per-entity) → `@ai-team/core`

**LLM flow:** All clients (CLI / TUI / Web) → REST `/api/*` → Server → LLM Client (OpenAI-compat or Mock)

## LLM Provider

Set `AI_TEAM_LLM_API_KEY` (or `OPENAI_API_KEY`) to use a real LLM. Without a key, a deterministic Mock client is used.

```bash
export AI_TEAM_LLM_API_KEY=sk-xxx
export AI_TEAM_LLM_BASE_URL=https://api.openai.com/v1  # optional
export AI_TEAM_LLM_MODEL=gpt-4o-mini  # optional
```

Works with any OpenAI-compatible API: OpenAI / Azure / OpenRouter / Ollama / vLLM / LM Studio.

## Proposal History (19 proposals)

| # | Version | Description |
|---|---------|-------------|
| P-20260618-001 | V1 | Bootstrap (TS monorepo + 5 agents + 5 packages) |
| P-20260618-002 | V2 | TUI mode (Ink) + Web mode + Express server |
| P-20260619-001 | V3 | Skill Graph (D3.js) + Training Plan UI |
| P-20260619-002 | V4+V5 | 1:1 Dialog Simulation + Performance Review |
| P-20260619-003 | V6+V7 | Resume Parsing (PDF/LLM) + Plugin System |
| P-20260619-004 | V8b/c/d | Data Import/Export + Notification Center + Custom Dashboard |
| P-20260619-005 | V9-V13 | Test Infrastructure (vitest) + Coverage improvements |
| P-20260619-006 | V14+V15 | AI Insights + Real-time SSE |
| P-20260619-007 | V16+V19 | Full-text Search (⌘K) + Context-aware Resume Scoring |

## Testing

- **390 tests** (100% pass rate, 7 skipped)
- **vitest** + **@vitest/coverage-v8** + **supertest** + **happy-dom**
- Coverage focus: core (100%), ai (98%), agent (80-95%), server (87%), tui API (90%), web lib (53%), CLI (50-90%)

```bash
npm test              # Run all
npm run test:coverage # With coverage report
```

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

### Server: `node: bad option: --experimental-strip-types`

This flag is only available in Node 22+. If you're on Node 20, use:

```bash
cd packages/ai-team-server
npx tsx watch src/index.ts
```

Or simply build first and run the compiled version:

```bash
npm run build
npm run dev:server
```

### Git on Windows filesystem (case-insensitive)

`git status` may show phantom "both modified" entries for files that differ only in case (e.g. `AgentRegistry.ts` vs `agentRegistry.ts`). Run all git operations from WSL bash on the case-sensitive ext4 filesystem, not from PowerShell on `\\wsl$\Ubuntu\...`.

### Web build: `useState` is declared but never used / `HashRouter` not found

This usually means the React or React Router import was removed by mistake. Make sure `App.tsx` has:

```ts
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
```

If `paletteOpen` is unused, either use it or remove the `useState` declaration.

### CLI: `ai-team: command not found`

After `npm install`, link the CLI globally:

```bash
cd packages/ai-team-cli && npm link
```

Or call via node directly:

```bash
node packages/ai-team-cli/bin/ai-team --help
```

## Documentation

- **English**: this file
- **中文**: [README.zh-CN.md](./README.zh-CN.md)
