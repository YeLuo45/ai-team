// V27: Agent audit SSE stream + wrap helper tests
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { Response, Request } from 'express';
import { AgentAuditStore, type AgentCallRecord } from '@ai-team/core';
import { SSEManager } from '../src/sse.js';
import { createAuditStreamHandler, wrapAuditStoreWithBroadcast } from '../src/routes/agent-audit-stream.js';

function makeStore(): AgentAuditStore {
  const dir = mkdtempSync(join(tmpdir(), 'audit-stream-'));
  return AgentAuditStore.create(dir);
}

function fakeRes(): Response & { _writes: string[]; _closed: boolean } {
  const writes: string[] = [];
  const res: any = {
    _writes: writes,
    _closed: false,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => { writes.push(chunk); return true; }),
    on: vi.fn(),
    end: vi.fn(() => { (res as any)._closed = true; }),
  };
  return res as any;
}

function fakeReq(): Request {
  const req: any = new EventEmitter();
  return req as Request;
}

describe('wrapAuditStoreWithBroadcast', () => {
  it('broadcasts SSE event on record()', async () => {
    const store = makeStore();
    const sse = new SSEManager();
    const fake = fakeRes();
    sse.addClient(fake);
    wrapAuditStoreWithBroadcast({ auditStore: store, sseManager: sse });

    await store.record({
      agent: 'interview', operation: 'start', actorId: 'u1',
      inputSummary: 'c1', outputSummary: '', status: 'success',
      durationMs: 100, startedAt: '2026-06-01T00:00:00Z', endedAt: '2026-06-01T00:00:01Z',
    });
    expect(fake._writes.some((w) => w.includes('event: agent.audit'))).toBe(true);
  });

  it('broadcasts SSE event on trace() success', async () => {
    const store = makeStore();
    const sse = new SSEManager();
    const fake = fakeRes();
    sse.addClient(fake);
    wrapAuditStoreWithBroadcast({ auditStore: store, sseManager: sse });

    await store.trace(
      { agent: 'score', operation: 'score', actorId: 'u1', inputSummary: 'r1' },
      async () => 'ok',
    );
    expect(fake._writes.some((w) => w.includes('event: agent.audit'))).toBe(true);
  });

  it('broadcasts on trace() failure too', async () => {
    const store = makeStore();
    const sse = new SSEManager();
    const fake = fakeRes();
    sse.addClient(fake);
    wrapAuditStoreWithBroadcast({ auditStore: store, sseManager: sse });

    await store.trace(
      { agent: 'review', operation: 'gen', actorId: 'u1', inputSummary: 'm1' },
      async () => { throw new Error('boom'); },
    );
    expect(fake._writes.some((w) => w.includes('event: agent.audit'))).toBe(true);
  });

  it('continues working when broadcast fails (no clients)', async () => {
    const store = makeStore();
    const sse = new SSEManager();
    wrapAuditStoreWithBroadcast({ auditStore: store, sseManager: sse });
    // No clients connected — broadcast should silently do nothing
    await store.record({
      agent: 'interview', operation: 'start', actorId: 'u1',
      inputSummary: 'c1', outputSummary: '', status: 'success',
      durationMs: 100, startedAt: '2026-06-01T00:00:00Z', endedAt: '2026-06-01T00:00:01Z',
    });
    expect((await store.list()).length).toBe(1);
  });
});

describe('createAuditStreamHandler', () => {
  it('sends history events then registers client', async () => {
    const store = makeStore();
    await store.record({
      agent: 'interview', operation: 'start', actorId: 'u1',
      inputSummary: 'c1', outputSummary: '', status: 'success',
      durationMs: 100, startedAt: '2026-06-01T00:00:00Z', endedAt: '2026-06-01T00:00:01Z',
    });
    await store.record({
      agent: 'training', operation: 'gen', actorId: 'u2',
      inputSummary: 'm1', outputSummary: '', status: 'failed',
      durationMs: 50, startedAt: '2026-06-02T00:00:00Z', endedAt: '2026-06-02T00:00:01Z',
    });
    const sse = new SSEManager();
    const handler = createAuditStreamHandler({ auditStore: store, sseManager: sse });
    const req = fakeReq();
    const res = fakeRes();
    await handler(req as Request, res as Response);
    // initial connected + 2 history events = 3 writes
    expect(res._writes.length).toBeGreaterThanOrEqual(3);
    expect(res._writes.some((w) => w.includes('event: connected'))).toBe(true);
    expect(res._writes.some((w) => w.includes('event: agent.audit.history'))).toBe(true);
    // verify history records are sorted desc by startedAt
    const historyWrites = res._writes.filter((w) => w.includes('agent.audit.history'));
    expect(historyWrites.length).toBe(2);
  });

  it('removes client on req close event', async () => {
    const store = makeStore();
    const sse = new SSEManager();
    const handler = createAuditStreamHandler({ auditStore: store, sseManager: sse });
    const req = fakeReq();
    const res = fakeRes();
    await handler(req as Request, res as Response);
    expect(sse.size()).toBe(1);
    req.emit('close');
    expect(sse.size()).toBe(0);
  });

  it('handles empty history gracefully', async () => {
    const store = makeStore();
    const sse = new SSEManager();
    const handler = createAuditStreamHandler({ auditStore: store, sseManager: sse });
    const req = fakeReq();
    const res = fakeRes();
    await handler(req as Request, res as Response);
    expect(res._writes.some((w) => w.includes('event: connected'))).toBe(true);
    // No history writes
    const historyWrites = res._writes.filter((w) => w.includes('agent.audit.history'));
    expect(historyWrites.length).toBe(0);
  });
});