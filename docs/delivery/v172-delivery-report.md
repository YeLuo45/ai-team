# Delivery Report — ai-team

**Ready**: yes
**Headline**: V172 Speaker Diarization — 扬声器日记 (timeline + 颜色编码)
**Proposal**: P-20260705-010
**Commit**: feat(V172): Speaker diarization timeline + view

## Validation
- `npx vitest run packages/ai-team-web/test/speaker-diarization-v172.test.tsx` — 20/20 passed
- V164-V170 regression: 70/70
- V171 regression: 17/17
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0

## meetily Capability Mapping

Meetily 关键能力 #2 — 扬声器日记 (Speaker Diarization)
直接映射到此 V172: 把 `SttTranscriptChunk[]` 聚合成 timeline，按 `speaker`
字段 (`candidate` / `interviewer` / `unknown`) 颜色编码显示。

## Changed Files
- A packages/ai-team-web/src/lib/stt/speaker-timeline.ts (150 行, 5 纯函数)
- A packages/ai-team-web/src/components/interview/SpeakerDiarizationView.tsx (200 行)
- M packages/ai-team-web/src/components/interview/index.ts (export)
- A packages/ai-team-web/test/speaker-diarization-v172.test.tsx (20 tests)

## Features

**Pure helpers (5 functions)**
- `buildSpeakerTimeline(chunks)` — 把 flat chunks 聚合为 turns（合并同 speaker ≤ 1s 间隙的 chunks，按 startMs 排序）
- `countSpeakers(turns)` — 返回 per-speaker 统计 (turns / chunks / chars / totalMs)，stable order
- `dominantSpeaker(turns)` — 返回 talk time 最长的 speaker
- `totalSpanMs(turns)` — max endMs − min startMs
- `formatMmSs(ms)` — `MM:SS` 格式化

**SpeakerDiarizationView (200 行)**
- Header: 标题 + turns count + 总时长 + dominant speaker 徽章
- Proportion bar: 横向 RGB 条，per-speaker width ∝ totalMs
- Legend chips: per-speaker 全统计 (类目 / 段数 / chunk 数 / 时长)
- 滚动 turn list: speaker 徽章 + `MM:SS–MM:SS` + 文本 (clamp 到 `limit` 默认 50)

## ROI
- **可读性 ↑**: 多说话人声学会议 / 面试直接以可读 timeline 展示
- **审计**: 谁说了什么 / 谁说得多 / 何时 — 一眼看清
- **复用**: RealtimeQuestionSuggester 可以基于 speaker timing 提示更精准的 follow-up

## Test Coverage (V172 20/20)
- **Helpers (10 tests)**: empty / trim / unknown / merge / split by speaker / split by gap / chronological / infer / count / dominant / span / format
- **Component (6 tests)**: empty / summary / per-bar proportional / dominant badge / turn rows / limit
- **Edge cases (4 tests)**: chop empty / drop whitespace / negative ms / NaN

## Next Directions
1. **V173 Agent Eval Harness** — 回放历史 eval LLM agent (high ROI, 8h)
2. **V174 Privacy Badge** — 全链路 local 模式 UI 徽章 (low ROI, 2h)
3. **V175 LlamaCpp Provider** — 直接 llama.cpp 调用 (mid ROI, 6h)
4. **V176 Transcript → Suggestion Picker** — 基于 speaker turn 触发特定类型问题 (mid ROI, 5h)
