// V182: EvalResultsExporter — serialises an EvalCaseResult[] to JSON /
// NDJSON for export or piping to a CI dashboard.
//
// Three shapes the user might want:
//   * JSON   — single document, easy to inspect with jq / browser devtools
//   * NDJSON — line-delimited, one case per line, streamable to files /
//              log aggregation
//   * Markdown table — human-readable summary for Slack / GitHub commit
//                      comments
//
// The download helper is browser-only; both Node CLI callers and CI can
// skip the download step and write `serialize()` output to disk instead.

import type { EvalCaseResult, EvalSummary } from './eval-harness';
import { summarise, formatPassRate } from './eval-harness';

export interface ExportOptions {
  /** Format selector — `json` (default), `ndjson`, or `markdown`. */
  format?: 'json' | 'ndjson' | 'markdown';
  /** Embed metadata (timestamp / runner label / totals). */
  includeMetadata?: boolean;
  /** Pretty-print JSON output with 2-space indents (default true). */
  prettyPrint?: boolean;
}

export interface ExportEnvelope {
  /** ISO timestamp the export was generated. */
  exportedAt?: string;
  /** Format the envelope was rendered into. */
  format: 'json' | 'ndjson' | 'markdown';
  /** Total case count (only when includeMetadata=true). */
  total?: number;
  /** Per-runner counts (only when format=json with metadata). */
  summary?: {
    passed: number;
    failed: number;
    passRate: string;
  };
  /** The exportable payload. */
  results: ReadonlyArray<EvalCaseResult>;
}

/**
 * Stringify the results, returning a text payload ready to write to
 * disk, send over the wire, or pipe to a log.
 */
export function serialize(
  results: ReadonlyArray<EvalCaseResult>,
  options: ExportOptions = {},
): string {
  const format = options.format ?? 'json';
  const includeMetadata = options.includeMetadata ?? true;
  const pretty = options.prettyPrint ?? true;

  const summary = summarise(results);

  if (format === 'ndjson') {
    // Newline-delimited JSON: stream-friendly, one case per line.
    const lines: string[] = [];
    if (includeMetadata) {
      lines.push(stringifyEnvelope({
        exportedAt: new Date().toISOString(),
        format,
        total: results.length,
        results: [],
        summary: {
          passed: summary.passed,
          failed: summary.failed,
          passRate: formatPassRate(summary),
        },
      }, false));
    }
    for (const r of results) {
      lines.push(JSON.stringify(r));
    }
    return lines.join('\n');
  }

  if (format === 'markdown') {
    return renderMarkdown(results, summary);
  }

  // default JSON envelope
  const env: ExportEnvelope = {
    format,
    results,
  };
  if (includeMetadata) {
    env.exportedAt = new Date().toISOString();
    env.total = results.length;
    env.summary = {
      passed: summary.passed,
      failed: summary.failed,
      passRate: formatPassRate(summary),
    };
  }
  return stringifyEnvelope(env, pretty);
}

/**
 * Returns `{ name, blob, mime }` ready to feed into a download link or
 * `navigator.sendBeacon`. Pure — does not touch the DOM.
 */
export function toBlob(
  results: ReadonlyArray<EvalCaseResult>,
  options: ExportOptions = {},
): { name: string; blob: Blob; mime: string; payload: string } {
  const payload = serialize(results, options);
  const format = options.format ?? 'json';
  return {
    name: `eval-${Date.now()}.${extensionFor(format)}`,
    blob: new Blob([payload], { type: mimeFor(format) }),
    mime: mimeFor(format),
    payload,
  };
}

/** Returns the preferred filename for a given format. */
export function exportFilename(format: 'json' | 'ndjson' | 'markdown', timestamp?: Date): string {
  const ts = timestamp ?? new Date();
  const safe = ts.toISOString().replace(/[:.]/g, '-');
  return `eval-${safe}.${extensionFor(format)}`;
}

/** Trigger a browser download (DOM-only — no-op when `document` is undefined). */
export function downloadResults(
  results: ReadonlyArray<EvalCaseResult>,
  options: ExportOptions = {},
): { payload: string; filename: string; skipped: boolean } {
  const format = options.format ?? 'json';
  const payload = serialize(results, options);
  const filename = exportFilename(format);
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return { payload, filename, skipped: true };
  }
  const blob = new Blob([payload], { type: mimeFor(format) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Note: not awaiting revoke — browsers clean up when tab is destroyed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { payload, filename, skipped: false };
}

// ====================================================================
// internals
// ====================================================================

function stringifyEnvelope(env: ExportEnvelope, pretty: boolean): string {
  if (!pretty) return JSON.stringify(env);
  return JSON.stringify(env, null, 2);
}

function renderMarkdown(
  results: ReadonlyArray<EvalCaseResult>,
  summary: EvalSummary,
): string {
  const lines: string[] = [];
  lines.push(`# Eval Results`);
  lines.push('');
  lines.push(`- **Total**: ${summary.total}`);
  lines.push(`- **Passed**: ${summary.passed}`);
  lines.push(`- **Failed**: ${summary.failed}`);
  lines.push(`- **Pass-rate**: ${formatPassRate(summary)}`);
  lines.push('');
  lines.push('| Fixture | Runner | Status | Elapsed (ms) | Notes |');
  lines.push('|---|---|---|---:|---|');
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    const notes = r.error
      ? `error: ${r.error}`
      : r.checks
          .filter((c) => !c.passed)
          .map((c) => `${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
          .join('; ');
    const label = r.label ? `${r.fixtureId} (${r.label})` : r.fixtureId;
    lines.push(`| ${label} | ${r.runnerLabel} | ${status} | ${r.elapsedMs} | ${notes || '—'} |`);
  }
  return lines.join('\n');
}

function mimeFor(format: 'json' | 'ndjson' | 'markdown'): string {
  if (format === 'ndjson') return 'application/x-ndjson';
  if (format === 'markdown') return 'text/markdown';
  return 'application/json';
}

function extensionFor(format: 'json' | 'ndjson' | 'markdown'): string {
  if (format === 'ndjson') return 'ndjson';
  if (format === 'markdown') return 'md';
  return 'json';
}
