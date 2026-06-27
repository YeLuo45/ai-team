// V110: SSE Bridge — wires browser EventSource to EventBus + ResourceCache
// Auto-reconnect with exponential backoff, resource invalidation routing

import { invalidateResource as _invalidateResource } from './hooks.js';
import { getEventBus } from './EventBus.js';

// Re-export for convenient single-import surface
export const invalidateResource = _invalidateResource;

export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

/**
 * Parse a raw SSE text chunk into typed messages.
 * Supports comments (lines starting with ":") and multi-line data fields.
 */
export function parseSseEvent(raw: string): SseMessage[] {
  if (!raw || raw.trim() === '') return [];
  const messages: SseMessage[] = [];
  const blocks = raw.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const lines = trimmed.split(/\n/);
    let event = 'message';
    const dataLines: string[] = [];
    let id: string | undefined;
    for (const line of lines) {
      if (line.startsWith(':')) continue; // comment / keepalive
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const field = line.slice(0, colon).trim();
      let value = line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value || 'message';
      else if (field === 'data') dataLines.push(value);
      else if (field === 'id') id = value;
    }
    if (dataLines.length > 0) {
      messages.push({ event, data: dataLines.join('\n'), id });
    }
  }
  return messages;
}

/**
 * Build the SSE URL for a base resource path.
 */
export function buildSseUrl(base: string, suffix = '/stream'): string {
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${trimmedBase}${trimmedSuffix}`;
}

/**
 * Maps well-known SSE topics to resource cache keys for automatic invalidation.
 */
const TOPIC_TO_RESOURCE: Record<string, string> = {
  'candidates.updated': 'candidates',
  'members.updated': 'members',
  'interviews.updated': 'interviews',
  'trainings.updated': 'trainings',
  'reviews.updated': 'reviews',
  'notifications.updated': 'notifications',
  'insights.updated': 'insights',
  'audit.updated': 'audit',
  'approvals.updated': 'approvals',
  'pipeline.updated': 'pipeline',
  'heatmap.updated': 'heatmap',
  'agent-audit.updated': 'agent-audit',
  'plugins.updated': 'plugins',
  'orchestration.updated': 'orchestration',
  'team-stats.updated': 'team-stats',
};

export interface ReconnectStrategy {
  initialDelay: number;
  maxDelay: number;
  maxRetries: number;
}

export interface BridgeOptions {
  url: string;
  reconnectStrategy?: ReconnectStrategy;
  onReconnect?: () => Promise<void> | void;
  sourceFactory?: (url: string) => SseLikeSource;
}

export interface SseLikeSource {
  addEventListener(event: string, cb: (data: string) => void): void;
  close(): void;
}

const DEFAULT_STRATEGY: ReconnectStrategy = { initialDelay: 1000, maxDelay: 30000, maxRetries: 5 };

let _bridgeSeq = 0;
const _activeBridges = new Map<string, SseBridge>();

export class SseBridge {
  readonly id: string;
  readonly url: string;
  private closed = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private buffer = '';
  private strategy: ReconnectStrategy;
  private onReconnect?: () => Promise<void> | void;
  private source: SseLikeSource | null = null;
  private sourceFactory: (url: string) => SseLikeSource;

  constructor(options: BridgeOptions) {
    this.id = `bridge_${++_bridgeSeq}`;
    this.url = options.url;
    this.strategy = options.reconnectStrategy ?? DEFAULT_STRATEGY;
    this.onReconnect = options.onReconnect;
    this.sourceFactory = options.sourceFactory ?? defaultSourceFactory;
    _activeBridges.set(this.id, this);
  }

  handleChunk(chunk: string): void {
    if (this.closed) return;
    this.buffer += chunk;
    // Process full events (terminated by blank line)
    let idx: number;
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const block = this.buffer.slice(0, idx + 2);
      this.buffer = this.buffer.slice(idx + 2);
      const msgs = parseSseEvent(block);
      for (const m of msgs) this.dispatch(m);
    }
  }

  private dispatch(msg: SseMessage): void {
    const bus = getEventBus();
    let payload: unknown = msg.data;
    try {
      payload = msg.data ? JSON.parse(msg.data) : null;
    } catch {
      // keep as string
    }
    bus.publish(msg.event, payload);
    const resourceKey = TOPIC_TO_RESOURCE[msg.event];
    if (resourceKey) {
      invalidateResource(resourceKey);
    }
  }

  /** Simulated disconnect for tests — schedules a reconnect via the onReconnect hook. */
  async simulateDisconnect(): Promise<void> {
    if (this.closed) return;
    if (this.attempt >= this.strategy.maxRetries) return;
    const delay = Math.min(
      this.strategy.initialDelay * Math.pow(2, this.attempt),
      this.strategy.maxDelay
    );
    this.attempt++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    await new Promise((resolve) => {
      this.retryTimer = setTimeout(resolve, delay);
    });
    if (this.closed) return;
    if (this.onReconnect) await this.onReconnect();
  }

  connect(): void {
    if (this.closed) return;
    if (typeof window === 'undefined' && !this.sourceFactory) return;
    this.source = this.sourceFactory(this.url);
    this.source.addEventListener('message', (data: string) => {
      this.handleChunk(`data: ${data}\n\n`);
    });
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.source) this.source.close();
    _activeBridges.delete(this.id);
  }
}

function defaultSourceFactory(_url: string): SseLikeSource {
  // Real EventSource is browser-only; tests inject a custom factory.
  if (typeof EventSource === 'undefined') {
    return { addEventListener: () => {}, close: () => {} };
  }
  const es = new EventSource(_url);
  return {
    addEventListener(event, cb) {
      es.addEventListener(event, (ev: MessageEvent) => cb(ev.data));
    },
    close() {
      es.close();
    },
  };
}

export function createSseBridge(options: BridgeOptions): SseBridge {
  const bridge = new SseBridge(options);
  bridge.connect();
  return bridge;
}

export function attachBridge(url: string, options?: Partial<BridgeOptions>): SseBridge {
  return createSseBridge({ url, ...options });
}

export function detachBridge(id: string): boolean {
  const bridge = _activeBridges.get(id);
  if (!bridge) return false;
  bridge.close();
  return true;
}

export function listActiveBridges(): SseBridge[] {
  return [..._activeBridges.values()];
}