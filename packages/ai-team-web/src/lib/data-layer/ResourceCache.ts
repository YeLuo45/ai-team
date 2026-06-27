// V109: ResourceCache — shared data cache with staleTime + subscribe semantics

export interface ResourceEntry<T> {
  value: T;
  ts: number;
  status: 'ready' | 'fetching' | 'error';
  error?: unknown;
}

export interface ResourceOptions {
  staleTime?: number;
}

export type ResourceListener = () => void;

export class ResourceCache<T = unknown> {
  private map = new Map<string, ResourceEntry<T>>();
  private listeners = new Set<ResourceListener>();
  private options: Map<string, ResourceOptions> = new Map();

  set(key: string, value: T, ts: number, opts?: ResourceOptions): void {
    this.map.set(key, { value, ts, status: 'ready' });
    if (opts) this.options.set(key, opts);
    this.emit();
  }

  get(key: string): T | undefined {
    return this.map.get(key)?.value;
  }

  entry(key: string): ResourceEntry<T> | undefined {
    return this.map.get(key);
  }

  update(key: string, valueOrUpdater: T | ((prev: T | undefined) => T | undefined)): void {
    const cur = this.map.get(key);
    const next = typeof valueOrUpdater === 'function'
      ? (valueOrUpdater as (prev: T | undefined) => T | undefined)(cur?.value)
      : valueOrUpdater;
    if (next === undefined) return;
    this.map.set(key, { value: next, ts: Date.now(), status: 'ready' });
    this.emit();
  }

  isStale(key: string, now: number = Date.now()): boolean {
    const e = this.map.get(key);
    if (!e) return true;
    const opts = this.options.get(key);
    const staleTime = opts?.staleTime ?? 30_000;
    return now - e.ts >= staleTime;
  }

  invalidate(key: string): void {
    const e = this.map.get(key);
    if (!e) return;
    this.map.set(key, { ...e, ts: 0 });
    this.emit();
  }

  delete(key: string): void {
    this.map.delete(key);
    this.options.delete(key);
    this.emit();
  }

  setError(key: string, err: unknown): void {
    const cur = this.map.get(key);
    const next: ResourceEntry<T> = {
      value: cur?.value as T,
      ts: cur?.ts ?? Date.now(),
      status: 'error',
      error: err,
    };
    this.map.set(key, next);
    this.emit();
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  subscribe(listener: ResourceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

let _singleton: ResourceCache | null = null;
export function getResourceCache(): ResourceCache {
  if (!_singleton) _singleton = new ResourceCache();
  return _singleton;
}
export function resetResourceCache(): void {
  _singleton = null;
}