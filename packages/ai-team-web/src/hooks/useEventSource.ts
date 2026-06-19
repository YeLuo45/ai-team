// useEventSource hook - subscribes to SSE stream

import { useEffect, useState, useCallback } from 'react';

export interface SSEEvent<T = any> {
  event: string;
  data: T;
  id?: string;
}

type Handler<T = any> = (event: SSEEvent<T>) => void;

export function useEventSource<T = any>(
  url: string,
  handler?: Handler<T>,
  options: { enabled?: boolean } = {}
): { connected: boolean; lastEvent: SSEEvent<T> | null } {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent<T> | null>(null);
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(url);
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        // Reconnect after 3s
        reconnectTimer = setTimeout(connect, 3000);
      };
      es.onmessage = (e) => {
        const event: SSEEvent<T> = { event: 'message', data: tryParse(e.data) };
        setLastEvent(event);
        handler?.(event);
      };
      // Also handle named events
      ['interview.completed', 'review.saved', 'candidate.created', 'training.created', 'connected'].forEach((name) => {
        es?.addEventListener(name, (e: MessageEvent) => {
          const event: SSEEvent<T> = { event: name, data: tryParse(e.data) };
          setLastEvent(event);
          handler?.(event);
        });
      });
    };

    connect();
    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      setConnected(false);
    };
  }, [url, enabled]);

  return { connected, lastEvent };
}

function tryParse(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}
