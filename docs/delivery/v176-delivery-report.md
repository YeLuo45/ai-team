# Delivery Report — ai-team

**Ready**: yes
**Headline**: V176 EvalResultsTable — V175 harness 的 React 包装 (per-case pass/fail + 详情展开)
**Proposal**: P-20260705-014
**Commit**: feat(V176): EvalResultsTable component

## Validation
- `npx vitest run packages/ai-team-web/test/eval-results-table-v176.test.tsx` (NODE_ENV=test) — 9/9 passed
- V164-V175 regression: 161/161 全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches | Notes |
|---|---:|---:|---|
| llm/eval-harness.ts | 96.34% | 79.16% | (V175 unchanged) |
| components/llm/EvalResultsTable.tsx | excluded | — | components/** excluded by config |

## Changed Files
- A packages/ai-team-web/src/components/llm/EvalResultsTable.tsx (246 行)
- A packages/ai-team-web/test/eval-results-table-v176.test.tsx (9 tests)

## Features

**EvalResultsTable (246 行)**
- Header: 标题 + counts chip (`passed/total 通过`) + pass-rate + 总耗时
- Per-runner chip cluster: 全 ✅ emerald / 含 ❌ rose + 具体计数
- Per-fixture 表格行：fixtureId / label / runner / status pill / elapsedMs / 失败原因 summary
- 失败行 rose-tone 高亮 — 一眼找出 regression
- 每行可点击展开 ▸/▾ toggle — 显示完整 check 列表 (name + ✅/❌ + detail)
- agent throw 单独显示 `agent threw: <error>` 而非 check details
- 默认 testId `ert`，所有 DOM 元素带稳定 `data-testid` 供自动化

## ROI
- **直接用户价值**: LLM 升级后能立即在 UI 看 V175 harness 报告
- **可观测**: 全局 + per-runner + per-case 三种 pass-rate 视角
- **可审计**: 每个失败 case 都可展开查看具体 assertion failure reason

## Test Coverage (V176 9/9)
- **Empty (1)**: results=[] 渲染提示
- **Header / Runner chips (3)**: title + counts + runner chip tone
- **Row labels + status (2)**: 失败行 rose pill / fixture+label cells
- **Expand/collapse (3)**: 点击展开 + 二次收起 + errored 分支

## Next Directions
1. **V177 PrivacyGuard Wrapper** — `mode=='remote'` 时禁用敏感 UI (mid ROI, 4h)
2. **V178 EvalFixture JSON Loader** — 从 disk 加载 fixtures (mid ROI, 4h)
3. **V179 EvalRunner Component** — harness React 包装 + 状态机 (mid ROI, 5h)
4. **V180 Audio Diff View** — 录音样本的 waveform 对比 (low ROI, 4h)
