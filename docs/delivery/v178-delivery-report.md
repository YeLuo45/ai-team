# Delivery Report — ai-team

**Ready**: yes
**Headline**: V178 EvalFixture JSON Loader — fixtures 文件加载 + schema 校验
**Proposal**: P-20260705-016
**Commit**: feat(V178): EvalFixture JSON loader

## Validation
- `npx vitest run packages/ai-team-web/test/fixture-loader-v178.test.ts` (NODE_ENV=test) — 31/31 passed
- V164-V177 regression: 204/204 全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches | Funcs |
|---|---:|---:|---:|
| llm/fixture-loader.ts | 88.96% | 85.38% | 100% |

## Changed Files
- A packages/ai-team-web/src/lib/llm/fixture-loader.ts (340 行, 2 helpers)
- M packages/ai-team-web/src/lib/llm/index.ts (re-export)
- A packages/ai-team-web/test/fixture-loader-v178.test.ts (31 tests)

## Features

**Helpers (2 functions)**
- `loadFixturesFromJson(input: string | unknown): LoadResult`
  - 接受 JSON 字符串或已解析的对象
  - 强制校验 id / input / expected / 各字段类型 + enum + 范围
  - 永不抛错：`LoadResult { fixtures, errors, total, accepted }`
  - 仅在字符串输入真的解析不出 JSON 时 throw
- `loadFixturesOnly(input): ReadonlyArray<EvalFixture>`
  - 便捷 happy-path，只返回 valid fixtures

**Schema Validation (错误列表 with index + path + message)**
- id (string, 必需)
- label (string, 可选)
- input:
  - sessionId / position / candidateName (string)
  - previousQuestions / recentTranscript / evaluationHistory (array)
  - recentTranscript[i].text (string)
  - trigger.kind (manual | content-shift | time-based)
- expected:
  - questionEquals / questionContains / questionMatches / rationaleContains / baselineQuestion (string)
  - focusTag (technical | communication | problemSolving | culture)
  - difficulty (easy | medium | hard)
  - similarityAtLeast (number in [0, 1])

## ROI
- **CI 可用**: 团队可以从 disk 写 fixture suite，git-host 仓库自动跑回归
- **Record-playback 闭环**: 生产环境可导出历史 fixture → CI replay → agent regression
- **容错**: 错误列表 (而非 throw) 让 CI dashboard 可以选择性 fail 或 warning

## Test Coverage (V178 31/31)
- **Happy paths (5)**: JSON 字符串 / 解析对象 / 空 array / 无 fixtures key / malformed JSON 抛错
- **Per-field validation (14)**: id/label/input/input/sessionId/trigger/focusTag/similarityAtLeast/baselineQuestion/rationaleContains/questionMatches/empty expected
- **Mixed validity (3)**: 多 fixture 含 errors 但 accepted 部分 / fixtures 非 array / 多 assertion
- **Kept branches (6)**: 各 valid enum / fixture without input
- **loadFixturesOnly (3)**: 接受/empty/malformed

## Next Directions
1. **V179 EvalRunner Component** — V175 React 包装 + 状态机 (mid ROI, 5h)
2. **V180 Audio Diff View** — 录音 waveform 对比 (low ROI, 4h)
3. **V181 WebAssembly Whisper** — 浏览器侧 model 加载 (high ROI, 12h)
4. **V182 Fixtures Replay Page** — 录制对话 → 保存 fixtures (mid ROI, 6h)
