// V109: useResource + useResourceMutation + invalidation/prefetch hooks
// Lightweight data layer mirroring react-query semantics without the dep

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getResourceCache, type ResourceOptions } from './ResourceCache.js';
import { getEventBus } from './EventBus.js';

export type Fetcher<T> = () => Promise<T>;

export interface UseResourceResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
}

export function useResource<T>(
  key: string,
  fetcher: Fetcher<T>,
  options?: ResourceOptions & { enabled?: boolean }
): UseResourceResult<T> {
  const cache = getResourceCache();
  const enabled = options?.enabled ?? true;
  const [, setTick] = useState(0);
  const fetchedRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const subscribe = useCallback((cb: () => void) => cache.subscribe(cb), [cache]);
  const getSnapshot = useCallback(() => {
    const e = cache.entry(key);
    return e ? JSON.stringify({ ts: e.ts, status: e.status, value: e.value }) : 'missing';
  }, [cache, key]);
  const serverSig = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const fetchOnce = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await fetcherRef.current();
      cache.set(key, data as unknown, Date.now(), options);
      fetchedRef.current = true;
    } catch (err) {
      cache.setError(key, err);
    }
  }, [cache, enabled, key, options]);

  const inFlight = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const entry = cache.entry(key);
    if (!entry) {
      if (!inFlight.current) {
        inFlight.current = fetchOnce().finally(() => { inFlight.current = null; });
      }
    }
    fetchedRef.current = !!entry;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, enabled, key, serverSig]);

  const refetch = useCallback(async () => {
    cache.invalidate(key);
    setTick((n) => n + 1);
    inFlight.current = fetchOnce().finally(() => { inFlight.current = null; });
    await inFlight.current;
  }, [cache, fetchOnce, key]);

  const entry = cache.entry(key);
  return {
    data: entry?.value as T | undefined,
    loading: !entry && enabled,
    error: entry?.error ? (entry.error as Error) : null,
    refetch,
    isStale: cache.isStale(key),
  };
}

export type OptimisticUpdater<TIn, TCached> = (input: TIn) => (prev: TCached | undefined) => TCached | undefined;

export interface UseResourceMutationOptions<TIn, TCached> {
  resourceKey: string;
  optimistic?: OptimisticUpdater<TIn, TCached>;
  mutate: (input: TIn) => Promise<unknown>;
  onError?: (err: Error, input: TIn) => void;
  onSuccess?: (input: TIn, serverResult: unknown) => void;
}

export interface UseResourceMutationResult<TIn> {
  mutate: (input: TIn) => Promise<unknown>;
  loading: boolean;
}

export function useResourceMutation<TIn, TCached = unknown>(
  options: UseResourceMutationOptions<TIn, TCached>
): UseResourceMutationResult<TIn> {
  const cache = getResourceCache();
  const [loading, setLoading] = useState(false);
  const bus = getEventBus();

  const mutate = useCallback(
    async (input: TIn) => {
      setLoading(true);
      const prev = cache.get(options.resourceKey) as TCached | undefined;
      if (options.optimistic) {
        cache.update(options.resourceKey, options.optimistic(input));
      }
      try {
        const result = await options.mutate(input);
        options.onSuccess?.(input, result);
        bus.publish(`${options.resourceKey}.updated`, { input, result });
        return result;
      } catch (err) {
        if (prev !== undefined) {
          cache.set(options.resourceKey, prev, Date.now());
        }
        const e = err instanceof Error ? err : new Error(String(err));
        options.onError?.(e, input);
        bus.publish(`${options.resourceKey}.error`, { input, error: e });
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [bus, cache, options]
  );

  return { mutate, loading };
}

export function invalidateResource(key: string): void {
  getResourceCache().invalidate(key);
}

export async function prefetchResource<T>(
  key: string,
  fetcher: Fetcher<T>,
  options?: ResourceOptions
): Promise<void> {
  const cache = getResourceCache();
  try {
    const data = await fetcher();
    cache.set(key, data as unknown, Date.now(), options);
  } catch {
    /* ignore prefetch failure */
  }
}

export function useBusTopic<T = unknown>(topic: string): T | null {
  const bus = getEventBus();
  const [last, setLast] = useState<T | null>(null);
  useEffect(() => {
    const unsub = bus.subscribe<T>(topic, (payload) => setLast(payload));
    return () => {
      unsub();
    };
  }, [bus, topic]);
  return last;
}

export { ResourceCache, getResourceCache, resetResourceCache, type ResourceEntry, type ResourceOptions } from './ResourceCache.js';
export { EventBus, getEventBus, resetEventBus } from './EventBus.js';
export * from './SSEBridge.js';
export * from './resources.js';