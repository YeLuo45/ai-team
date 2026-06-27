// V117: AppSseBootstrap — auto-attach default bridges + per-page subscriptions
// Bridges SSE topic → ResourceCache invalidation + EventBus publish

import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import {
  createSseBridge,
  detachBridge,
  listActiveBridges,
  type SseBridge,
} from '../../lib/data-layer/SSEBridge.js';
import { getEventBus } from '../../lib/data-layer/EventBus.js';
import { invalidateResource } from '../../lib/data-layer/hooks.js';

export const SSE_BRIDGE_NAMESPACE = 'ai-team-sse';

const DEFAULT_BRIDGE_ENDPOINTS = [
  { url: '/api/agent-audit/stream', namespace: 'agent-audit' },
  { url: '/api/team-stream', namespace: 'team' },
  { url: '/api/orchestration/stream', namespace: 'orchestration' },
];

const _attachedIds = new Set<string>();

export function attachDefaultBridges(): string[] {
  const ids: string[] = [];
  for (const ep of DEFAULT_BRIDGE_ENDPOINTS) {
    const bridge = createSseBridge({ url: ep.url });
    _attachedIds.add(bridge.id);
    ids.push(bridge.id);
  }
  return ids;
}

export function detachAllBridges(): void {
  for (const id of [..._attachedIds]) {
    detachBridge(id);
    _attachedIds.delete(id);
  }
}

export function listAttachedBridgeIds(): string[] {
  return [..._attachedIds];
}

const PAGE_TOPICS: Record<string, string[]> = {
  candidates: ['candidates.updated'],
  members: ['members.updated'],
  interviews: ['interviews.updated'],
  trainings: ['trainings.updated'],
  reviews: ['reviews.updated'],
  plugins: ['plugins.updated'],
  notifications: ['notifications.updated'],
  insights: ['insights.updated'],
  audit: ['audit.updated'],
  agents: ['agents.updated', 'agent-audit.updated'],
  'agent-config': ['agent-config.updated'],
  orchestration: ['orchestration.updated'],
  pipeline: ['pipeline.updated'],
  heatmap: ['heatmap.updated'],
  overview: ['team-stats.updated'],
  skills: ['members.updated'],
  data: ['audit.updated'],
};

const TOPIC_TO_RESOURCE: Record<string, string> = {
  'candidates.updated': 'candidates',
  'members.updated': 'members',
  'interviews.updated': 'interviews',
  'trainings.updated': 'trainings',
  'reviews.updated': 'reviews',
  'plugins.updated': 'plugins',
  'notifications.updated': 'notifications',
  'insights.updated': 'insights',
  'audit.updated': 'audit',
  'agents.updated': 'agents',
  'agent-audit.updated': 'agent-audit',
  'agent-config.updated': 'agent-config',
  'orchestration.updated': 'orchestration',
  'pipeline.updated': 'pipeline',
  'heatmap.updated': 'heatmap',
  'team-stats.updated': 'team-stats',
};

export function pageSseTopics(pageKey: string): string[] {
  return PAGE_TOPICS[pageKey] ?? [];
}

function getTopicResource(topic: string): string | null {
  return TOPIC_TO_RESOURCE[topic] ?? null;
}

// ---------- usePageSseSubscription ----------
export function usePageSseSubscription(pageKey: string): unknown {
  const topics = pageSseTopics(pageKey);
  if (topics.length === 0) return null;
  // Subscribe to the first topic for backward compat (return last event)
  const [last, setLast] = useState<unknown>(null);
  useEffect(() => {
    const bus = getEventBus();
    const unsubs = topics.map((t) =>
      bus.subscribe(t, (payload: unknown) => setLast(payload))
    );
    return () => {
      for (const u of unsubs) u();
    };
  }, [topics.join('|')]);
  return last;
}

// ---------- useSseBridgeStatus ----------
export interface SseStatus {
  connected: boolean;
  bridges: number;
  reconnected: number;
}

export function useSseBridgeStatus(): SseStatus {
  const [status, setStatus] = useState<SseStatus>(() => {
    const list = listActiveBridges();
    return { connected: list.length > 0, bridges: list.length, reconnected: 0 };
  });
  useEffect(() => {
    const update = () => {
      const list = listActiveBridges();
      setStatus({ connected: list.length > 0, bridges: list.length, reconnected: 0 });
    };
    update();
    const bus = getEventBus();
    const unsub = bus.subscribe('sse.bridge.status', update);
    return () => {
      unsub();
    };
  }, []);
  return status;
}

// ---------- AppSseBootstrap ----------
export function AppSseBootstrap({ children }: { children?: ReactNode }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const ids = attachDefaultBridges();
    // Notify status subscribers
    getEventBus().publish('sse.bridge.status', { bridges: ids.length });

    // Wire EventBus topic -> ResourceCache invalidation (defensive — SSEBridge already does this,
    // but we re-emit here for events that bypass the bridge, e.g. optimistic mutations)
    const bus = getEventBus();
    const unsub = bus.subscribe('sse.bridge.invalidate', (payload: unknown) => {
      const p = payload as { topic?: string };
      if (p?.topic) {
        const resourceKey = getTopicResource(p.topic);
        if (resourceKey) invalidateResource(resourceKey);
      }
    });

    // Periodic poll every 60s to surface status changes
    const interval = setInterval(() => {
      setTick((n) => n + 1);
    }, 60_000);

    return () => {
      clearInterval(interval);
      unsub();
      detachAllBridges();
    };
  }, []);

  // Also listen to all known topics so direct EventBus.publish from optimistic mutations
  // or SSE bridge dispatches triggers cache invalidation across all subscribers.
  useEffect(() => {
    const bus = getEventBus();
    const unsubs: Array<() => void> = [];
    for (const [topic, resourceKey] of Object.entries(TOPIC_TO_RESOURCE)) {
      unsubs.push(
        bus.subscribe(topic, () => invalidateResource(resourceKey))
      );
    }
    return () => {
      for (const u of unsubs) u();
    };
  }, []);

  return <>{children}</>;
}

// re-export SseBridge for convenience
export type { SseBridge };