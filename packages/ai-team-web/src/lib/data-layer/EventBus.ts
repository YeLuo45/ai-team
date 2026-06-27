// V109: EventBus — typed pub/sub for SSE bridges and optimistic broadcasts

export type BusListener<T = unknown> = (payload: T) => void;

interface TopicStats {
  published: number;
  delivered: number;
}

export class EventBus {
  private listeners = new Map<string, Set<BusListener>>();
  private onceListeners = new Map<string, Set<BusListener>>();
  private stats = new Map<string, TopicStats>();

  subscribe<T = unknown>(topic: string, listener: BusListener<T>): () => void {
    let set = this.listeners.get(topic);
    if (!set) {
      set = new Set();
      this.listeners.set(topic, set);
    }
    set.add(listener as BusListener);
    return () => {
      set?.delete(listener as BusListener);
    };
  }

  once<T = unknown>(topic: string, listener: BusListener<T>): () => void {
    let set = this.onceListeners.get(topic);
    if (!set) {
      set = new Set();
      this.onceListeners.set(topic, set);
    }
    set.add(listener as BusListener);
    return () => {
      set?.delete(listener as BusListener);
    };
  }

  publish<T = unknown>(topic: string, payload: T): void {
    const cur = this.stats.get(topic) ?? { published: 0, delivered: 0 };
    cur.published += 1;
    this.stats.set(topic, cur);

    const main = this.listeners.get(topic);
    if (main) {
      for (const l of main) {
        try {
          (l as BusListener<T>)(payload);
        } catch {
          /* swallow listener errors */
        }
      }
      const after = this.stats.get(topic)!;
      after.delivered += main.size;
      this.stats.set(topic, after);
    }

    const once = this.onceListeners.get(topic);
    if (once) {
      for (const l of once) {
        try {
          (l as BusListener<T>)(payload);
        } catch {
          /* swallow */
        }
      }
      this.onceListeners.delete(topic);
    }
  }

  topicStats(): Record<string, TopicStats> {
    const result: Record<string, TopicStats> = {};
    for (const [k, v] of this.stats) result[k] = { ...v };
    return result;
  }

  reset(): void {
    this.listeners.clear();
    this.onceListeners.clear();
    this.stats.clear();
  }
}

let _busSingleton: EventBus | null = null;
export function getEventBus(): EventBus {
  if (!_busSingleton) _busSingleton = new EventBus();
  return _busSingleton;
}
export function resetEventBus(): void {
  if (_busSingleton) _busSingleton.reset();
  _busSingleton = null;
}