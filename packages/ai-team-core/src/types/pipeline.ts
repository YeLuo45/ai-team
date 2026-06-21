// V21: Pipeline type — 候选人从投递 → 筛选 → 面试 → 评估 → 录用 的阶段跟踪

export type PipelineStage =
  | 'sourced'        // 已添加 (候选人列表)
  | 'screening'      // 简历筛选中 (招聘 HR 主动)
  | 'interview'      // AI 面试进行中
  | 'evaluation'     // 已生成最终评估，待决策
  | 'offer'          // 已发 offer
  | 'hired'          // 已入职 (转为 member)
  | 'rejected';      // 拒绝

export const PIPELINE_STAGES: PipelineStage[] = [
  'sourced', 'screening', 'interview', 'evaluation', 'offer', 'hired', 'rejected',
];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  sourced: '已投递',
  screening: '筛选中',
  interview: '面试中',
  evaluation: '评估中',
  offer: 'Offer',
  hired: '已入职',
  rejected: '已拒绝',
};

// 哪些阶段视为"活跃"（漏斗正向流程，未拒绝未入职）
export const PIPELINE_ACTIVE_STAGES: PipelineStage[] = [
  'sourced', 'screening', 'interview', 'evaluation', 'offer',
];

// 哪些阶段计入"漏斗正向"（排除 rejected/hired）
export const PIPELINE_FUNNEL_STAGES: PipelineStage[] = [
  'sourced', 'screening', 'interview', 'evaluation', 'offer', 'hired',
];

export interface PipelineEntry {
  id: string;
  candidateId: string;
  stage: PipelineStage;
  /** 上一阶段，便于回溯 */
  previousStage: PipelineStage | null;
  note?: string;
  /** 谁推进的（user id or 'system'） */
  actorId: string;
  createdAt: string;
  /** 可选关联到 interview/evaluation id */
  linkedInterviewId?: string;
  linkedReviewId?: string;
}

export interface PipelineFunnelStep {
  stage: PipelineStage;
  label: string;
  count: number;
  conversionRate: number; // 0..1，vs 上一阶段
  dropoffRate: number;    // 0..1
}

export interface PipelineFunnelReport {
  total: number;
  byStage: Record<PipelineStage, number>;
  steps: PipelineFunnelStep[];
  /** hired / sourced 总转化率 */
  overallConversion: number;
  /** 平均停留天数（sourced → 当前阶段） */
  averageDwellDays: number;
  generatedAt: string;
}

export function isTerminalStage(stage: PipelineStage): boolean {
  return stage === 'hired' || stage === 'rejected';
}

export function nextStages(stage: PipelineStage): PipelineStage[] {
  const order = PIPELINE_FUNNEL_STAGES;
  const idx = order.indexOf(stage);
  if (idx < 0 || idx === order.length - 1) return [];
  return [order[idx + 1]];
}