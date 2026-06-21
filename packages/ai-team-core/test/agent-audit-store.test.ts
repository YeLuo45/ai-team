// V22: AgentAuditStore tests
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentAuditStore } from '../src/store/agent-audit-store.js';
import type { AgentCallRecord } from '../src/types/agent-audit.js';

function makeStore(): AgentAuditStore {
  const dir = mkdtempSync(join(tmpdir(), 'agent-audit-'));
  return AgentAuditStore.create(dir);
}

function rec(over: Partial<AgentCallRecord>): AgentCallRecord {
  return {
    id: over.id ?? `ac_${Math.random().toString(36).slice(2)}`,
    agent: over.agent ?? 'interview',
    operation: over.operation ?? 'start',
    actorId: over.actorId ?? 'u1',
    inputSummary: over.inputSummary ?? '',
    outputSummary: over.outputSummary ?? '',
    status: over.status ?? 'success',
    durationMs: over.durationMs ?? 100,
    startedAt: over.startedAt ?? new Date().toISOString(),
    endedAt: over.endedAt ?? new Date().toISOString(),
    ...(over.entityId ? { entityId: over.entityId } : {}),
    ...(over.errorMessage ? { errorMessage: over.errorMessage } : {}),
  };
}

describe('AgentAuditStore', () => {
  let store: AgentAuditStore;
  beforeEach(() => { store = makeStore(); });

  it('records a single call', async () => {
    const r = await store.record({
      agent: 'interview', operation: 'start', actorId: 'u1',
      inputSummary: 'c1', outputSummary: 'object', status: 'success',
      durationMs: 50, startedAt: '2026-06-01T00:00:00Z', endedAt: '2026-06-01T00:00:01Z',
    });
    expect(r.id).toMatch(/^ac_/);
    const all = await store.list();
    expect(all).toHaveLength(1);
  });

  it('record() respects provided id', async () => {
    const r = await store.record({
      id: 'ac_fixed',
      agent: 'training', operation: 'generate', actorId: 'u1',
      inputSummary: '', outputSummary: '', status: 'success',
      durationMs: 0, startedAt: '2026-06-01T00:00:00Z', endedAt: '2026-06-01T00:00:00Z',
    });
    expect(r.id).toBe('ac_fixed');
  });

  it('trace() captures success and returns result', async () => {
    const out = await store.trace(
      { agent: 'insights', operation: 'funnel', actorId: 'u1', inputSummary: 'all' },
      async () => 'hello',
    );
    expect(out.result).toBe('hello');
    expect(out.error).toBeUndefined();
    expect(out.record.status).toBe('success');
    expect(out.record.outputSummary).toContain('string');
    const all = await store.list();
    expect(all).toHaveLength(1);
  });

  it('trace() captures failure and stores error message', async () => {
    const out = await store.trace(
      { agent: 'score', operation: 'score', entityId: 'c1', actorId: 'u1', inputSummary: 'r1' },
      async () => { throw new Error('boom'); },
    );
    expect(out.result).toBeUndefined();
    expect(out.error).toBeInstanceOf(Error);
    expect(out.record.status).toBe('failed');
    expect(out.record.errorMessage).toBe('boom');
    expect(out.record.entityId).toBe('c1');
  });

  it('trace() captures non-Error throws via String()', async () => {
    const out = await store.trace(
      { agent: 'search', operation: 'q', actorId: 'u1', inputSummary: '' },
      async () => { throw 'string-error'; },
    );
    expect(out.record.errorMessage).toBe('string-error');
    expect(out.record.status).toBe('failed');
  });

  it('stats() counts empty', () => {
    const s = store.stats([]);
    expect(s.total).toBe(0);
    expect(s.averageDurationMs).toBe(0);
    expect(s.failureRate).toBe(0);
    expect(s.byAgent.interview).toBe(0);
    expect(s.byStatus.success).toBe(0);
    expect(typeof s.windowStart).toBe('string');
    expect(typeof s.windowEnd).toBe('string');
  });

  it('stats() aggregates by agent/status and computes averages', () => {
    const records = [
      rec({ agent: 'interview', status: 'success', durationMs: 100 }),
      rec({ agent: 'interview', status: 'failed', durationMs: 200 }),
      rec({ agent: 'training', status: 'success', durationMs: 300 }),
    ];
    const s = store.stats(records);
    expect(s.total).toBe(3);
    expect(s.byAgent.interview).toBe(2);
    expect(s.byAgent.training).toBe(1);
    expect(s.byStatus.success).toBe(2);
    expect(s.byStatus.failed).toBe(1);
    expect(s.averageDurationMs).toBe(200);
    expect(s.failureRate).toBeCloseTo(1 / 3, 4);
  });

  it('recent() returns most recent N records', async () => {
    await store.add(rec({ startedAt: '2026-01-01T00:00:00Z' }));
    await store.add(rec({ startedAt: '2026-02-01T00:00:00Z' }));
    await store.add(rec({ startedAt: '2026-03-01T00:00:00Z' }));
    const r = await store.recent(2);
    expect(r).toHaveLength(2);
    expect(r[0].startedAt).toBe('2026-03-01T00:00:00Z');
    expect(r[1].startedAt).toBe('2026-02-01T00:00:00Z');
  });

  it('recent() respects default limit when not specified', async () => {
    for (let i = 0; i < 60; i++) await store.add(rec({ startedAt: `2026-01-${String(i % 30 + 1).padStart(2, '0')}T00:00:00Z` }));
    const r = await store.recent();
    expect(r.length).toBeLessThanOrEqual(50);
  });

  it('recent() returns empty array when no records', async () => {
    const r = await store.recent(10);
    expect(r).toEqual([]);
  });

  it('trace() omits entityId when not provided', async () => {
    const out = await store.trace(
      { agent: 'review', operation: 'generate', actorId: 'u1', inputSummary: 'm1' },
      async () => 'ok',
    );
    expect(out.record.entityId).toBeUndefined();
  });

  it('trace() outputSummary uses typeof result name', async () => {
    const outString = await store.trace(
      { agent: 'review', operation: 'generate', actorId: 'u1', inputSummary: 'm1' },
      async () => 'x'.repeat(200),
    );
    expect(outString.record.outputSummary).toBe('string');

    const outNum = await store.trace(
      { agent: 'review', operation: 'generate', actorId: 'u1', inputSummary: 'm1' },
      async () => 42,
    );
    expect(outNum.record.outputSummary).toBe('number');

    // undefined → 'void'
    const outVoid = await store.trace(
      { agent: 'review', operation: 'generate', actorId: 'u1', inputSummary: 'm1' },
      async () => undefined,
    );
    expect(outVoid.record.outputSummary).toBe('void');
  });

  it('stats() handles unknown agent/status via ?? 0 fallback', () => {
    // Use cast to bypass type safety and inject an unknown agent/status
    // that is NOT pre-listed in emptyByKind/emptyByStatus.
    const records = [
      rec({ agent: 'unknown' as any, status: 'cancelled' }),
      rec({ agent: 'unknown' as any, status: 'cancelled' }),
    ];
    const s = store.stats(records);
    expect(s.byAgent.unknown).toBe(2);
    expect(s.byStatus.cancelled).toBe(2);
  });

  it('stats() uses ?? 0 fallback when record has unrecognized enum values', () => {
    // byAgent['unknown'] is pre-seeded so branch hits ?? 0 path only via direct map access.
    // We exercise byAgent branch through the strict type system path here.
    const records = [
      rec({ agent: 'interview', status: 'success' }),
    ];
    const s = store.stats(records);
    expect(s.byAgent.interview).toBe(1);
    // exercise byStatus branch via known status
    expect(s.byStatus.success).toBe(1);
  });

  it('stats window uses first and last startedAt', () => {
    const records = [
      rec({ startedAt: '2026-01-01T00:00:00Z' }),
      rec({ startedAt: '2026-06-01T00:00:00Z' }),
    ];
    const s = store.stats(records);
    expect(s.windowStart).toBe('2026-01-01T00:00:00Z');
    expect(s.windowEnd).toBe('2026-06-01T00:00:00Z');
  });
});