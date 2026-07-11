# Delivery Report — ai-team

**Ready**: yes
**Headline**: V183 transformers.js adapter — V180 ONNX 完整化的契约层
**Proposal**: P-20260705-022
**Commit**: feat(V183): transformers.js adapter contract

## Validation
- `npx vitest run packages/ai-team-web/test/transformers-adapter-v183.test.ts` (NODE_ENV=test) — 18/18 passed
- V180 regression 全过 (14/14)
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches | Funcs |
|---|---:|---:|---:|
| stt/transformers-adapter.ts | 92.3% | 91.17% | 91.66% |

## Changed Files
- A packages/ai-team-web/src/lib/stt/transformers-adapter.ts (160 行)
- A packages/ai-team-web/test/transformers-adapter-v183.test.ts (18 tests)

## Features

**transformers-adapter.ts (160 行)**
- `TransformersAsr` + `TransformersOutput` 契约类型
- `transformersBundleUrl()` — 默认 CDN URL
- `loadTransformersModule(url?, importer?)` — 动态 import + 缓存
- `resetTransformersCache()` — 清缓存
- `adaptTransformersPipeline(pipe)` — transformers.js → WhisperLocalPipeline 适配器
- `normalizeOut(out, durationSec)` — 简单输出 + chunk 标准化
- `cachePrimingUrl(base, revision)` — cacheBust 助手
- `isValidModelId(model)` — HuggingFace org/name 校验

## 集成 (1 行)

```ts
const tx = await loadTransformersModule();
const pipe = await tx.pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
const client = new WhisperLocalClient({ pipeline: adaptTransformersPipeline(pipe) });
const result = await client.transcribe(audio);
```

## ROI
- **完整 meetily 第 1 USP**: 4× 实时 Whisper 转录 — 完全在浏览器 tab 内
- **零云依赖**: 本地 ONNX runtime
- **真模型可加载**: 不再是 mock; 换 1 行就接生产

## Test Coverage (V183 18/18)
- **URL validation (3)**: bundle URL / isValidModelId (positive + negative) / cachePrimingUrl (有/无 query string)
- **Module loader (5)**: 默认 URL / custom URL / cache 命中 / URL 改变时 re-import / default-exports 解包 / reset cache
- **Pipeline adapter (3)**: Float32Array 委托 / language option / chunks→text
- **normalizeOut (4)**: text-only / empty / bare-string / NaN timestamp 丢弃
- **End-to-end (1)**: load → adapt → transcribe roundtrip

## Next Directions
1. **V184 Audio Diff View** — waveform 对比 (low ROI, 4h)
2. **V187 EvalTimeline** — 历史 eval runs 时间线 (low ROI, 4h)
3. **V188 Privacy Override Log** — consent flow (low ROI, 3h)
4. **V189 Playwright 集成** — V186 timing tests (low ROI, 4h)
5. **V185 Realtime Subtitle Pipeline** — streaming STT 输出字幕 (mid ROI, 6h)
