// V22: Agent audit log — 记录每次 agent 调用的输入/输出/耗时

export type AgentKind =
  | 'interview'
  | 'training'
  | 'one-on-one'
  | 'review'
  | 'resume'
  | 'insights'
  | 'score'
  | 'search'
  | 'legal'
  | 'tech-policy'
  | 'media-compliance'
  | 'pipeline'
  | 'unknown';

export type AgentCallStatus = 'success' | 'failed' | 'cancelled';

export interface AgentCallRecord {
  id: string;
  agent: AgentKind;
  /** 调用方法名，如 `start`、`scoreWithContext` */
  operation: string;
  /** 关联实体 id（候选人/成员/面试），可空 */
  entityId?: string;
  actorId: string;
  /** 输入的简短摘要（避免长文本） */
  inputSummary: string;
  /** 输出的简短摘要 */
  outputSummary: string;
  status: AgentCallStatus;
  /** 毫秒 */
  durationMs: number;
  startedAt: string;
  endedAt: string;
  /** 失败时存错误信息 */
  errorMessage?: string;
}

export interface AgentCallStats {
  total: number;
  byAgent: Record<AgentKind, number>;
  byStatus: Record<AgentCallStatus, number>;
  averageDurationMs: number;
  failureRate: number;
  windowStart: string;
  windowEnd: string;
}