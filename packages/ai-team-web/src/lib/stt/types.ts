// V161: STT (speech-to-text) Provider abstraction.
// All providers implement this interface so the UI / orchestrator layer can
// switch them at runtime without changing any consumer code.
//
// Lifecycle:
//   1. UI calls `provider.start(session)` — provider starts emitting events.
//   2. Provider invokes `session.onTranscript({ text, isFinal, confidence })`
//      for each partial / final recognition result.
//   3. UI calls `provider.stop()` to release the microphone and clear state.
//
// Privacy note: providers are *local* (Web Speech API) or *remote* (Whisper /
// third-party). The UI shows a badge that reflects this so the user is aware
// when speech is leaving the browser.

export type SttSpeaker = 'candidate' | 'interviewer' | 'unknown';

export interface SttTranscriptChunk {
  /** Recognized text for this segment. */
  text: string;
  /** `true` when the provider has finalized the segment (e.g. silence detected). */
  isFinal: boolean;
  /** Optional confidence score in [0, 1]. */
  confidence?: number;
  /** Speaker hint: candidate / interviewer / unknown. */
  speaker?: SttSpeaker;
  /** When this chunk was captured. */
  timestamp?: number;
}

export interface SttSession {
  onChunk(chunk: SttTranscriptChunk): void;
  onError?(error: SttError): void;
  onStateChange?(state: SttState): void;
}

export type SttState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'paused'
  | 'stopping'
  | 'error';

export interface SttError {
  code: string;
  message: string;
}

export interface SttProvider {
  readonly id: string;
  readonly label: string;
  /** Whether the provider is available in the current browser/runtime. */
  readonly supported: boolean;
  /** Local provider (audio never leaves the browser) vs remote (server). */
  readonly local: boolean;
  /** Begin emitting transcript chunks. Idempotent — multiple calls are no-ops. */
  start(session: SttSession): Promise<void>;
  /** Stop listening and release any native resources. */
  stop(): Promise<void>;
  /** Best-effort language code, e.g. "zh-CN". Defaults to "auto" if unknown. */
  language(): string;
}

/** Metadata for the UI selector — includes a short description + privacy badge. */
export interface SttProviderOption {
  id: string;
  label: string;
  description: string;
  local: boolean;
  supported: boolean;
}
