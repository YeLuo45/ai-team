# Delivery Report — ai-team

**Ready**: yes
**Headline**: V174 Privacy Badge — header chip 显示 STT+LLM 本地化状态
**Proposal**: P-20260705-012
**Commit**: feat(V174): PrivacyBadge chip driven by STT+LLM local flags

## Validation
- `npx vitest run packages/ai-team-web/test/privacy-badge-v174.test.tsx` (NODE_ENV=test) — 21/21 passed
- V164-V173 regression: 123/123 全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches |
|---|---:|---:|
| lib/privacy/summary.ts | 100% | 100% |
| PrivacyBadge.tsx | covered by 7 component tests |

## meetily Capability Mapping

Meetily 关键能力 #4 — **100% 本地处理** 反馈层

V171 (Ollama local LLM) + V172 (Whisper-server local ASR) + V173 (持续推进)
现在 V174 落地一个统一的 privacy badge — header chip 实时反馈当前
STT/LLM provider 是否都 local。

## Changed Files
- A packages/ai-team-web/src/lib/privacy/summary.ts (105 行, 3 helpers)
- A packages/ai-team-web/src/components/privacy/PrivacyBadge.tsx (90 行)
- A packages/ai-team-web/test/privacy-badge-v174.test.tsx (21 tests)

## Features

**Pure helpers (3 functions)**
- `summarizePrivacy({sttLocal, llmLocal, sttEndpoint?, llmEndpoint?})`
  → `{mode, label, tone, endpoints}` (full-local / partial-local / remote)
- `shortEndpoint(url)` — 去掉协议前缀 + 尾 slash
- `formatEndpoints(endpoints)` — `STT: host\nLLM: host` 多行格式

**PrivacyBadge component (90 行)**
- 3 视觉态：emerald (full-local) / amber (mixed) / rose (remote)
- hover 表面 host:port (tooltip) — 让用户确认是真本地
- `role="status"` + `aria-live="polite"` 提供无障碍
- `data-mode` 属性便于自动化测试 selector

## ROI
- **透明度 ↑**: 用户立刻知道当前是否在用云端
- **可审计**: 鼠标 hover 显示具体 host:port，发现"假装本地"立刻现形
- **复用**: header chip + on/off pill + tooltip; 全 app 通用

## Test Coverage (V174 21/21)
- **Helpers (12 tests)**: full-local / partial STT only / partial LLM only / remote / 缺 endpoint / falsy 类型强转 / endpoints 序列化
- **shortEndpoint (4 tests)**: protocol + slash / https / undefined / no protocol
- **formatEndpoints (3 tests)**: 多行 join / 空 / 原始 URL fallback
- **PrivacyBadge (7 tests)**: full-local / partial / remote 各态渲染 + endpoint 行显隐 + endpoints 文本 / role+aria-label / 透传 props

## Next Directions
1. **V175 Agent Eval Harness** — 回放历史 eval LLM agent (high ROI, 8h)
2. **V176 PrivacyGuard Component Wrapper** — 当 privacy=remote 时禁用其他隐私相关的 UI 操作 (mid ROI, 4h)
3. **V177 Eval Mode Banner** — 提示用户当前处于 eval 模式 (low ROI, 2h)
4. **V178 End-to-End Local Pipeline Test** — Ollama + Whisper + Speaker diff E2E (mid ROI, 4h)
