// V29: Pipeline auto-advance hook tests
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PipelineStore } from '@ai-team/core';
import { handlePipelineEvent } from '../src/pipeline-hooks.js';

function makeStore(): PipelineStore {
  const dir = mkdtempSync(join(tmpdir(), 'pipeline-hooks-'));
  return PipelineStore.create(dir);
}

describe('handlePipelineEvent', () => {
  let store: PipelineStore;
  beforeEach(() => { store = makeStore(); });

  it('interview.started advances to interview (bootstrap from sourced)', async () => {
    const r = await handlePipelineEvent({ pipelineStore: store }, {
      type: 'interview.started', candidateId: 'c1', actorId: 'u1',
    });
    expect(r.triggered).toBe(true);
    expect(r.toStage).toBe('interview');
    expect(r.advanced).toBe(true);
    const all = await store.list();
    expect(all).toHaveLength(2); // sourced + interview
    expect(store.currentEntry(all, 'c1')?.stage).toBe('interview');
  });

  it('interview.finalized advances to evaluation', async () => {
    const r = await handlePipelineEvent({ pipelineStore: store }, {
      type: 'interview.finalized', candidateId: 'c1', actorId: 'u1',
    });
    expect(r.advanced).toBe(true);
    expect(r.toStage).toBe('evaluation');
    const all = await store.list();
    expect(store.currentEntry(all, 'c1')?.stage).toBe('evaluation');
  });

  it('candidate.hired advances to hired', async () => {
    const r = await handlePipelineEvent({ pipelineStore: store }, {
      type: 'candidate.hired', candidateId: 'c1', actorId: 'hr-bot',
    });
    expect(r.toStage).toBe('hired');
    const all = await store.list();
    expect(store.currentEntry(all, 'c1')?.stage).toBe('hired');
  });

  it('candidate.rejected advances to rejected', async () => {
    const r = await handlePipelineEvent({ pipelineStore: store }, {
      type: 'candidate.rejected', candidateId: 'c1',
    });
    expect(r.toStage).toBe('rejected');
  });

  it('no-op when already at target stage', async () => {
    await handlePipelineEvent({ pipelineStore: store }, {
      type: 'interview.started', candidateId: 'c1',
    });
    const before = (await store.list()).length;
    const r = await handlePipelineEvent({ pipelineStore: store }, {
      type: 'interview.started', candidateId: 'c1',
    });
    expect(r.advanced).toBe(false);
    expect((await store.list()).length).toBe(before); // no new entry
  });

  it('sequential progression: sourced → interview → evaluation', async () => {
    await handlePipelineEvent({ pipelineStore: store }, { type: 'interview.started', candidateId: 'c1' });
    const r = await handlePipelineEvent({ pipelineStore: store }, { type: 'interview.finalized', candidateId: 'c1' });
    expect(r.advanced).toBe(true);
    const all = await store.list();
    expect(store.currentEntry(all, 'c1')?.stage).toBe('evaluation');
  });

  it('records auto: note in pipeline entry', async () => {
    await handlePipelineEvent({ pipelineStore: store }, {
      type: 'candidate.hired', candidateId: 'c1', actorId: 'hr',
    });
    const all = await store.list();
    const hired = all.find((e) => e.stage === 'hired')!;
    expect(hired.note).toBe('auto: candidate hired');
  });

  it('review.created records auto: note', async () => {
    await handlePipelineEvent({ pipelineStore: store }, {
      type: 'review.created', candidateId: 'c1',
    });
    const all = await store.list();
    const evalEntry = all.find((e) => e.stage === 'evaluation')!;
    expect(evalEntry.note).toBe('auto: review created');
  });

  it('returns triggered=true with toStage=null for unknown event', async () => {
    const r = await handlePipelineEvent({ pipelineStore: store }, {
      type: 'unknown.event' as any,
      candidateId: 'c1',
    });
    expect(r.triggered).toBe(false);
    expect(r.toStage).toBeNull();
  });

  it('does not advance when actorId omitted (defaults to system)', async () => {
    const r = await handlePipelineEvent({ pipelineStore: store }, {
      type: 'interview.started', candidateId: 'c1',
    });
    expect(r.advanced).toBe(true);
    const all = await store.list();
    expect(all.every((e) => e.actorId === 'system')).toBe(true);
  });

  it('candidate.hired → hired stage', async () => {
    await handlePipelineEvent({ pipelineStore: store }, { type: 'interview.started', candidateId: 'c1' });
    await handlePipelineEvent({ pipelineStore: store }, { type: 'candidate.hired', candidateId: 'c1' });
    const all = await store.list();
    expect(store.currentEntry(all, 'c1')?.stage).toBe('hired');
  });

  it('candidate.rejected → rejected stage', async () => {
    await handlePipelineEvent({ pipelineStore: store }, { type: 'candidate.rejected', candidateId: 'c1' });
    const all = await store.list();
    expect(store.currentEntry(all, 'c1')?.stage).toBe('rejected');
  });
});