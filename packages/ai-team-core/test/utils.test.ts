import { describe, it, expect } from 'vitest';
import { generateId, nowIso, todayDate } from '../src/utils/id.js';
import { formatDate, formatDateTime, daysSince } from '../src/utils/date.js';

describe('utils/id', () => {
  it('generateId creates IDs with prefix', () => {
    const id = generateId('ct');
    expect(id).toMatch(/^ct_\d{8}-[a-z0-9]{6}$/);
  });

  it('generateId uses different prefixes', () => {
    const a = generateId('mb');
    const b = generateId('rv');
    expect(a.startsWith('mb_')).toBe(true);
    expect(b.startsWith('rv_')).toBe(true);
  });

  it('generateId produces unique values', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId('x'));
    expect(ids.size).toBe(100);
  });

  it('nowIso returns valid ISO string', () => {
    const iso = nowIso();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it('todayDate returns YYYY-MM-DD', () => {
    const today = todayDate();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('utils/date', () => {
  it('formatDate strips time', () => {
    expect(formatDate('2026-06-19T10:30:00.000Z')).toBe('2026-06-19');
  });

  it('formatDate returns "-" for empty', () => {
    expect(formatDate()).toBe('-');
    expect(formatDate('')).toBe('-');
  });

  it('formatDateTime replaces T with space', () => {
    expect(formatDateTime('2026-06-19T10:30:00.000Z')).toBe('2026-06-19 10:30:00');
  });

  it('formatDateTime returns "-" for empty', () => {
    expect(formatDateTime()).toBe('-');
  });

  it('daysSince returns 0 for today', () => {
    expect(daysSince(nowIso())).toBe(0);
  });

  it('daysSince returns positive for past dates', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(past)).toBeGreaterThanOrEqual(4);
    expect(daysSince(past)).toBeLessThanOrEqual(5);
  });
});
