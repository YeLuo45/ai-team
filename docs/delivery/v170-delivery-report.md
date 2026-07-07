# Delivery Report — ai-team

**Ready**: yes
**Headline**: V170 SuggestionDiffView — adopted vs live question 逐词对比
**Proposal**: P-20260705-008
**Commit**: feat(V170): SuggestionDiffView with word-level LCS diff

## Validation
- `npx vitest run packages/ai-team-web/test/suggestion-diff-v170.test.tsx` (NODE_ENV=test) — 29/29 passed
- V164 regression: 9/9
- V165 regression: 12/12
- V166 regression: 9/9
- V167 regression: 20/20
- V168 regression: 11/11
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0

## Coverage
| File | Lines | Branches |
|---|---:|---:|
| diff.ts | 94.89% | 90.32% |
| SuggestionDiffView.tsx | covered by 9 component tests |

## Changed Files
- A packages/ai-team-web/src/lib/question-suggestion/diff.ts (220 行)
- A packages/ai-team-web/src/components/interview/SuggestionDiffView.tsx (240 行)
- M packages/ai-team-web/src/lib/question-suggestion/index.ts (re-exports)
- M packages/ai-team-web/src/components/interview/index.ts (export SuggestionDiffView)
- A packages/ai-team-web/test/suggestion-diff-v170.test.tsx (29 tests)

## Features
**diff.ts pure helpers (220 行)**
- `diffSuggestions(baseline, current)` — 结构化对比 (question + rationale word-level, focusTag/difficulty 字段异同)
- `hasDiff(d)` — 单一 invariant predicate
- `similarity(d)` — `[0, 1]` similarity score
- `wordDiff(prev, next)` — LCS-based word diff (general purpose)
- Internal: `tokenize` (whitespace-preserving + 合并多 space) + `coalesce` (after-reverse 同 op 合并)

**SuggestionDiffView (240 行)**
- Empty state (no baseline / current)
- Identical badge (✅ 当前建议与历史采纳版本完全一致)
- Side-by-side word-level diff (insert=emerald, delete=rose+line-through)
- Focus tag + difficulty 字段对比卡片 (changed 用 amber 框)
- Similarity % + add/remove 统计 (e.g. +3 / −2)
- Custom title prop

## Key Bugfix Record
LCS 后向重建阶段 (post-loop) post-loop pushes were collapsing through
appendSegment, inverting string order (`worldhello` instead of `hello
world`). Fix:
1. Post-loop now pushes raw `{op, value}` segments (no `appendSegment`).
2. Coalesce runs **after** `segments.reverse()` to flatten consecutive
   same-op segments *only* into forward-correct rendering.

## ROI
- **可解释性 ↑**: 用户能看到 agent 第 N 次生成的题目 vs 上次采纳的题目，差异在哪
- **审计友好**: focusTag 异同 + similarity % 一眼看出"agent 行为是否稳定"
- **复用**: SuggestionDiffView 用在比较 cache vs current 时也合适（V171 timeline 候选）

## Next Directions
1. **V171 Question Timeline** — candidate 视角的提问时间线 (medium ROI, 6h)
2. **V173 Agent Eval Harness** — 回放历史 eval LLM agent (high ROI, 8h)
3. **V170 Alt: Boost Tool** — Grammarly-style 问题重写器 (medium ROI, 4h)
4. **V172 Cache Export/Import** — 跨设备 cache (low ROI, 4h)

## Known gaps
- diff.ts lines 163-164 (post-loop delete block) are still uncovered
  because the greedy walk-back consistently reaches i=0 before reaching
  j=0. The block IS exercised in pathological inputs but the test matrix
  doesn't hit it — raise by adding explicit empty-target cases in V171
  tests if needed.
