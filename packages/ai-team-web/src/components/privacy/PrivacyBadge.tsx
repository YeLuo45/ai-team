// V174: PrivacyBadge — compact header chip that summarises whether the
// current STT + LLM providers keep everything local. Drop-in companion
// to the header bar in <App />.
//
// Renders three visual states driven by `summarizePrivacy()`:
//   * `local`  → emerald chip, "🔒 100% 本地处理"
//   * `mixed`  → amber   chip, "🟡 部分本地处理"
//   * `remote` → rose    chip, "☁️ 远程转发"
//
// Hover surfaces the per-provider endpoint (host:port) so the user can
// verify it's really on localhost.

import { useMemo } from 'react';
import { summarizePrivacy, formatEndpoints, type PrivacyInputs } from '../../lib/privacy/summary';

export interface PrivacyBadgeProps {
  /** STT provider `local` flag. */
  sttLocal: boolean;
  /** LLM provider `local` flag. */
  llmLocal: boolean;
  /** Optional host:port for the STT provider (whisper-server by default). */
  sttEndpoint?: string;
  /** Optional host:port for the LLM provider (Ollama by default). */
  llmEndpoint?: string;
  /** Test id root. */
  testId?: string;
}

const TONE: Record<'local' | 'mixed' | 'remote', string> = {
  local: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 ring-emerald-300 dark:ring-emerald-700',
  mixed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 ring-amber-300 dark:ring-amber-700',
  remote: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 ring-rose-300 dark:ring-rose-700',
};

export function PrivacyBadge({
  sttLocal,
  llmLocal,
  sttEndpoint,
  llmEndpoint,
  testId = 'privacy',
}: PrivacyBadgeProps) {
  const status = useMemo<ReturnType<typeof summarizePrivacy>>(
    () => summarizePrivacy({ sttLocal, llmLocal, sttEndpoint, llmEndpoint } satisfies PrivacyInputs),
    [sttLocal, llmLocal, sttEndpoint, llmEndpoint],
  );

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${TONE[status.tone]}`}
      data-testid={testId}
      data-mode={status.mode}
      title={formatEndpoints(status.endpoints)}
      role="status"
      aria-live="polite"
      aria-label={`privacy mode: ${status.mode}`}
    >
      <span data-testid={`${testId}-label`}>{status.label}</span>
      {status.endpoints.length > 0 ? (
        <span
          className="hidden font-mono text-[10px] opacity-80 md:inline"
          data-testid={`${testId}-endpoints`}
        >
          {status.endpoints
            .map((e) => `${e.kind}:${shortHost(e.url)}`)
            .join(' · ')}
        </span>
      ) : null}
    </span>
  );
}

function shortHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/** Convenience: pass-through to the helper for ad-hoc callers. */
export { summarizePrivacy, formatEndpoints, type PrivacyInputs } from '../../lib/privacy/summary';
