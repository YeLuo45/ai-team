// V21: Pipeline store + funnel computation
// 把候选人漏斗事件作为 append-only 记录存储，最新一条即为当前阶段。

import { JsonStore } from './json-store.js';
import type { PipelineEntry, PipelineStage, PipelineFunnelReport, PipelineFunnelStep } from '../types/pipeline.js';
import { PIPELINE_FUNNEL_STAGES, PIPELINE_STAGE_LABEL } from '../types/pipeline.js';

export class PipelineStore extends JsonStore<PipelineEntry> {
  static create(baseDir: string): PipelineStore {
    return new PipelineStore({ baseDir, fileName: 'pipeline.json' });
  }

  /**
   * 推进一个候选人到下一阶段（覆盖式：先关闭旧 entry，再写新 entry）
   * 若 candidateId 不存在任何 entry，自动创建 sourced 起点。
   */
  async advance(input: {
    candidateId: string;
    toStage: PipelineStage;
    actorId: string;
    note?: string;
    linkedInterviewId?: string;
    linkedReviewId?: string;
  }): Promise<PipelineEntry> {
    const all = await this.list();
    const current = this.currentEntry(all, input.candidateId);
    if (current && current.stage === input.toStage) return current;

    const entry: PipelineEntry = {
      id: `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      candidateId: input.candidateId,
      stage: input.toStage,
      previousStage: current?.stage ?? null,
      actorId: input.actorId,
      createdAt: new Date().toISOString(),
      ...(input.note ? { note: input.note } : {}),
      ...(input.linkedInterviewId ? { linkedInterviewId: input.linkedInterviewId } : {}),
      ...(input.linkedReviewId ? { linkedReviewId: input.linkedReviewId } : {}),
    };
    await this.add(entry);
    return entry;
  }

  /**
   * 给定候选人，返回其"当前阶段 entry"（最新一条）。
   */
  currentEntry(all: PipelineEntry[], candidateId: string): PipelineEntry | null {
    const mine = all.filter((e) => e.candidateId === candidateId);
    if (mine.length === 0) return null;
    let latest = mine[0]!;
    for (const entry of mine.slice(1)) {
      const dt = entry.createdAt.localeCompare(latest.createdAt);
      if (dt >= 0) latest = entry;
    }
    return latest;
  }

  /**
   * 计算漏斗报告：每个阶段人数 + 相邻转化率 + 平均停留。
   */
  funnelReport(all: PipelineEntry[]): PipelineFunnelReport {
    const currentByCandidate = new Map<string, PipelineEntry>();
    for (const entry of all) {
      const prev = currentByCandidate.get(entry.candidateId);
      if (!prev) {
        currentByCandidate.set(entry.candidateId, entry);
      } else {
        const dt = entry.createdAt.localeCompare(prev.createdAt);
        if (dt >= 0) {
          currentByCandidate.set(entry.candidateId, entry);
        }
      }
    }
    const currents = Array.from(currentByCandidate.values());

    const byStage: Record<PipelineStage, number> = {
      sourced: 0, screening: 0, interview: 0, evaluation: 0, offer: 0, hired: 0, rejected: 0,
    };
    for (const e of currents) byStage[e.stage] += 1;

    const total = currents.length;
    const steps: PipelineFunnelStep[] = [];
    let prev = 0;
    for (const stage of PIPELINE_FUNNEL_STAGES) {
      const count = byStage[stage];
      const conversionRate = prev > 0 ? count / prev : (count > 0 ? 1 : 0);
      const dropoffRate = prev > 0 ? (prev - count) / prev : 0;
      steps.push({ stage, label: PIPELINE_STAGE_LABEL[stage], count, conversionRate, dropoffRate });
      prev = count;
    }

    // 平均停留：从 sourced 起点到当前阶段的天数
    let dwellTotal = 0;
    let dwellCount = 0;
    for (const c of currents) {
      const sorted = all
        .filter((e) => e.candidateId === c.candidateId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const first = sorted[0];
      if (!first) continue;
      const start = Date.parse(first.createdAt);
      const end = Date.parse(c.createdAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        dwellTotal += (end - start) / 86_400_000;
        dwellCount += 1;
      }
    }
    const averageDwellDays = dwellCount > 0 ? +(dwellTotal / dwellCount).toFixed(2) : 0;

    const sourcedTotal = byStage.sourced;
    const hiredTotal = byStage.hired;
    const overallConversion = sourcedTotal > 0 ? +(hiredTotal / sourcedTotal).toFixed(4) : 0;

    return {
      total,
      byStage,
      steps,
      overallConversion,
      averageDwellDays,
      generatedAt: new Date().toISOString(),
    };
  }
}