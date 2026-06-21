// V29: Pipeline auto-advance — 业务事件触发 pipeline 阶段推进

import type { PipelineStore, PipelineStage } from '@ai-team/core';

export type PipelineTriggerEvent =
  | { type: 'interview.started'; candidateId: string; actorId?: string }
  | { type: 'interview.finalized'; candidateId: string; actorId?: string }
  | { type: 'review.created'; candidateId: string; actorId?: string }
  | { type: 'candidate.hired'; candidateId: string; actorId?: string }
  | { type: 'candidate.rejected'; candidateId: string; actorId?: string };

const TRIGGER_TO_STAGE: Record<PipelineTriggerEvent['type'], PipelineStage | null> = {
  'interview.started': 'interview',
  'interview.finalized': 'evaluation',
  'review.created': 'evaluation',
  'candidate.hired': 'hired',
  'candidate.rejected': 'rejected',
};

export interface AutoAdvanceResult {
  triggered: boolean;
  event: PipelineTriggerEvent['type'];
  candidateId: string;
  toStage: PipelineStage | null;
  /** false if pipeline entry was already at toStage (no-op) */
  advanced: boolean;
}

export interface AutoAdvanceDeps {
  pipelineStore: PipelineStore;
}

/**
 * 处理一个业务事件，自动推进候选人 pipeline 阶段。
 * - 如果候选人没有现有 entry，先创建 sourced 起点，再推进
 * - 如果当前阶段已是目标，跳过（no-op）
 * - 失败时 throw 让上层处理
 */
export async function handlePipelineEvent(deps: AutoAdvanceDeps, ev: PipelineTriggerEvent): Promise<AutoAdvanceResult> {
  const target = TRIGGER_TO_STAGE[ev.type];
  if (!target) {
    return { triggered: false, event: ev.type, candidateId: ev.candidateId, toStage: null, advanced: false };
  }
  // First check current
  const all = await deps.pipelineStore.list();
  const current = deps.pipelineStore.currentEntry(all, ev.candidateId);
  const actor = ev.actorId ?? 'system';
  if (!current) {
    // bootstrap: create sourced then advance to target
    await deps.pipelineStore.advance({ candidateId: ev.candidateId, toStage: 'sourced', actorId: actor });
  }
  const after = await deps.pipelineStore.list();
  const cur = deps.pipelineStore.currentEntry(after, ev.candidateId);
  if (cur?.stage === target) {
    return { triggered: true, event: ev.type, candidateId: ev.candidateId, toStage: target, advanced: false };
  }
  await deps.pipelineStore.advance({
    candidateId: ev.candidateId,
    toStage: target,
    actorId: actor,
    ...(ev.type === 'interview.finalized' ? { note: 'auto: interview finalized' } : {}),
    ...(ev.type === 'review.created' ? { note: 'auto: review created' } : {}),
    ...(ev.type === 'candidate.hired' ? { note: 'auto: candidate hired' } : {}),
    ...(ev.type === 'candidate.rejected' ? { note: 'auto: candidate rejected' } : {}),
  });
  return { triggered: true, event: ev.type, candidateId: ev.candidateId, toStage: target, advanced: true };
}