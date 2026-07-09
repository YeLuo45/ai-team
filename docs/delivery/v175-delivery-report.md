# Delivery Report — ai-team

**Ready**: yes
**Headline**: V175 Agent Eval Harness — 回放 fixtures 测 LLM agent (LangSmith 风格)
**Proposal**: P-20260705-013
**Commit**: feat(V175): agent eval harness for replays

## Validation
- `npx vitest run packages/ai-team-web/test/eval-harness-v175.test.ts` (NODE_ENV=test) — 17/17 passed
- V164-V174 regression: 144/144 全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches |
|---|---:|---:|
| llm/eval-harness.ts | 96.34% | 79.16% |

## Changed Files
- A packages/ai-team-web/src/lib/llm/eval-harness.ts (270 行)
- M packages/ai-team-web/src/lib/llm/index.ts (re-export EvalFixture 等)
- A packages/ai-team-web/test/eval-harness-v175.test.ts (17 tests)

## Features

**Pure helpers**
- `EvalFixture` — id + input + expected (含 6 种断言)
- `EvalExpectation` — questionEquals / questionContains / questionMatches (regex) / focusTag / difficulty / rationaleContains / similarityAtLeast + baselineQuestion
- `AgentRunner` — wrap any `QuestionSuggestionAgent` 为 testable runner
- `runEvalCase(runner, fixture)` — 单次回放 → 完整 `EvalCaseResult`
- `runEvalSuite(runner, fixtures)` — 顺序跑整套
- `summarise(results)` — `EvalSummary { total, passed, failed, passRate, totalElapsedMs, byRunner }`
- `passRate(summary)` / `formatPassRate(summary)` — `01/42 (2.4%)` 格式
- `evaluateExpectation(actual, expected)` — 公开断言函数 (pure)

**Error handling**
- Agent 抛错时 → `actual: null` + `error: msg` → case 自动 fail
- 即便错误也记录 `elapsedMs`

## ROI
- **测试基础设施**：当 LLM agent 升级后立即能跑回归确认不破坏
- **CI-ready**：纯函数可以加载 JSON fixture 库，CI 自动跑
- **可比答案**：questionContains / questionMatches / similarity floor 三种粒度

## Test Coverage (V175 17/17)
- **runEvalCase (4)**: 全 pass + 单 failure + agent throw 错误传递 + elapsedMs
- **runEvalSuite (1)**: 顺序执行
- **summarise / passRate / formatPassRate (3)**: 聚合统计 + 边界
- **evaluateExpectation (9)**: 7 种断言 + 边界

## Next Directions
1. **V176 PrivacyGuard Component Wrapper** — privacy=remote 时禁用隐私敏感 UI (mid ROI, 4h)
2. **V177 EvalResultsTable Component** — 显示 EvalSummary 的 React 表格 (mid ROI, 3h)
3. **V178 WebAssembly Whisper** — 浏览器侧 model 加载 (high ROI, 12h)
4. **V179 EvalFixture JSON Loader** — 从 disk 读 fixtures 库 (mid ROI, 4h)
