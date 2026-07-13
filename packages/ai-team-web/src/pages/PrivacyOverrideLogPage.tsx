// V203: PrivacyOverrideLogPage — wires the V200 PrivacyOverrideLogView
// component into the SPA route /privacy-override-log.
//
// Reads the V188 PrivacyOverrideLog from localStorage (via
// `readHistory` shape — same STORAGE_KEY prefix used by V188) and feeds
// the events to the presentational V200 component. SSR-safe: returns
// the empty-state view until the client mount lands.

import { useMemo } from 'react';
import { PrivacyOverrideLogView } from '../components/privacy/PrivacyOverrideLogView';
import type { PrivacyOverrideEvent } from '../lib/privacy/override-log';

const STORAGE_KEY = 'ai-team:privacy-override-log';

interface StoredFile {
  version: 1;
  events: PrivacyOverrideEvent[];
}

function readLog(storage: { getItem(k: string): string | null } | null): StoredFile {
  if (!storage) return { version: 1, events: [] };
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { version: 1, events: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredFile>;
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
      return { version: 1, events: [] };
    }
    return { version: 1, events: parsed.events };
  } catch {
    return { version: 1, events: [] };
  }
}

export function PrivacyOverrideLogPage() {
  const events = useMemo<PrivacyOverrideEvent[]>(() => {
    if (typeof window === 'undefined') return [];
    return readLog(window.localStorage).events;
  }, []);

  return (
    <div className="p-6 space-y-3" data-testid="privacy-override-log-page">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Privacy Override Log
        </h2>
        <span className="text-xs font-mono text-slate-500" data-testid="pol-page-storage">
          storage: {STORAGE_KEY}
        </span>
      </header>
      <PrivacyOverrideLogView
        testId="polp"
        events={events}
        highlightOps={['export-audio', 'export-interview', 'clipboard-copy', 'remote-stream']}
        title="Audit Trail"
      />
    </div>
  );
}

export default PrivacyOverrideLogPage;