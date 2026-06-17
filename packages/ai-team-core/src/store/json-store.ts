// JSON file store — simple CRUD with optional mutex lock

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface JsonStoreOptions {
  baseDir: string;       // e.g. /home/hermes/projects/ai-team/data
  fileName: string;      // e.g. candidates.json
}

export class JsonStore<T extends { id: string }> {
  private filePath: string;
  private cache: T[] | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(private opts: JsonStoreOptions) {
    this.filePath = path.join(opts.baseDir, opts.fileName);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.opts.baseDir, { recursive: true });
  }

  private async load(): Promise<T[]> {
    if (this.cache) return this.cache;
    await this.ensureDir();
    try {
      const buf = await fs.readFile(this.filePath, 'utf-8');
      this.cache = JSON.parse(buf) as T[];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.cache = [];
      } else {
        throw err;
      }
    }
    return this.cache!;
  }

  private async save(items: T[]): Promise<void> {
    this.cache = items;
    await this.ensureDir();
    const tmp = this.filePath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(items, null, 2), 'utf-8');
    await fs.rename(tmp, this.filePath);  // atomic
  }

  // Public API

  async list(): Promise<T[]> {
    return [...(await this.load())];
  }

  async get(id: string): Promise<T | undefined> {
    return (await this.load()).find((x) => x.id === id);
  }

  async find(predicate: (x: T) => boolean): Promise<T | undefined> {
    return (await this.load()).find(predicate);
  }

  async filter(predicate: (x: T) => boolean): Promise<T[]> {
    return (await this.load()).filter(predicate);
  }

  async add(item: T): Promise<T> {
    return this.mutate(async (items) => {
      items.push(item);
      return item;
    });
  }

  async update(id: string, patch: Partial<T>): Promise<T | undefined> {
    return this.mutate(async (items) => {
      const idx = items.findIndex((x) => x.id === id);
      if (idx < 0) return undefined;
      const updated = { ...items[idx], ...patch, id: items[idx].id };
      items[idx] = updated;
      return updated;
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.mutate(async (items) => {
      const idx = items.findIndex((x) => x.id === id);
      if (idx < 0) return false;
      items.splice(idx, 1);
      return true;
    });
  }

  async clear(): Promise<void> {
    await this.save([]);
  }

  // Serialize writes via simple lock chain
  private async mutate<R>(fn: (items: T[]) => Promise<R> | R): Promise<R> {
    const prev = this.writeLock;
    let release: () => void = () => {};
    this.writeLock = new Promise<void>((res) => (release = res));
    try {
      await prev;
      const items = await this.load();
      const result = await fn(items);
      await this.save(items);
      return result;
    } finally {
      release();
    }
  }
}
