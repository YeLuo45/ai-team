// V21: PipelineStore tests — advance / currentEntry / funnelReport
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PipelineStore } from '../src/store/pipeline-store.js';
import type { PipelineEntry } from '../src/types/pipeline.js';

function makeStore(): PipelineStore {
  const dir = mkdtempSync(join(tmpdir(), 'pipeline-test-'));
  return PipelineStore.create(dir);
}

function entry(over: Partial<PipelineEntry> & { candidateId: string; stage: PipelineEntry['stage']; createdAt?: string }): PipelineEntry {
  return {
    id: over.id ?? `pl_${Math.random().toString(36).slice(2)}`,
    candidateId: over.candidateId,
    stage: over.stage,
    previousStage: over.previousStage ?? null,
    actorId: over.actorId ?? 'system',
    createdAt: over.createdAt ?? new Date().toISOString(),
    ...(over.note ? { note: over.note } : {}),
    ...(over.linkedInterviewId ? { linkedInterviewId: over.linkedInterviewId } : {}),
    ...(over.linkedReviewId ? { linkedReviewId: over.linkedReviewId } : {}),
  };
}

describe('PipelineStore', () => {
  let store: PipelineStore;
  beforeEach(() => { store = makeStore(); });

  it('starts with empty list and zero funnel', async () => {
    const all = await store.list();
    expect(all).toHaveLength(0);
    const report = store.funnelReport(all);
    expect(report.total).toBe(0);
    expect(report.byStage.sourced).toBe(0);
    expect(report.averageDwellDays).toBe(0);
    expect(report.overallConversion).toBe(0);
  });

  it('advance() creates a sourced entry when candidate has none', async () => {
    const e = await store.advance({ candidateId: 'c1', toStage: 'sourced', actorId: 'u1' });
    expect(e.previousStage).toBeNull();
    expect(e.stage).toBe('sourced');
    const all = await store.list();
    expect(all).toHaveLength(1);
  });

  it('advance() does not duplicate when same stage', async () => {
    await store.advance({ candidateId: 'c1', toStage: 'screening', actorId: 'u1' });
    const before = (await store.list()).length;
    await store.advance({ candidateId: 'c1', toStage: 'screening', actorId: 'u1' });
    const after = (await store.list()).length;
    expect(after).toBe(before);
  });

  it('advance() records previousStage', async () => {
    await store.advance({ candidateId: 'c1', toStage: 'sourced', actorId: 'u1' });
    const e = await store.advance({ candidateId: 'c1', toStage: 'screening', actorId: 'u1', note: 'OK' });
    expect(e.previousStage).toBe('sourced');
    expect(e.note).toBe('OK');
  });

  it('currentEntry returns latest by createdAt', async () => {
    await store.add(entry({ candidateId: 'c1', stage: 'sourced', createdAt: '2026-01-01T00:00:00Z' }));
    await store.add(entry({ candidateId: 'c1', stage: 'screening', createdAt: '2026-01-05T00:00:00Z' }));
    await store.add(entry({ candidateId: 'c1', stage: 'interview', createdAt: '2026-01-10T00:00:00Z' }));
    const all = await store.list();
    const cur = store.currentEntry(all, 'c1');
    expect(cur?.stage).toBe('interview');
  });

  it('currentEntry returns null for unknown candidate', async () => {
    const cur = store.currentEntry([], 'c-unknown');
    expect(cur).toBeNull();
  });

  it('funnelReport counts each candidate by current stage', async () => {
    await store.add(entry({ candidateId: 'c1', stage: 'sourced' }));
    await store.add(entry({ candidateId: 'c1', stage: 'hired' }));
    await store.add(entry({ candidateId: 'c2', stage: 'sourced' }));
    await store.add(entry({ candidateId: 'c3', stage: 'rejected' }));
    const report = store.funnelReport(await store.list());
    expect(report.byStage.hired).toBe(1);
    expect(report.byStage.rejected).toBe(1);
    expect(report.total).toBe(3);
  });

  it('funnelReport computes conversion rates', async () => {
    // c1: sourced→screening→interview→offer→hired (current: hired)
    // c2: sourced→screening→interview (current: interview)
    // c3: sourced→screening (current: screening)
    // c4: sourced (current: sourced)
    await store.add(entry({ candidateId: 'c1', stage: 'sourced' }));
    await store.add(entry({ candidateId: 'c1', stage: 'screening' }));
    await store.add(entry({ candidateId: 'c1', stage: 'interview' }));
    await store.add(entry({ candidateId: 'c1', stage: 'offer' }));
    await store.add(entry({ candidateId: 'c1', stage: 'hired' }));
    await store.add(entry({ candidateId: 'c2', stage: 'sourced' }));
    await store.add(entry({ candidateId: 'c2', stage: 'screening' }));
    await store.add(entry({ candidateId: 'c2', stage: 'interview' }));
    await store.add(entry({ candidateId: 'c3', stage: 'sourced' }));
    await store.add(entry({ candidateId: 'c3', stage: 'screening' }));
    await store.add(entry({ candidateId: 'c4', stage: 'sourced' }));
    const report = store.funnelReport(await store.list());
    // current-stage counts (1 person per stage: c1=hired, c2=interview, c3=screening, c4=sourced)
    expect(report.byStage.sourced).toBe(1);
    expect(report.byStage.screening).toBe(1);
    expect(report.byStage.interview).toBe(1);
    expect(report.byStage.offer).toBe(0);
    expect(report.byStage.hired).toBe(1);
    expect(report.total).toBe(4);
    // sourced(1) → screening(1): 100% conversion; screening(1) → interview(1): 100%
    expect(report.steps[0].conversionRate).toBe(1);
    expect(report.steps[1].conversionRate).toBe(1);
    // hired / sourced = 1/1 = 1.0
    expect(report.overallConversion).toBeCloseTo(1, 2);
    expect(report.averageDwellDays).toBeGreaterThanOrEqual(0);
  });

  it('funnelReport with multiple candidates per stage', async () => {
    // 4 candidates at sourced, 2 advance to screening, 1 to interview, 1 to offer, 1 to hired
    // but each candidate only occupies ONE current stage
    // so we use 10 candidates:
    //   4 sourced, 3 screening, 2 interview, 1 offer, 1 hired (one candidate walking through,
    //   the others stop)
    // Simpler: 10 candidates, all start sourced; some advance.
    // c1 sourced→hired; c2 sourced→offer; c3 sourced→interview; c4 sourced→interview;
    // c5 sourced→screening; c6 sourced→screening; c7 sourced→screening;
    // c8..c10 stay at sourced.
    const transitions: Array<[string, PipelineEntry['stage'][]]> = [
      ['c1', ['sourced', 'screening', 'interview', 'offer', 'hired']],
      ['c2', ['sourced', 'screening', 'interview', 'offer']],
      ['c3', ['sourced', 'screening', 'interview']],
      ['c4', ['sourced', 'screening', 'interview']],
      ['c5', ['sourced', 'screening']],
      ['c6', ['sourced', 'screening']],
      ['c7', ['sourced', 'screening']],
    ];
    for (const [cid, stages] of transitions) {
      for (const s of stages) await store.add(entry({ candidateId: cid, stage: s as PipelineEntry['stage'] }));
    }
    for (const i of [8, 9, 10]) await store.add(entry({ candidateId: `c${i}`, stage: 'sourced' }));
    const report = store.funnelReport(await store.list());
    expect(report.byStage.sourced).toBe(3);
    expect(report.byStage.screening).toBe(3);
    expect(report.byStage.interview).toBe(2);
    expect(report.byStage.offer).toBe(1);
    expect(report.byStage.hired).toBe(1);
    expect(report.total).toBe(10);
    // sourced tier (3 people) → screening tier (3 people): 100% conversion
    expect(report.steps[0].conversionRate).toBeCloseTo(1, 2);
    // hired / sourced = 1/3 ≈ 0.33
    expect(report.overallConversion).toBeCloseTo(1 / 3, 2);
  });

  it('funnelReport handles empty / all-sourced', async () => {
    await store.add(entry({ candidateId: 'c1', stage: 'sourced' }));
    await store.add(entry({ candidateId: 'c2', stage: 'sourced' }));
    const report = store.funnelReport(await store.list());
    expect(report.steps[0].conversionRate).toBe(1);
    expect(report.steps[0].dropoffRate).toBe(0);
    expect(report.overallConversion).toBe(0);
  });

  it('funnelReport computes average dwell days', async () => {
    // c1: 0 → 10 天后
    await store.add(entry({ candidateId: 'c1', stage: 'sourced', createdAt: '2026-01-01T00:00:00Z' }));
    await store.add(entry({ candidateId: 'c1', stage: 'screening', createdAt: '2026-01-11T00:00:00Z' }));
    const report = store.funnelReport(await store.list());
    expect(report.averageDwellDays).toBe(10);
  });

  it('funnelReport generatedAt is ISO timestamp', async () => {
    const r = store.funnelReport([]);
    expect(new Date(r.generatedAt).toString()).not.toBe('Invalid Date');
  });

  it('advance() omits linkedInterviewId/Review when not provided', async () => {
    const e = await store.advance({ candidateId: 'c1', toStage: 'sourced', actorId: 'u1' });
    expect(e.linkedInterviewId).toBeUndefined();
    expect(e.linkedReviewId).toBeUndefined();
  });

  it('advance() records linkedInterviewId and linkedReviewId', async () => {
    const e = await store.advance({
      candidateId: 'c1', toStage: 'screening', actorId: 'u1',
      linkedInterviewId: 'iv_1', linkedReviewId: 'rv_1',
    });
    expect(e.linkedInterviewId).toBe('iv_1');
    expect(e.linkedReviewId).toBe('rv_1');
  });

  it('currentEntry picks latest even when added out of order', async () => {
    await store.add(entry({ candidateId: 'c1', stage: 'screening', createdAt: '2026-03-01T00:00:00Z' }));
    await store.add(entry({ candidateId: 'c1', stage: 'sourced', createdAt: '2026-01-01T00:00:00Z' }));
    await store.add(entry({ candidateId: 'c1', stage: 'interview', createdAt: '2026-02-01T00:00:00Z' }));
    const all = await store.list();
    const cur = store.currentEntry(all, 'c1');
    expect(cur?.stage).toBe('screening');
  });

  it('funnelReport skips candidates with unparseable createdAt', async () => {
    await store.add(entry({ candidateId: 'c1', stage: 'sourced', createdAt: 'not-a-date' }));
    await store.add(entry({ candidateId: 'c1', stage: 'screening', createdAt: 'also-not-a-date' }));
    const report = store.funnelReport(await store.list());
    // both entries map to the same candidate; some stage is current
    expect(report.byStage.sourced + report.byStage.screening).toBe(1);
    // invalid timestamps yield NaN dwell
    expect(report.averageDwellDays).toBe(0);
  });

  it('funnelReport skips candidates where end < start (clock skew)', async () => {
    await store.add(entry({ candidateId: 'c1', stage: 'sourced', createdAt: '2026-05-01T00:00:00Z' }));
    await store.add(entry({ candidateId: 'c1', stage: 'screening', createdAt: '2026-01-01T00:00:00Z' }));
    const report = store.funnelReport(await store.list());
    // With out-of-order entries, whichever wins by localeCompare becomes current
    // The key invariant: dwell is never negative
    expect(report.averageDwellDays).toBeGreaterThanOrEqual(0);
  });
});