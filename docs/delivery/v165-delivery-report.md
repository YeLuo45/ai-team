# Delivery Report — ai-team

**Ready**: yes
**Headline**: V165 QuestionSuggestionHistory — 采纳历史面板 + 持久化
**Proposal**: P-20260705-003
**Commit**: feat(V165): QuestionSuggestionHistory + adoption history persistence

## Validation
- `npx vitest run packages/ai-team-web/test/question-suggestion-history-v165.test.tsx` (NODE_ENV=test) — 12/12 passed
- `npm run verify:readme` — 40/40 passed
- `npm test` (增量) — V164 + V165 17/17 passed

## Changed Files
- A packages/ai-team-web/src/components/interview/QuestionSuggestionHistory.tsx (178 行)
- A packages/ai-team-web/src/lib/question-suggestion/history.ts (147 行, 9 helper functions)
- A packages/ai-team-web/test/question-suggestion-history-v165.test.tsx (12 tests)
- M packages/ai-team-web/src/components/interview/CandidateInterviewPanel.tsx (接 onAdopt + historyVersion)
- M packages/ai-team-web/src/components/interview/RealtimeQuestionSuggester.tsx (加 onAdopt callback)
- M packages/ai-team-web/src/components/interview/index.ts (export QuestionSuggestionHistory)
- M packages/ai-team-web/src/lib/question-suggestion/index.ts (re-export history helpers)
- M packages/ai-team-web/public/data/team.json (generatedAt)

## Features
- **history.ts (147 行, pure helpers)**:
  - `STORAGE_KEY = 'ai-team-qs-history'` (localStorage key)
  - `MAX_ENTRIES = 200`
  - `readHistory / writeHistory / appendAdopted / clearHistory / removeAdopted`
  - `buildAdoption` — 从 QuestionSuggestion + session metadata 构造 adoption
  - `exportHistoryJson` — pretty-printed JSON
  - `isAdoptedSuggestion` — type guard (过滤 malformed entries)
- **QuestionSuggestionHistory (178 行)**:
  - Drop-in 面板组件 (Card + list + 操作按钮)
  - `<button>` ⬇ 导出 JSON (Blob + URL.createObjectURL)
  - `<button>` 🗑 清空 (confirm-less, 0 entries 自动 disable)
  - `<button>` × 单条删除
  - 显示: question / rationale / candidate / position / focus tag / difficulty / 时间
  - `key={historyVersion}` 在 CandidateInterviewPanel — adopt 后自动 re-read localStorage
- **CandidateInterviewPanel 集成**:
  - 新增 `onAdopt={(s) => ...}` 回调 — 写入 localStorage + bump `historyVersion`
  - 把 panel 挂到 `RealtimeQuestionSuggester` 旁边
- **导出策略**: JSON 文件名 `question-suggestion-history-YYYY-MM-DD.json`

## Test Coverage (V165 test file 12/12)
- **Pure helpers (8 tests)**: null storage / malformed JSON / MAX_ENTRIES cap / reverse-order prepend / clear/remove / adoption defaults / JSON shape
- **Panel (4 tests)**: empty state / renders newest-first / clear button / per-entry remove / export Blob

## Next Directions
1. V166 RealtimeQuestionSuggester 加 keyboard shortcut (j/k 切换历史建议)
2. V167 跨面试 session 的 suggestion cache (按 candidateId 索引历史)
3. V168 Adoption 引入"评分维度加权" — 不同 focus tag 权值
