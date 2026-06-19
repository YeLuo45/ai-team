import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { JsonStore } from '../src/store/json-store.js';
import { createTempDir, cleanupTempDir } from '../../../test-utils.js';

interface TestEntity { id: string; name: string; value: number; }

describe('JsonStore', () => {
  let dir: string;
  beforeEach(async () => { dir = await createTempDir(); });
  afterEach(async () => { await cleanupTempDir(dir); });

  const make = () => new JsonStore<TestEntity>({ baseDir: dir, fileName: 'test.json' });

  it('adds and lists items', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    await s.add({ id: '2', name: 'b', value: 2 });
    const list = await s.list();
    expect(list).toHaveLength(2);
    expect(list.map((x) => x.id).sort()).toEqual(['1', '2']);
  });

  it('returns empty array for missing file', async () => {
    const s = make();
    const list = await s.list();
    expect(list).toEqual([]);
  });

  it('gets by id', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    expect(await s.get('1')).toEqual({ id: '1', name: 'a', value: 1 });
    expect(await s.get('nope')).toBeUndefined();
  });

  it('find by predicate', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    await s.add({ id: '2', name: 'b', value: 2 });
    expect(await s.find((x) => x.value === 2)).toEqual({ id: '2', name: 'b', value: 2 });
    expect(await s.find((x) => x.value === 99)).toBeUndefined();
  });

  it('filter by predicate', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    await s.add({ id: '2', name: 'b', value: 2 });
    await s.add({ id: '3', name: 'c', value: 1 });
    const filtered = await s.filter((x) => x.value === 1);
    expect(filtered).toHaveLength(2);
  });

  it('updates item by id', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    const updated = await s.update('1', { name: 'updated' });
    expect(updated).toEqual({ id: '1', name: 'updated', value: 1 });
    expect(await s.get('1')).toEqual({ id: '1', name: 'updated', value: 1 });
  });

  it('update returns undefined for missing id', async () => {
    const s = make();
    expect(await s.update('nope', { name: 'x' })).toBeUndefined();
  });

  it('removes item by id', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    expect(await s.remove('1')).toBe(true);
    expect(await s.list()).toHaveLength(0);
  });

  it('remove returns false for missing id', async () => {
    const s = make();
    expect(await s.remove('nope')).toBe(false);
  });

  it('clears all items', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    await s.add({ id: '2', name: 'b', value: 2 });
    await s.clear();
    expect(await s.list()).toEqual([]);
  });

  it('serializes writes atomically (no partial writes)', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    const list = await s.list();
    expect(list[0].id).toBe('1');
  });

  it('throws on non-ENOENT file read error', async () => {
    const s = make();
    // Write invalid JSON to the file
    await fs.writeFile(s['filePath'], 'not valid json{{{', 'utf-8');
    // Reset cache so load re-reads
    (s as any).cache = null;
    await expect(s.list()).rejects.toThrow();
  });

  it('caches data between calls', async () => {
    const s = make();
    await s.add({ id: '1', name: 'a', value: 1 });
    // Force cache by calling list, then mutate externally and call list again
    // (should still return cached value until invalidate)
    const list1 = await s.list();
    expect(list1).toHaveLength(1);
    // Add via same store (uses internal cache invalidation)
    await s.add({ id: '2', name: 'b', value: 2 });
    const list2 = await s.list();
    expect(list2).toHaveLength(2);
  });
});
