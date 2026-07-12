// V188: Privacy Override Log — durable audit trail of every consent
// decision that released a privacy-sensitive operation. Persisted as
// a JSON record passed to the caller's storage adapter.

export type PrivacyOpKind =
  | 'export-audio'
  | 'export-interview'
  | 'clipboard-copy'
  | 'remote-stream';

export type PrivacyOutcome = 'allowed' | 'denied' | 'timeout';

export interface PrivacyOverrideEvent {
  /** Stable identifier — usually a UUID or hash. */
  id: string;
  /** Operation the user consented to / blocked. */
  op: PrivacyOpKind;
  /** Reason the user gave (free-text). */
  reason: string;
  /** Outcome as recorded by the gate. */
  outcome: PrivacyOutcome;
  /** ms epoch when the decision was made. */
  decidedAtMs: number;
  /** Optional user / session handle — never store credentials. */
  actor?: string;
  /** ms epoch when the override window expires. */
  expiresAtMs?: number;
}

export interface RecordOptions {
  /** Last N events to retain in-memory; defaults to 200. */
  retention?: number;
  /** Optional storage adapter (e.g. localStorage). */
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
}

const STORAGE_KEY = 'ai-team:privacy-override-log';

/** Generic in-memory override-log store. */
export class PrivacyOverrideLog {
  private events: PrivacyOverrideEvent[] = [];
  private readonly retention: number;
  private readonly storage: RecordOptions['storage'] | undefined;

  constructor(opts: RecordOptions = {}) {
    this.retention = opts.retention ?? 200;
    this.storage = opts.storage;
    if (this.storage) {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PrivacyOverrideEvent[];
          if (Array.isArray(parsed)) this.events = parsed.slice(-this.retention);
        } catch {
          // ignore corrupt logs
        }
      }
    }
  }

  record(event: PrivacyOverrideEvent): PrivacyOverrideEvent[] {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      this.events[idx] = event;
    } else {
      this.events.push(event);
    }
    if (this.events.length > this.retention) {
      this.events = this.events.slice(this.events.length - this.retention);
    }
    this.persist();
    return this.events.slice();
  }

  list(): ReadonlyArray<PrivacyOverrideEvent> {
    return this.events.slice();
  }

  /** Filtered list — pass `sinceMs` to scope the query to a time range. */
  filter(opts: { sinceMs?: number; outcome?: PrivacyOutcome | 'all'; op?: PrivacyOpKind } = {}): PrivacyOverrideEvent[] {
    const sinceMs = opts.sinceMs ?? 0;
    return this.events.filter((e) => {
      if (e.decidedAtMs < sinceMs) return false;
      if (opts.op && e.op !== opts.op) return false;
      if (opts.outcome && opts.outcome !== 'all' && e.outcome !== opts.outcome) return false;
      return true;
    });
  }

  /** Mask: drop entries older than cutoffMs. Returns the removed count. */
  prune(cutoffMs: number): number {
    const before = this.events.length;
    this.events = this.events.filter((e) => e.decidedAtMs >= cutoffMs);
    const removed = before - this.events.length;
    if (removed > 0) this.persist();
    return removed;
  }

  /** Count events of a given outcome — for audit dashboards. */
  countByOutcome(outcome: PrivacyOutcome): number {
    return this.events.filter((e) => e.outcome === outcome).length;
  }

  private persist(): void {
    if (!this.storage) return;
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.events));
  }
}

/** Helper for generating stable IDs when the caller doesn't ship one. */
export function makeOverrideId(decidedAtMs: number, actor?: string): string {
  const seed = actor ?? 'anon';
  return `priv-${decidedAtMs.toString(36)}-${seed.replace(/\s+/g, '_')}`;
}

/** Pretty-printer — used by tests + dashboards. */
export function formatOverrideLine(event: PrivacyOverrideEvent): string {
  const t = new Date(event.decidedAtMs).toISOString();
  const who = event.actor ?? 'anon';
  return `${t}\t${event.op}\t${event.outcome}\t${who}\t${event.reason}`;
}
