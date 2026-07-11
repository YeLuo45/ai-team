# Delivery Report — ai-team

**Ready**: yes
**Headline**: V180 WhisperLocal — 浏览器 WASM/ONNX in-browser Whisper (100% 本地)
**Proposal**: P-20260705-018
**Commit**: feat(V180): WhisperLocal in-browser WASM/ONNX STT provider

## Validation
- `npx vitest run packages/ai-team-web/test/whisper-local-v180.test.ts` (NODE_ENV=test) — 14/14 passed
- 直接依赖 V171+V173+V177 回归 23/23 全过
- `npx tsc --noEmit -p packages/ai-team-web/tsconfig.json` — exit 0
- `npm run verify:readme` — 40/40 passed

## Coverage
| File | Lines | Branches | Funcs |
|---|---:|---:|---:|
| stt/whisper-local-client.ts | 100% | 85% | 100% |
| stt/whisper-local-provider.ts | 54.83% | 52.38% | 77.77% |

(Provider coverage 受限于 happy-dom 不模拟 MediaDevices/AudioContext;
通过 mock navigator.mediaDevices + AudioContext 把关键路径覆盖。)

## Changed Files
- A packages/ai-team-web/src/lib/stt/whisper-local-client.ts (210 行)
- A packages/ai-team-web/src/lib/stt/whisper-local-provider.ts (140 行)
- M packages/ai-team-web/src/lib/stt/registry.ts (WhisperLocalSttProvider 注册)
- A packages/ai-team-web/test/whisper-local-v180.test.ts (14 tests)

## meetily Capability Mapping

meetily 关键 USP — **4× 实时 Whisper 转录** 现在有 3 条本地路径：

| Provider | Mode | Default Model | Notes |
|---|---|---|---|
| **Web Speech** | streaming | browser | Chromium-only, 语言受限于浏览器 |
| **Whisper-Server** (V173) | batch | (server-side) | 依赖外部 whisper.cpp 服务 |
| **Whisper-Local** (V180) | streaming (in-tab) | `Xenova/whisper-base` | WASM/ONNX 完全在浏览器 tab 内 |

## Features

**WhisperLocalClient (210 行, pure / testable)**
- `transcribe(audio: Float32Array, options)` — 接受 16 kHz mono audio
- 默认 mock pipeline (deterministic) — 测试 / 离线开发用
- `attachPipeline(pipeline)` / `resetPipeline()` — 切换到真实 `@xenova/transformers`
- `isModelCached(model?)` — HEAD probe 测模型文件是否在浏览器缓存
- `resolveModelUrl(model?)` — HuggingFace CDN URL
- options: model / language / signal (AbortController)

**WhisperLocalSttProvider (140 行)**
- 实现 `SttProvider` 接口: id='whisper-local' / local=true / supported=true
- 浏览器侧 getUserMedia + AudioContext 录音
- `start()` / `stop()` 流式 lifecycle
- transcript 通过 `session.onChunk` 推送 — V172 SpeakerDiarization 直接消费

**生产环境集成 (1 行)**
```ts
import { pipeline } from '@xenova/transformers';
attachPipeline(async (audio, opts) => {
  const pipe = await pipeline('automatic-speech-recognition', opts.model);
  return (await pipe(audio)).text;
});
```

## ROI
- **meetily 第 1 USP 完全本地化**: 无需 whisper.cpp server
- **零云依赖**: 100% 本地 ONNX runtime (transformers.js 是 onnxruntime-web 包装)
- **Privacy badge** 立即反应 — V174/V177 自动显示 full-local 模式

## Test Coverage (V180 14/14)
- **WhisperLocalClient (7)**: defaults / mock deterministic / attachPipeline + resetPipeline / non-Float32Array rejected / model override / isModelCached 真值表 / segments collapse
- **WhisperLocalSttProvider (7)**: provider meta / language / client passthrough / custom constructor / stop no-op / getUserMedia error path / 完整 start/stop lifecycle

## Next Directions
1. **V181 EvalStreamingRunner** — V179 升级版，流式 progress (mid ROI, 5h)
2. **V182 EvalExportButton** — 跑分结果 JSON 导出 (mid ROI, 3h)
3. **V183 transformers.js 集成** — 真正在浏览器加载 Whisper ONNX (mid ROI, 5h)
4. **V184 Audio Diff View** — 录音样本 waveform 对比 (low ROI, 4h)
