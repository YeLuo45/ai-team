# Delivery Report — ai-team

**Ready**: yes
**Headline**: V177 PrivacyGuard Wrapper — 隐私敏感 UI 操作 gate (与 V174 配对)
**Proposal**: P-20260705-015
**Commit**: feat(V177): PrivacyGuard wrapper for sensitive UI ops

## Validation
- `npx vitest run packages/ai-team-web/test/privacy-guard-v177.test.tsx` (NODE_ENV=test) — 12/12 passed
- V164-V176 regression: 173/173 全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches |
|---|---:|---:|
| lib/privacy/guard.ts | **100%** | **100%** |

## Changed Files
- A packages/ai-team-web/src/lib/privacy/guard.ts (110 行, 4 helpers + 4 constants)
- A packages/ai-team-web/src/components/privacy/PrivacyGate.tsx (140 行)
- A packages/ai-team-web/test/privacy-guard-v177.test.tsx (12 tests)

## Features

**Pure helpers (5 functions)**
- `evaluateGuard(status, op)` — 返回 OK / WARN_PARTIAL / BLOCK_REMOTE_OP
- `isOperationBlocked(status, op)` — boolean 便捷
- `guardTone(status, op)` — tone 便捷
- `usePrivacyDecision(status, op)` — React hook 包装

**4 隐私敏感操作类型**
- `export-audio` — 上传/保存录音
- `export-interview` — 导出候选人笔记
- `clipboard-copy` — 复制敏感文本到剪贴板
- `cloud-summary` — 让 transcript 走云端

**PrivacyGate (140 行)**
- `full-local` 时：`<PrivacyGate>` 渲染 children，无 chip 无 banner
- `partial-local` 时：上面渲染警告 chip + children，下方一行 detail 提示
- `remote` 时：完全替换为 rose-tone alert banner (role="alert" + aria-live="assertive")，hidden children，渲染 `fallback` prop

**决策矩阵**
| mode | op='export-audio' | op='cloud-summary' | ... |
|---|---|---|---|
| full-local | ✅ allow | ✅ allow | ... |
| partial-local | ⚠️ warn | ⚠️ warn | ... |
| remote | 🔒 block | 🔒 block | ... |

## ROI
- **完整策略**: V174 显示整体 privacy mode，V177 给 UI 元素决策权 — 每个敏感按钮都有显式 guard
- **可审计**: 数据壁垒 (data-blocked / data-mode / data-op) 测试可读
- **a11y**: blocked 状态用 `role="alert"` + `aria-live="assertive"` 强制朗读

## Test Coverage (V177 12/12)
- **evaluateGuard (5)**: full-local OK / partial-local WARN / remote block / BLOCK_REMOTE_OP 选择 / 决策幂等
- **isOperationBlocked / guardTone (1)**: 与 evaluateGuard 一致
- **PrivacyGate (6)**: full-local 无装饰 / partial-local chip / remote block + fallback / 无 fallback / cloud-summary block / usePrivacyDecision hook

## Next Directions
1. **V178 EvalFixture JSON Loader** — 从 disk 读 fixtures (mid ROI, 4h)
2. **V179 EvalRunner Component** — live eval 按钮 (mid ROI, 5h)
3. **V180 WebAssembly Whisper** — 浏览器侧 model 加载 (high ROI, 12h)
4. **V181 PrivacyGate per-action customization** — 允许每个 op 自定义 fallback 文案 (low ROI, 2h)
