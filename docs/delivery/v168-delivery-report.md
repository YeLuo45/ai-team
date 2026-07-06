# Delivery Report — ai-team

**Ready**: yes
**Headline**: V168 KeyboardShortcutHint — 浮动 cheat sheet (j / k / 0)
**Proposal**: P-20260705-006
**Commit**: feat(V168): keyboard cheat sheet hint popover

## Validation
- `npx vitest run packages/ai-team-web/test/keyboard-shortcut-hint-v168.test.tsx` (NODE_ENV=test) — 11/11 passed
- V164 regression: 9/9
- V165 regression: 12/12
- V166 regression: 9/9
- V167 regression: 20/20
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Changed Files
- A packages/ai-team-web/src/components/interview/KeyboardShortcutHint.tsx (142 lines, drop-in popover component)
- M packages/ai-team-web/src/components/interview/index.ts (re-export KeyboardShortcutHint + types)
- M packages/ai-team-web/src/components/interview/RealtimeQuestionSuggester.tsx
  - +showKeyboardHint?: boolean prop (default true)
  - keyboard hint placed in panel header next to TriggerBadge
- A packages/ai-team-web/test/keyboard-shortcut-hint-v168.test.tsx (11 tests)

## Features
- **Hint icon** ⌨️ in panel header — visible by default (`showKeyboardHint=true`)
- **Click toggle** — opens/closes popover (aria-haspopup=dialog, aria-expanded tracking)
- **3 entry shortcuts** wired to V166 listener: `j` next history / `k` prev / `0` live
- **Outside-click** closes the popover (mousedown listener)
- **Escape** key closes the popover (window keydown listener)
- **Empty shortcuts** → component returns null (safe to drop in)
- **Custom icon** and **custom title** props for re-use in other panels

## Test Coverage (V168 test file 11/11)
- **Hint popover (7 tests)**: aria attrs 初始 / toggle 打开 + 列 shortcuts / 二次点击关闭 / 外部点击关闭 / Escape 关闭 / 空 shortcuts no-op / 自定义 icon
- **Suggester 集成 (4 tests)**: 默认显示 / `showKeyboardHint=false` 隐藏 / 点击显示 3 条 / 点击后 j 仍然工作

## ROI
- **可发现性 ↑**: j/k/0 一直藏在 listener 里，新用户没机会发现。⌨️ icon 让 shortcut 在视觉层出现
- **复用**: KeyboardShortcutHint 后续可用于其他面板的快捷键揭示 (SttSettings, ComparisonMatrix, 等)
- **键盘可访问性**: aria-haspopup + aria-expanded + aria-label + role=dialog

## Next Directions
1. V169 History + Cache 双向同步 — adopt 时同时写 cache，避免重复存储
2. V170 Suggestion Diff View — adopted history vs live suggestion 并排对比
3. V171 候选人提问时间线 — QuestionSuggestion 嵌入 candidate timeline
