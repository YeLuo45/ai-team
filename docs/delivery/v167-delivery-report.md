# Delivery Report — ai-team

**Ready**: yes
**Headline**: V167 SuggestionCache — 跨候选人 + 跨职位的 LLM 结果复用
**Proposal**: P-20260705-005
**Commit**: feat(V167): cross-session suggestion cache

## Validation
- `npx vitest run packages/ai-team-web/test/question-suggestion-cache-v167.test.tsx` (NODE_ENV=test) — 20/20 passed
- V164 regression: 9/9
- V165 regression: 12/12
- V166 regression: 9/9
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Changed Files
- A packages/ai-team-web/src/lib/question-suggestion/cache.ts (130 lines, 14 helpers)
- M packages/ai-team-web/src/lib/question-suggestion/index.ts (re-exports + types)
- M packages/ai-team-web/src/components/interview/RealtimeQuestionSuggester.tsx
  - +initialSuggestion prop + onSuggestionGenerated callback
  - 初始 trigger 在 initialSuggestion 提供时跳过
- M packages/ai-team-web/src/components/interview/CandidateInterviewPanel.tsx
  - +cachedSuggestion state，mount 时 recallCandidate
  - 每次 agent 生成新 suggestion → writeCache + setCachedSuggestion
- A packages/ai-team-web/test/question-suggestion-cache-v167.test.tsx (20 tests, 14 helpers + 4 component + 2 wiring)

## Features
**cache.ts pure helpers (130 行)**
- `readCache / writeCache` — JSON 化 + 错误恢复 (malformed JSON 自动 fallback)
- `rememberCandidate / rememberPosition / remember(...)` — prepend + cap (PER_KEY_CAP=10 / POSITION_KEY_CAP=30)
- `recallCandidate / recallPosition` — 取最新或 null
- `forgetCandidate` — 删除单候选人缓存
- `countCached` — 总数 (UI compact 显示用)
- `exportCacheJson` — pretty-print
- `EMPTY_CACHE` — frozen 共享默认

**RealtimeQuestionSuggester 集成**
- `initialSuggestion?: QuestionSuggestion | null` — 进入组件时立即显示
- `onSuggestionGenerated?(s)` — 每次 trigger 完成后回调
- `initialSuggestion` 提供时**跳过** mount-time trigger (cache wins)

**CandidateInterviewPanel 集成**
- mount 时 `recallCandidate(cache, candidateId)` → `cachedSuggestion` state
- `onSuggestionGenerated` → `remember + writeCache + setCachedSuggestion`
- 切候选人时自动 recall (通过 React 重 mount)

## ROI
- **时间省**: 切候选人时立即显示缓存 suggestion，跳过 LLM 几秒延迟
- **一致性**: 同一 position (e.g. "Senior Frontend") 不同候选人可以共享 base 题目
- **可观测**: countCached 显示总缓存量 / export JSON 用于调试
- **容错**: malformed JSON + missing fields 自动过滤

## Test Coverage (V167 test file 20/20)
- **Pure helpers (15 tests)**: 空 storage / roundtrip / malformed JSON / invalid entries / cap / remember / recall / forget / countCached / exportCacheJson / EMPTY_CACHE
- **Component integration (4 tests)**: initialSuggestion 立即显示 / onSuggestionGenerated fires / initialSuggestion 跳过 trigger 保留缓存 / regenerate 触发第二次 callback
- **Wiring (1 placeholder)**: 集成在 CandidateInterviewPanel

## Next Directions
1. V168 keyboard hint 提示 (浮动 cheat sheet)
2. V169 cache migration (versioned migrate from older keys)
3. V170 history + cache 双向同步 — adopt 时同时 cache
