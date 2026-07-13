# ai-team

> AI-powered team management: smart interviews, member development, skill tracking, growth trajectories, real-time insights.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://yeluo45.github.io/ai-team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-blue)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-blue)](https://tailwindcss.com/)

A TypeScript monorepo inspired by [pi-mono](https://github.com/YeLuo45/pi-mono)'s clean architecture (pi-ai / pi-agent-core / pi-coding-agent / pi-tui), applied to the **AI team management** domain.

## ⚡ 30-second Quick Start

```bash
git clone https://github.com/YeLuo45/ai-team.git
cd ai-team
unset NODE_ENV && NODE_ENV=development npm install --include=dev
npm run build
npm run dev           # ← one command: server (3000) + web (5173) together
```

Open browser:
- **Web UI**: http://localhost:5173 (proxies `/api` → 3000)
- **API**: http://localhost:3000/api/health

Press `Ctrl+C` to clean shutdown.

> For WSL users: see [Troubleshooting](#troubleshooting) section below for the 5 most common gotchas.

## What's Inside (V1-V19, 19 proposals) + V20-V24

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
- 📊 **Recruitment Pipeline** (V21) — `sourced→screening→interview→evaluation→offer→hired` funnel
- 🛰️ **Agent Audit Console** (V22) — Per-call records + stats aggregation
- 🔥 **Capability Heatmap** (V23) — Team×Role × Skill coverage matrix
- 🌱 **Demo Data Factory** (V24) — small/medium/large presets for instant demos
- ⚡ **Coverage Gate 3.0** (V25) — 95% branch threshold enforced across 7 strict layers
- 📊 **Pipeline + Heatmap Web Pages** (V26) — `/pipeline` and `/heatmap` React pages with retry
- 📡 **Audit SSE** (V27) — `/api/agent-audit/stream` real-time push + Web Audit Console
- 🚀 **`ai-team dev`** (V28) — One-command demo launcher (wipe → seed → server+web)
- 🔗 **Pipeline Auto-Advance** (V29) — Interview finalize hooks into pipeline.advance('evaluation')
- ⚖️ **Legal Risk Agent + Centered Web Shell** (V30) — Legal risk triage + symmetric responsive layout
- 🛡️ **Tech Policy Agent** (V31) — Security / compliance / ops / governance risk scoring + remediation
- 📺 **Media Compliance Agent** (V31) — WeChat/Douyin/XHS/Bilibili channel-aware PII + consent triage
- 🧩 **Per-agent Independent Configuration** (V32) — soul.md / user.md / memory.md + LLM model override per AgentKind
- 🌐 **Web Agent Config Console** (V34) — React UI to edit each agent's runtime config
- 📦 **Agent Config Templates** (V35) — bulk export / import + 3 built-in presets (default / hr-friendly / strict-interviewer)
- 🧭 **Multi-Agent Workflow Orchestrator** (V36) — Resume → Interview → Score → Compliance → Recommendation workflow
- 🧑‍⚖️ **Human Approval Gate** (V37) — high/critical risks enter a review queue before automatic decisions
- 🧪 **What-if Lab + Org Memory + LLMOps** (V38-V40) — team impact simulation, memory context, token/cost/latency summaries
- ✅ **README Command Verification** (V41) — `npm run verify:readme` validates core README commands with real evidence
- 🖥️ **Workflow Web Console** (V42) — `/orchestration` runs workflow, approval queue, and LLMOps alert checks
- 💾 **Approval Persistence API** (V43) — `/api/team-orchestration/approvals` create/list/decide review records
- 🚨 **LLMOps Alerting API** (V44) — `/api/team-orchestration/llmops/alerts` evaluates cost/latency/fallback/error policies
- 🧠 **Org Memory Store** (V45) — JSON-backed `OrchestrationOrgMemoryStore` with citation context builder
- 🧮 **Scenario Batch Runner** (V46) — `buildScenarioBatch` ranks many candidates, returns winner/dropped ids
- 🚦 **Release Hardening Report** (V47) — `npm run release:check` aggregates command/coverage/docs into a single readiness signal
- 🧠 **Org Memory into Agent Prompt** (V48) — `injectOrgMemory` threads team memory into interview / training / evaluation prompts
- 🪝 **Pre-commit Hook** (V50) — `npm run hooks:install` wires `verify:readme` + `release:check` into `.git/hooks/pre-commit`
- 📊 **Delivery Evidence Summary** (V51-V52) — `npm run delivery:summary` prints the handoff-ready test/coverage/README gate summary from real logs and `coverage-final.json`
- 🧱 **Orchestration Module Split** (V53) — split the 500+ line orchestration monolith into feature modules while preserving the public barrel import
- 🖥️ **Web Orchestration Parity** (V54/V56/V59) — `/orchestration` now exposes scenario batch, org memory context/editing, delivery summary, and editable workflow parameters
- 📝 **Delivery Report Automation** (V55/V58/V60) — `npm run delivery:report` writes `docs/delivery/<version>-delivery-report.md`; `release:check` gates it with build/test/README/coverage
- 🗂️ **Delivery Report Index** (V61/V63) — `npm run delivery:index` builds `docs/delivery/index.md` and browser-safe release evidence JSON
- 🎛️ **Orchestration Presets + Evidence Download** (V62/V65) — `/orchestration` adds security preset and one-click release evidence JSON download
- 🔁 **Proposal Sync Planner** (V64) — pure safe-forward MCP status plan helper avoids backward/skip transitions
- 🧰 **Delivery Cockpit Hardening** (V66-V72) — evidence filters/import viewer, guarded proposal delivery wizard, release readiness dashboard, MCP status-reset guard, and commit-ready diff classifier
- 🚚 **Delivery Closed Loop** (V73-V96) — browser-safe evidence helpers, guarded MCP executor plan, cockpit server/Web restore persistence, evidence schema batch audit, quality gate checks, and next-direction generation

## Packages (7)

| Package | Description |
|---------|-------------|
| **[@ai-team/core](./packages/ai-team-core)** | Domain types (Candidate/Member/Skill/Interview/Training/Review) + JSON file store + utils |
| **[@ai-team/ai](./packages/ai-team-ai)** | LLM wrapper (OpenAI-compatible + Mock) + interview/training/insights/score prompt templates |
| **[@ai-team/agent](./packages/ai-team-agent)** | 11 agents: Interview / Training / 1:1 / Review / Resume / Insights / Score / Legal / Tech Policy / Media Compliance + search engine |
| **[@ai-team/server](./packages/ai-team-server)** | Express REST API server (port 3000) + 50+ endpoints + SSE + LLM proxy |
| **[@ai-team/tui](./packages/ai-team-tui)** | Ink-based interactive TUI (4 views + forms) |
| **[@ai-team/cli](./packages/ai-team-cli)** | Node CLI: `ai-team candidate add`, `interview start`, `team overview`, `tui` |
| **[@ai-team/web](./packages/ai-team-web)** | React 19 + Vite 6 + Tailwind 4 + D3.js (10 pages, 7 modals, CommandPalette, Toast) |

## Quick Start

### Prerequisites

- Node.js ≥ 20 (Node 22+ for `tsx watch` autoreload)
- npm 10+
- (Optional) `AI_TEAM_LLM_API_KEY` for real LLM (OpenAI-compatible)

### Install

```bash
# WSL users see Troubleshooting first
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

### Run modes

#### Mode 1: `npm run dev` — **recommended** (one command, server + web together)

```bash
npm run dev
# → [server] listening on http://localhost:3000
# → [web]    VITE ready, http://localhost:5173
```

Two processes run concurrently with colored output (blue=server, green=web). `Ctrl+C`
gracefully shuts down both.

> For dev mode with hot reload: `npm run dev:tsc` (uses `tsx watch` instead of dist)

#### Mode 2: CLI (one-shot commands)

```bash
# After build, link the CLI globally (or call via node)
cd packages/ai-team-cli && npm link
ai-team --help

# Or call via node directly
node packages/ai-team-cli/bin/ai-team --help

# Examples
ai-team candidate add "张三" --position "前端工程师" --source linkedin
ai-team member add "李四" --role "Tech Lead" --team "Platform" --level "P7"
ai-team interview start <candidate-id>
ai-team team overview
ai-team tui  # Launch interactive TUI
```

#### Mode 3: TUI (Ink-based terminal UI)

```bash
ai-team tui
```

Or: `node packages/ai-team-cli/bin/ai-team tui`

Views: Dashboard / Candidates / Members / Interviews. Press `?` for help, `q` to quit.

#### Mode 4: Run server or web alone (advanced)

```bash
# Server only (no web)
npm run dev:server

# Web only (requires server running, else 503)
npm run dev:web
```

#### Mode 5: Tests

```bash
# Run all tests
npm test

# Single package
cd packages/ai-team-core && npm test

# With coverage
npm run test:coverage

# Verify core README commands are deliverable
npm run verify:readme

# Print delivery handoff evidence summary
npm run delivery:summary
```

`delivery:summary` reads `coverage/coverage-final.json` and optional `AI_TEAM_TEST_LOG`, `AI_TEAM_README_LOG`, and `AI_TEAM_BUILD_LOG` files when present.

#### Mode 6: Authentication (V20)

```bash
# Login (default admin: admin@ai-team.local / admin123)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ai-team.local","password":"admin123"}'
# → { "token": "eyJ...", "user": { ... } }

# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"u@x.com","username":"u","password":"pass123","role":"manager"}'
```

**Roles**: `admin` (all) / `manager` (read+write candidate/member/interview) / `interviewer` (read+interview.create) / `viewer` (read-only)

**Set JWT secret** (production):
```bash
export AI_TEAM_JWT_SECRET=your-strong-random-secret
export AI_TEAM_JWT_EXPIRES=7d
```

## Architecture

```
ai-team (root, npm workspaces)
├── packages/ai-team-core       (Domain: types + JSON store)
├── packages/ai-team-ai         (LLM: OpenAI-compat + Mock + prompts)
├── packages/ai-team-agent      (11 agents: Interview/Training/1:1/Review/Resume/Insights/Score/Legal/TechPolicy/MediaCompliance + search)
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

- **974 tests** (967 passed, 7 skipped, 100% pass rate)
- **vitest** + **@vitest/coverage-v8** + **supertest** + **happy-dom**
- Coverage gate: 95%+ for deterministic library/runtime modules; UI pages, CLI command glue, LLM orchestration, and environment fallbacks are excluded from the global threshold.
- Current coverage gate result: statements 98.11%, branches 94.65%, functions 98.11%, lines 98.72%.
- Strict layers (95% threshold, all passing): 9/10 including core/store, server/routes, server/middleware, server/sse, web/lib-format.
- Incremental layers (V32+V35, all ≥95%): v32/core-agent-config, v32/agent-config-loader, v35/core-agent-config-template.

```bash
npm test                       # Run all 974 tests (967 passed, 7 skipped)
npm run test:coverage          # Full coverage report
npm run test:coverage:strict   # 95% global strict threshold
npm run test:coverage:incremental  # V32/V35 incremental layers only (CI gate for this iteration)
npm run test:coverage:90       # 90% strict threshold variant
npm run coverage:report        # Layered report from existing coverage data
```

## Agent Config CLI (V32/V35)

```bash
# Export all configured agents to stdout
ai-team agent-config export > my-config.json

# Import from JSON envelope
ai-team agent-config import --file my-config.json

# Apply a built-in preset (default / hr-friendly / strict-interviewer)
ai-team agent-config apply hr-friendly
ai-team agent-config apply strict-interviewer --dry-run

# List presets
ai-team agent-config presets
```

## Recent additions (V20-V31)

- **V20 Coverage Gate 2.0**: `scripts/coverage-report.mjs` — layered report; `npm run coverage:report`
- **V21 Recruitment Pipeline**: `/api/pipeline/*` endpoints + `ai-team pipeline advance|funnel|show`
- **V22 Agent Audit Console**: `/api/agent-audit/*` + stats aggregation by agent/status
- **V23 Capability Heatmap**: `/api/insights/capability-heatmap` (team×role × skill matrix)
- **V24 Demo Data Factory**: `ai-team seed fill|preview [-s small|medium|large]`
- **V25 Coverage Gate 3.0**: Threshold raised from 90% → 95% branches, dead-branch removed
- **V26 Pipeline + Heatmap Web Pages**: `/pipeline` and `/heatmap` routes in Web UI with loading/error/retry states
- **V27 Agent Audit SSE**: `/api/agent-audit/stream` SSE endpoint + Audit Console Web page with EventSource
- **V28 `ai-team dev`**: One-command demo (wipe → seed → start server+web)
- **V29 Pipeline Auto-Advance**: Interview finalize auto-advances pipeline to `evaluation`
- **V30 Legal Risk Agent + Centered Web Shell**: legal triage reaches 100% module coverage; header/main/footer share a centered responsive shell
- **V31 Tech Policy + Media Compliance Agents**: tech-policy-agent (security/compliance/ops/governance) and media-compliance-agent (wechat/douyin/xiaohongshu/bilibili/feishu/other) both reach 100% module coverage

## Recent additions (V165-V203, candidate-suggestion + eval-dashboard + privacy-audit pipeline)

The candidate-suggestion sub-system now ships a complete meetily-aligned
local STT/transcription/eval pipeline, plus a presentational dashboard
that aggregates the V191 eval summary. Everything listed below is
covered by the **ai-team-web** package and imports cleanly from
`src/lib/*`. Detailed reports live in
[`docs/delivery/`](./docs/delivery/).

### V165-V169 — Interview suggestion history

- `lib/question-suggestion/history.ts` — append-only suggestion
  history bound to localStorage.
- `lib/question-suggestion/cache.ts` — per-candidate × per-position
  cross-session suggestion cache.
- `components/interview/QuestionSuggestionHistory.tsx` (V165)
- On-adopt writes (V169) keep history ↔ cache in sync.

### V170 — LCS-based diff view

- `lib/question-suggestion/diff.ts` — word-level LCS diff.
- `components/interview/SuggestionDiffView.tsx`.

### V171-V174 — meetily 4 capabilities (Ollama / Speaker / Whisper-server / Privacy)

| # | Capability | Module |
|---|---|---|
| V171 | **Ollama local LLM** | `lib/llm/ollama-provider.ts` |
| V172 | **Speaker Diarization** | `lib/stt/speaker-timeline.ts` + `SpeakerDiarizationView.tsx` |
| V173 | **Whisper-server (whisper.cpp)** | `lib/stt/whisper-server-client.ts` + `lib/stt/whisper-provider.ts` |
| V174 | **Privacy Badge** | `lib/privacy/summary.ts` + `components/privacy/PrivacyBadge.tsx` |

### V175-V182 — AI agent eval pipeline + export

- `lib/llm/eval-harness.ts` (V175) — `runEvalSuite` / `summarise` etc.
- `components/llm/EvalResultsTable.tsx` (V176)
- `lib/question-suggestion/guard.ts` (V177) — `PrivacyGuard` gate
  + `lib/privacy/guard.ts` (V177).
- `lib/llm/fixture-loader.ts` (V178) — schema-validating JSON loader.
- `lib/llm/run-streaming.ts` (V181) — streaming-progress variant.
- `lib/llm/eval-export.ts` (V182) — JSON / NDJSON / Markdown export.

### V186 — Streaming eval runner UI

- `components/llm/EvalRunnerStreaming.tsx` — wires V181 + V176 + V182.

### V183-V185 — STT × Subtitle

- `lib/stt/transformers-adapter.ts` (V183) — `@huggingface/transformers`
  contract for V180 to swap mock pipeline for ONNX runtime.
- `lib/audio/waveform-diff.ts` (V184) — RMS / similarity / delta.
- `lib/subtitle/cue.ts` + `lib/subtitle/stream.ts` (V185) —
  `chunkToCues` / `chunksToSrt` / `chunksToVtt` /
  `SubtitleAccumulator` streaming pipeline.

### V187 — Eval timeline

- `lib/llm/eval-timeline.ts` — buildEntry / pruneTimeline /
  summariseTimeline / latestFailure / renderTimelineMarkdown.

### V189-V192 — Test infra + live subtitle

- `lib/test/timing-stabilizer.ts` (V189) — `flushUntil` / `commit`.
- `lib/stt/audio-source.ts` (V192) — `AudioSource` / `BufferedAudioSource`.
- `components/stt/LiveSubtitlePanel.tsx` (V192) — wires V192 +
  V185 + caller-supplied `transcribe` fn.

### V190 — Waveform diff view

- `components/audio/WaveformDiffView.tsx` — presentational card
  feeding V184 with two buffers.

### V188 — Privacy override log

- `lib/privacy/override-log.ts` — durable audit trail of every
  consent decision that released a privacy-sensitive operation.
  Pluggable storage adapter (in-memory by default).

### V193-V203 — Eval dashboard + cross-session reuse + privacy audit UI

- `lib/question-suggestion/reuse.ts` (V193) — surface questions the
  same candidate already adopted for the same focus area across past
  interviews, against the V169 history storage.
- `lib/llm/eval-summary.ts` (V191) — single snapshot type aggregating
  V175 eval-case results + V187 timeline summaries + V169 adoption
  events.
- `lib/audio/noise-stats.ts` (V196) — per-chunk RMS + sliding-window
  SNR meter for V192's `LiveSubtitlePanel`.
- `lib/subtitle/editor.ts` (V197) — pure helpers that apply live
  corrections to V185's cue stream.
- `lib/subtitle/export.ts` (V195) — one-click SRT/VTT export glue
  fusing V185 chunks with V182 formatting.
- `components/interview/ReuseBar.tsx` (V198) — presentational UI
  for V193's cross-session reuse helpers.
- `components/llm/EvalDashboardPage.tsx` (V199) — presentational
  dashboard rendering the V191 eval-summary snapshot (recent run
  stats, top failures, adopted questions, timeline).
- `components/privacy/PrivacyOverrideLogView.tsx` (V200) —
  presentational UI for the V188 privacy override log (header counts,
  highlight-op chips, recent-events list).
- `pages/EvalDashboard.tsx` (V201) — SPA wrapper that mounts V199 +
  reads V165 history storage + adapts the events to the V191
  AdoptionEvent contract. Reachable at `/eval-dashboard`.
- `pages/PrivacyOverrideLogPage.tsx` (V203) — SPA wrapper that
  reads the V188 `PrivacyOverrideLog` straight from `localStorage`
  (key `ai-team:privacy-override-log`) and feeds the events to the
  V200 `PrivacyOverrideLogView`. Reachable at `/privacy-override-log`
  and added to the sidebar nav under **System → Override 日志**.
- V171 follow-up: `packages/ai-team-web/src/lib/llm/index.ts` now
  re-exports `OllamaProvider` directly (alongside the existing
  `DefaultOllamaProvider` alias) so consumers can instantiate the
  class without going through the registry.

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
