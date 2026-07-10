// V177: PrivacyGuard helpers — pure functions that decide whether a
// "privacy-sensitive" UI operation should be blocked / warned against
// given the current PrivacyStatus. Lives next to `summary.ts` so the
// V174 reducer is the single source of truth.
//
// Privacy-sensitive operations we flag today:
//   - 'export-audio'      — uploading / saving raw audio from the session
//   - 'export-interview'  — exporting the candidate's notes
//   - 'clipboard-copy'    — copying sensitive text outside the browser
//   - 'cloud-summary'     — sending the transcript to a cloud LLM
//
// Adding a new op is a one-liner: extend `PrivacySensitiveOp` and update
// `isOperationBlocked`.

import type { PrivacyStatus } from './summary';

export type PrivacySensitiveOp =
  | 'export-audio'
  | 'export-interview'
  | 'clipboard-copy'
  | 'cloud-summary';

export interface PrivacyDecision {
  /** Whether the operation should be blocked outright (`true`) or just
   *  softened with a warning chip (`false`). */
  blocked: boolean;
  /** Tone used by the `<PrivacyGate>` chip. */
  tone: 'ok' | 'warn' | 'block';
  /** User-facing label. */
  label: string;
  /** Longer description surfaced in the gate banner. */
  detail: string;
}

export const OK: PrivacyDecision = {
  blocked: false,
  tone: 'ok',
  label: '✅ 可在本地执行',
  detail: '当前 STT + LLM 均为本地处理 — 该操作不会离开浏览器',
};

export const WARN_PARTIAL: PrivacyDecision = {
  blocked: false,
  tone: 'warn',
  label: '⚠️ 部分数据外发',
  detail: '部分 provider 为远程 — 数据可能经过外部服务',
};

export const BLOCK_REMOTE: PrivacyDecision = {
  blocked: true,
  tone: 'block',
  label: '🔒 已阻止 — 远程模式',
  detail: '当前所有 provider 均为远程 — 该操作会外发本地数据',
};

export const BLOCK_REMOTE_OP: PrivacyDecision = {
  blocked: true,
  tone: 'block',
  label: '🔒 已阻止',
  detail: '在远程模式下该操作被阻止以保护候选人隐私',
};

/**
 * Decide if a privacy-sensitive op is allowed under the current privacy
 * status. Pure function. Designers can map individual ops to specific
 * thresholds (e.g. always block `export-audio` in remote mode).
 */
export function evaluateGuard(
  status: PrivacyStatus,
  op: PrivacySensitiveOp,
): PrivacyDecision {
  // Full local — always allow.
  if (status.mode === 'full-local') return OK;
  // Partial local — warn but allow.
  if (status.mode === 'partial-local') return WARN_PARTIAL;
  // Remote — block depending on the op's sensitivity.
  switch (op) {
    case 'export-audio':
    case 'export-interview':
      return BLOCK_REMOTE_OP;
    case 'clipboard-copy':
      return BLOCK_REMOTE_OP;
    case 'cloud-summary':
      // The cloud-summary op is harmless when the LLM is already remote —
      // `mode` will be `partial-local` so this branch is hit only when both
      // providers are remote AND the LLM is involved anyway. We still
      // block to keep the policy conservative.
      return BLOCK_REMOTE_OP;
  }
}

/** Convenience: just the boolean. */
export function isOperationBlocked(
  status: PrivacyStatus,
  op: PrivacySensitiveOp,
): boolean {
  return evaluateGuard(status, op).blocked;
}

/** Convenience: just the tone. */
export function guardTone(
  status: PrivacyStatus,
  op: PrivacySensitiveOp,
): PrivacyDecision['tone'] {
  return evaluateGuard(status, op).tone;
}
