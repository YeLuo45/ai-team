// V188 privacy override log tests.

import { describe, it, expect } from 'vitest';
import {
  PrivacyOverrideLog,
  makeOverrideId,
  formatOverrideLine,
  type PrivacyOverrideEvent,
} from '../src/lib/privacy/override-log';

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
const DAY = 86_400_000;

function makeEvent(over: Partial<PrivacyOverrideEvent> = {}): PrivacyOverrideEvent {
  return {
    id: over.id ?? 'priv-1',
    op: over.op ?? 'export-interview',
    reason: over.reason ?? 'demo write',
    outcome: over.outcome ?? 'allowed',
    decidedAtMs: over.decidedAtMs ?? NOW,
    actor: over.actor,
    expiresAtMs: over.expiresAtMs,
  };
}

describe('PrivacyOverrideLog — record / list', () => {
  it('records a new event and returns the snapshot', () => {
    const log = new PrivacyOverrideLog();
    const out = log.record(makeEvent());
    expect(out.length).toBe(1);
    expect(out[0]?.id).toBe('priv-1');
  });

  it('upserts when the id already exists', () => {
    const log = new PrivacyOverrideLog();
    log.record(makeEvent({ id: 'a', outcome: 'allowed' }));
    log.record(makeEvent({ id: 'a', outcome: 'denied' }));
    const all = log.list();
    expect(all.length).toBe(1);
    expect(all[0]?.outcome).toBe('denied');
  });

  it('respects retention by dropping oldest', () => {
    const log = new PrivacyOverrideLog({ retention: 2 });
    log.record(makeEvent({ id: 'x', decidedAtMs: NOW - 3 }));
    log.record(makeEvent({ id: 'y', decidedAtMs: NOW - 2 }));
    log.record(makeEvent({ id: 'z', decidedAtMs: NOW - 1 }));
    const all = log.list();
    expect(all.length).toBe(2);
    expect(all.map((e) => e.id)).toEqual(['y', 'z']);
  });
});

describe('PrivacyOverrideLog — filter / count / prune', () => {
  it('filters by op + outcome + sinceMs', () => {
    const log = new PrivacyOverrideLog();
    log.record(makeEvent({ id: '1', op: 'export-interview', outcome: 'allowed', decidedAtMs: NOW - 100 }));
    log.record(makeEvent({ id: '2', op: 'clipboard-copy', outcome: 'denied', decidedAtMs: NOW }));
    log.record(makeEvent({ id: '3', op: 'export-interview', outcome: 'denied', decidedAtMs: NOW }));

    expect(log.filter({ op: 'export-interview' }).length).toBe(2);
    expect(log.filter({ outcome: 'denied' }).length).toBe(2);
    expect(log.filter({ sinceMs: NOW - 50 }).length).toBe(2);
    expect(log.filter({ outcome: 'all', op: 'clipboard-copy' }).length).toBe(1);
  });

  it('counts events per outcome', () => {
    const log = new PrivacyOverrideLog();
    log.record(makeEvent({ id: '1', outcome: 'allowed' }));
    log.record(makeEvent({ id: '2', outcome: 'allowed' }));
    log.record(makeEvent({ id: '3', outcome: 'denied' }));
    expect(log.countByOutcome('allowed')).toBe(2);
    expect(log.countByOutcome('denied')).toBe(1);
    expect(log.countByOutcome('timeout')).toBe(0);
  });

  it('prunes entries older than the cutoff and returns the count', () => {
    const log = new PrivacyOverrideLog();
    log.record(makeEvent({ id: 'old', decidedAtMs: NOW - 30 * DAY }));
    log.record(makeEvent({ id: 'mid', decidedAtMs: NOW - 10 * DAY }));
    log.record(makeEvent({ id: 'new', decidedAtMs: NOW }));
    const removed = log.prune(NOW - 7 * DAY);
    expect(removed).toBe(2);
    expect(log.list().map((e) => e.id)).toEqual(['new']);
  });

  // V208: branch coverage — when nothing matches the cutoff,
  // `removed === 0` and `persist()` is skipped. Uses a strict
  // future cutoff so every recorded event survives.
  it('prune returns 0 (and skips persist) when nothing is older', () => {
    const log = new PrivacyOverrideLog();
    log.record(makeEvent({ id: 'fresh', decidedAtMs: NOW }));
    const removed = log.prune(NOW - 7 * DAY);
    expect(removed).toBe(0);
    expect(log.list().length).toBe(1);
  });
});

describe('PrivacyOverrideLog — storage adapter', () => {
  it('persists via the supplied storage adapter', () => {
    const store = new Map<string, string>();
    const log = new PrivacyOverrideLog({
      retention: 10,
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => {
          store.set(k, v);
        },
      },
    });
    log.record(makeEvent({ id: 'a' }));
    const out = JSON.parse(store.get('ai-team:privacy-override-log') ?? '[]');
    expect(out.length).toBe(1);
    expect(out[0]?.id).toBe('a');
  });

  it('rehydrates from storage on construction', () => {
    const store = new Map<string, string>([
      [
        'ai-team:privacy-override-log',
        JSON.stringify([{ id: 'injected', op: 'export-audio', outcome: 'allowed', reason: 'boot', decidedAtMs: NOW }]),
      ],
    ]);
    const log = new PrivacyOverrideLog({
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => {
          store.set(k, v);
        },
      },
    });
    expect(log.list().length).toBe(1);
    expect(log.list()[0]?.id).toBe('injected');
  });

  it('gracefully ignores corrupt storage payloads', () => {
    const store = new Map<string, string>([
      ['ai-team:privacy-override-log', '{not json'],
    ]);
    const log = new PrivacyOverrideLog({
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => {
          store.set(k, v);
        },
      },
    });
    expect(log.list().length).toBe(0);
  });
});

describe('makeOverrideId + formatOverrideLine', () => {
  it('produces a stable id from ts + actor', () => {
    const a = makeOverrideId(NOW, 'alice');
    const b = makeOverrideId(NOW, 'alice');
    expect(a).toBe(b);
    expect(a.startsWith('priv-')).toBe(true);
  });

  // V208: branch coverage — exercises the `actor ?? 'anon'` falsy
  // arm of makeOverrideId so anonymous callers get a stable seed.
  it('falls back to anon when no actor is supplied', () => {
    const a = makeOverrideId(NOW);
    const b = makeOverrideId(NOW);
    expect(a).toBe(b);
    expect(a).toContain('anon');
    expect(a.startsWith('priv-')).toBe(true);
  });

  it('renders a tab-separated override line', () => {
    const line = formatOverrideLine(makeEvent());
    expect(line).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(line).toContain('export-interview');
    expect(line).toContain('allowed');
  });

  // V208: branch coverage — `event.actor ?? 'anon'` falsy arm of
  // formatOverrideLine so the line is well-formed for anonymous events.
  it('renders an override line with anon when actor is missing', () => {
    const ev = makeEvent();
    delete (ev as { actor?: string }).actor;
    const line = formatOverrideLine(ev);
    expect(line).toContain('anon');
  });
});
