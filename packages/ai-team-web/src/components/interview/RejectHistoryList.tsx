// V156: RejectHistoryList — parse the historical reject reasons that
// handleRejectSubmit appended to candidate.notes, and render them as a
// compact timeline. Each entry looks like:
//   [rejected 2026-06-21T03:00:00.000Z] reason text

import { Card } from '../design-system';

export interface RejectEntry {
  /** ISO timestamp string captured at submission time. */
  timestamp: string;
  /** The human-readable reason text. */
  reason: string;
  /** Source line (1-based) in the original notes. Useful for debugging. */
  line: number;
}

const REJECT_LINE_REGEX = /^\[rejected\s+(\S+)\]\s*(.*)$/;

/**
 * Parse the trailing reject-reason lines from a candidate.notes string.
 * Lines that don't match the `[rejected <iso>] <reason>` pattern are skipped
 * (other notes content stays untouched).
 */
export function parseRejectNotes(notes: string | undefined | null): RejectEntry[] {
  if (!notes) return [];
  const lines = notes.split('\n');
  const out: RejectEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = REJECT_LINE_REGEX.exec(line);
    if (!match) continue;
    out.push({ timestamp: match[1], reason: match[2].trim(), line: i + 1 });
  }
  return out;
}

/** Format an ISO timestamp as a short Chinese-friendly string. */
export function formatRejectTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

interface Props {
  notes: string | undefined | null;
  maxItems?: number;
}

export function RejectHistoryList({ notes, maxItems = 5 }: Props) {
  const all = parseRejectNotes(notes);
  if (all.length === 0) {
    return (
      <Card className="text-center text-xs text-slate-500" testId="reject-history-empty">
        <p>该候选人尚无被拒原因记录</p>
      </Card>
    );
  }
  // Show the most recent entries first
  const sorted = [...all].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const visible = sorted.slice(0, maxItems);
  const hidden = Math.max(0, sorted.length - visible.length);

  return (
    <Card className="space-y-2" testId="reject-history">
      <header className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          被拒历史
          <span
            className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-normal text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
            data-testid="reject-history-count"
          >
            {all.length} 次
          </span>
        </h4>
        {hidden > 0 && (
          <span className="text-[11px] text-slate-500" data-testid="reject-history-hidden">
            还有 {hidden} 条更早的记录
          </span>
        )}
      </header>

      <ol className="space-y-2" data-testid="reject-history-list">
        {visible.map((entry, idx) => (
          <li
            key={`${entry.line}-${entry.timestamp}-${idx}`}
            className="rounded-md border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900/30"
            data-testid="reject-history-entry"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span data-testid="reject-history-timestamp">
                {formatRejectTimestamp(entry.timestamp)}
              </span>
              <span className="text-slate-400">第 {entry.line} 行</span>
            </div>
            <p
              className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200"
              data-testid="reject-history-reason"
            >
              {entry.reason}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}