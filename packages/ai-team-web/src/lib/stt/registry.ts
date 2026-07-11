// V161: STT provider registry. Lists all available providers and surfaces
// selectors for the UI (only showing *supported* ones as options).

import type { SttProvider, SttProviderOption } from './types';
import { WebSpeechProvider } from './web-speech-provider';
import { MockSttProvider } from './mock-provider';
import { WhisperSttProvider, WhisperServerSttProvider } from './whisper-provider';
import { WhisperLocalSttProvider } from './whisper-local-provider';

export function listSttProviders(): SttProvider[] {
  return [
    new MockSttProvider(),
    new WebSpeechProvider(),
    new WhisperSttProvider(),
    // V173: locally hosted whisper.cpp server (batch mode).
    new WhisperServerSttProvider(),
    // V180: in-browser WASM/ONNX Whisper pipeline.
    new WhisperLocalSttProvider(),
  ];
}

export function listSttProviderOptions(): SttProviderOption[] {
  return listSttProviders().map((p) => ({
    id: p.id,
    label: p.label,
    description: p.local ? '本地处理 · 隐私优先' : '远程服务 · 数据外发',
    local: p.local,
    supported: p.supported,
  }));
}

export function getSttProvider(id: string): SttProvider | undefined {
  return listSttProviders().find((p) => p.id === id);
}

export function getDefaultSttProviderId(): string {
  // Always fall back to mock — the UI is exercised without a microphone.
  return listSttProviderOptions().find((o) => o.supported)?.id ?? 'mock';
}
