// SSE manager tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SSEManager } from '../src/sse.js';import { Writable } from 'node:stream';

class MockResponse extends Writable {
  headers: Record<string, string> = {};
  chunks: string[] = [];

  setHeader(name: string, value: string) {
    this.headers[name] = value;
    return this;
  }

  flushHeaders() {}

  _write(chunk: Buffer, _enc: string, cb: () => void) {
    this.chunks.push(chunk.toString());
    cb();
  }

  getWrittenData(): string {
    return this.chunks.join('');
  }
}

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    manager = new SSEManager();
  });

  afterEach(() => {
    // Clean up
    manager['clients'].clear();
  });

  it('adds client and sends connected event', () => {
    const res = new MockResponse();
    const id = manager.addClient(res as any);
    expect(id).toBeTruthy();
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(manager.size()).toBe(1);
    expect(res.getWrittenData()).toContain('event: connected');
  });

  it('removes client', () => {
    const res = new MockResponse();
    const id = manager.addClient(res as any);
    manager.removeClient(id);
    expect(manager.size()).toBe(0);
  });

  it('broadcasts event to all clients', () => {
    const res1 = new MockResponse();
    const res2 = new MockResponse();
    manager.addClient(res1 as any);
    manager.addClient(res2 as any);
    manager.broadcast('test.event', { foo: 'bar' });
    expect(res1.getWrittenData()).toContain('event: test.event');
    expect(res1.getWrittenData()).toContain('"foo":"bar"');
    expect(res2.getWrittenData()).toContain('event: test.event');
  });

  it('removes client on broadcast error', () => {
    // Create a res where write throws only AFTER initial setup
    let callCount = 0;
    const badRes = {
      headers: {},
      setHeader(name: string, value: string) { this.headers[name] = value; return this; },
      flushHeaders() {},
      write: () => {
        callCount++;
        if (callCount > 1) throw new Error('disconnected');
        return true;
      },
    } as any;
    const id = manager.addClient(badRes);
    expect(manager.size()).toBe(1);
    manager.broadcast('test', {});
    expect(manager.size()).toBe(0);
    expect(manager.get(id)).toBeUndefined();
  });

  it('get returns client config', () => {
    const res = new MockResponse();
    const id = manager.addClient(res as any);
    const c = manager.get(id);
    expect(c?.id).toBe(id);
  });

  it('handles empty broadcast', () => {
    manager.broadcast('test', {});
    // Should not throw
    expect(manager.size()).toBe(0);
  });

  it('increments client id', () => {
    const res1 = new MockResponse();
    const res2 = new MockResponse();
    const id1 = manager.addClient(res1 as any);
    const id2 = manager.addClient(res2 as any);
    expect(id1).not.toBe(id2);
  });
});
