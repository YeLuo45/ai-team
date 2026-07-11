# Delivery Report — ai-team

**Ready**: yes
**Headline**: V182 EvalResultsExporter — JSON / NDJSON / Markdown 跑分导出
**Proposal**: P-20260705-020
**Commit**: feat(V182): EvalResultsExporter (JSON/NDJSON/Markdown)

## Validation
- `npx vitest run packages/ai-team-web/test/eval-export-v182.test.ts` (NODE_ENV=test) — 16/16 passed
- V175+V179+V181 回归全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches | Funcs |
|---|---:|---:|---:|
| llm/eval-export.ts | 83.56% | 89.36% | 90.9% |

漏的是 downloadResults 的 happy-path DOM 交互部分 (URL.createObjectURL + a.click()).
这部分必须在真实浏览器中测试 — happy-dom 不完整支持。

## Changed Files
- A packages/ai-team-web/src/lib/llm/eval-export.ts (180 行)
- M packages/ai-team-web/src/lib/llm/index.ts (re-export)
- A packages/ai-team-web/test/eval-export-v182.test.ts (16 tests)

## Features

**3 formats**
- **JSON** — envelope + totals + summary + results 数组
- **NDJSON** — 流式友好，一个 case 一行
- **Markdown** — header + stats + 表格 (GitHub / Slack 直接渲染)

**Options**
- `format` 选择 (`json` / `ndjson` / `markdown`)
- `includeMetadata` 切换 (去掉 totals + summary)
- `prettyPrint` 切换 (单行 vs 2-space indent)

**Helpers (5)**
- `serialize(results, options)` — 返回 text payload
- `toBlob(results, options)` — `{ name, blob, mime, payload }` ready for download
- `exportFilename(format, timestamp?)` — 文件名
- `downloadResults(results, options)` — 浏览器触发下载 (DOM-aware)

## ROI
- **CI-ready**: `serialize` 写到 disk, jq-friendly JSON 格式
- **Slack / GitHub 可读**: Markdown 表格粘贴即可
- **NDJSON 流式**: 数千 case 也能 pipe to log aggregation
- **去 metadata 轻量**: API 直接 fetch 返回单纯 results 数组

## Test Coverage (V182 16/16)
- **JSON (5)**: envelope + includeMetadata + prettyPrint + round-trip + empty
- **NDJSON (2)**: 1 envelope + N case, 无 metadata
- **Markdown (3)**: heading + table, failure note, errored render
- **toBlob (3)**: JSON/NDJSON/Markdown mime + extension
- **exportFilename (1)**: timestamp + extension
- **downloadResults (2)**: skipped + Node path

## Next Directions
1. **V186 EvalStreamingRunner UI** — replace V179 Run button with streaming-aware version (mid ROI, 6h)
2. **V183 transformers.js 集成** — V180 ONNX 完整化 (mid ROI, 5h)
3. **V184 Audio Diff View** — waveform 对比 (low ROI, 4h)
4. **V185 Privacy Override Log** — 用户主动 export 留 trail (low ROI, 3h)
5. **V187 EvalTimeline** — 历史 eval runs timeline (low ROI, 4h)
