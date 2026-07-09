// V174: Privacy summary helpers — surfaces a single source of truth for
// "is this interview 100% local processing?" across the STT + LLM
// providers. Pure functions. No React.
//
// Use case: a header chip that shows 🔒 全链路本地 vs ⚠️ 远程转发.
// The component consumes `summarizePrivacy()` and never reads provider
// internals.

export type PrivacyMode = 'full-local' | 'partial-local' | 'remote';

export interface PrivacyInputs {
  /** Selected STT provider. When `local=false` (e.g. remote Whisper API),
   *  audio leaves the browser and so does not qualify as local. */
  sttLocal: boolean;
  /** Selected LLM provider. `local=false` means prompts leave the
   *  browser (e.g. OpenAI). */
  llmLocal: boolean;
  /** Optional STT endpoint (whisper-server / ollama host). Shown in the
   *  chip so the user can verify it really is on localhost. */
  sttEndpoint?: string;
  /** Optional LLM endpoint. */
  llmEndpoint?: string;
}

export interface PrivacyStatus {
  /** Aggregate mode: `full-local` only when both providers are local. */
  mode: PrivacyMode;
  /** Per-provider local flag, mirrored for the UI. */
  sttLocal: boolean;
  llmLocal: boolean;
  /** Pretty label. */
  label: string;
  /** Tone colour hint ('local' | 'mixed' | 'remote'). */
  tone: 'local' | 'mixed' | 'remote';
  /** Endpoint strings for the privacy badge tooltip / detail. */
  endpoints: ReadonlyArray<{ kind: 'stt' | 'llm'; url: string }>;
}

/** Pretty labels in Chinese to match the interview-UI strings. */
const FULL_LOCAL_LABEL = '🔒 100% 本地处理';
const PARTIAL_LOCAL_LABEL = '🟡 部分本地处理';
const REMOTE_LABEL = '☁️ 远程转发';

/**
 * Reduce STT/LLM local flags + optional endpoint strings to a single
 * badge-ready status object. Pure — no side effects, no I/O.
 */
export function summarizePrivacy(inputs: PrivacyInputs): PrivacyStatus {
  const endpoints: Array<{ kind: 'stt' | 'llm'; url: string }> = [];
  if (inputs.sttEndpoint) endpoints.push({ kind: 'stt', url: inputs.sttEndpoint });
  if (inputs.llmEndpoint) endpoints.push({ kind: 'llm', url: inputs.llmEndpoint });

  const sttLocal = !!inputs.sttLocal;
  const llmLocal = !!inputs.llmLocal;

  if (sttLocal && llmLocal) {
    return {
      mode: 'full-local',
      sttLocal,
      llmLocal,
      label: FULL_LOCAL_LABEL,
      tone: 'local',
      endpoints,
    };
  }
  if (sttLocal || llmLocal) {
    return {
      mode: 'partial-local',
      sttLocal,
      llmLocal,
      label: PARTIAL_LOCAL_LABEL,
      tone: 'mixed',
      endpoints,
    };
  }
  return {
    mode: 'remote',
    sttLocal,
    llmLocal,
    label: REMOTE_LABEL,
    tone: 'remote',
    endpoints,
  };
}

/**
 * Drop the protocol prefix + port noise for the badge hover tooltip.
 * `http://127.0.0.1:8178/` → `127.0.0.1:8178`
 */
export function shortEndpoint(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/**
 * Format the endpoints array for the privacy detail row. Each line is
 * `<kind>: <host>`. Empty array → undefined.
 */
export function formatEndpoints(endpoints: ReadonlyArray<{ kind: 'stt' | 'llm'; url: string }>): string {
  return endpoints
    .map((e) => `${e.kind.toUpperCase()}: ${shortEndpoint(e.url) ?? e.url}`)
    .join('\n');
}
