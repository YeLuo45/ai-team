// V193 cross-session reuse helpers tests.

import { describe, it, expect } from 'vitest';
import {
  groupByQuestionId,
  reuseScore,
  findReuseCandidates,
  deriveScore,
  type HistoryLikeEntry,
} from '../src/lib/question-suggestion/reuse';

const NOW = new Date('2026-07-12T10:00:00.000Z').getTime();
const DAY = 86_400_000;

describe('groupByQuestionId', () => {
  it('rolls up multiple adoptions into one entry per questionId', () => {
    const entries: HistoryLikeEntry[] = [
      { questionId: 'a', question: 'Q-A', adoptedAtMs: NOW - 3 * DAY },
      { questionId: 'a', question: 'Q-A', adoptedAtMs: NOW - 1 * DAY },
      { questionId: 'b', question: 'Q-B', adoptedAtMs: NOW - 2 * DAY },
    ];
    const out = groupByQuestionId(entries);
    expect(out.size).toBe(2);
    const a = out.get('a');
    expect(a?.adoptionCount).toBe(2);
    expect(a?.firstAdoptedMs).toBe(NOW - 3 * DAY);
    expect(a?.lastAdoptedMs).toBe(NOW - 1 * DAY);
    const b = out.get('b');
    expect(b?.adoptionCount).toBe(1);
  });
});

describe('reuseScore', () => {
  const baseEntry = {
    questionId: 'a',
    question: 'Q-A',
    firstAdoptedMs: NOW - 5 * DAY,
    lastAdoptedMs: NOW - 1 * DAY,
    adoptionCount: 2,
    focusTag: 'technical',
  };

  it('scores higher for same focus tag', () => {
    const same = reuseScore(baseEntry, { nowMs: NOW, focusTag: 'technical' });
    const other = reuseScore(baseEntry, { nowMs: NOW, focusTag: 'communication' });
    expect(same).toBeGreaterThan(other);
  });

  it('scores higher for more recent entries', () => {
    const recent = { ...baseEntry, lastAdoptedMs: NOW - 100 };
    const older = { ...baseEntry, lastAdoptedMs: NOW - 30 * DAY };
    expect(
      reuseScore(recent, { nowMs: NOW, focusTag: 'technical' }),
    ).toBeGreaterThan(reuseScore(older, { nowMs: NOW, focusTag: 'technical' }));
  });

  it('scores higher for more adoptions (clamped)', () => {
    const one = { ...baseEntry, adoptionCount: 1 };
    const ten = { ...baseEntry, adoptionCount: 10 };
    expect(
      reuseScore(ten, { nowMs: NOW, focusTag: 'technical' }),
    ).toBeGreaterThan(reuseScore(one, { nowMs: NOW, focusTag: 'technical' }));
  });
});

describe('findReuseCandidates', () => {
  const history: HistoryLikeEntry[] = [
    { questionId: 'a', question: 'Q-A', adoptedAtMs: NOW - 1 * DAY, focusTag: 'technical' },
    { questionId: 'a', question: 'Q-A', adoptedAtMs: NOW - 2 * DAY, focusTag: 'technical' },
    { questionId: 'b', question: 'Q-B', adoptedAtMs: NOW - 30 * DAY, focusTag: 'communication' },
    { questionId: 'c', question: 'Q-C', adoptedAtMs: NOW - 60 * DAY, focusTag: 'technical' },
  ];

  it('returns at most `limit` candidates sorted desc', () => {
    const out = findReuseCandidates(history, { nowMs: NOW, limit: 2 });
    expect(out.length).toBe(2);
    expect(out[0]!.score).toBeGreaterThanOrEqual(out[1]!.score ?? -Infinity);
  });

  it('honours minAdoptions', () => {
    const out = findReuseCandidates(history, { nowMs: NOW, minAdoptions: 3 });
    expect(out.length).toBe(0);
  });

  it('filters by focusTag when requested', () => {
    const out = findReuseCandidates(history, { nowMs: NOW, focusTag: 'communication' });
    expect(out.length).toBe(1);
    expect(out[0]!.focusTag).toBe('communication');
  });

  it('rolls up adoptionCount when ranking', () => {
    const out = findReuseCandidates(history, { nowMs: NOW, focusTag: 'technical' });
    const a = out.find((c) => c.questionId === 'a');
    const c = out.find((c) => c.questionId === 'c');
    expect(a?.adoptionCount).toBe(2);
    expect(c?.adoptionCount).toBe(1);
    expect(a?.score).toBeGreaterThan(c?.score ?? -Infinity);
  });
});

describe('deriveScore (preview helper)', () => {
  it('rises with adoption count', () => {
    expect(deriveScore({ adoptionCount: 1, ageDays: 5 })).toBeLessThan(
      deriveScore({ adoptionCount: 5, ageDays: 5 }),
    );
  });
  it('falls as age grows', () => {
    expect(deriveScore({ adoptionCount: 1, ageDays: 1 })).toBeGreaterThan(
      deriveScore({ adoptionCount: 1, ageDays: 100 }),
    );
  });
  it('penalises tag mismatch when explicitly false', () => {
    expect(deriveScore({ adoptionCount: 1, ageDays: 1, tagMatches: true })).toBeGreaterThan(
      deriveScore({ adoptionCount: 1, ageDays: 1, tagMatches: false }),
    );
  });
});
