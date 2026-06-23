export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type WorkflowAgent = 'resume' | 'interview' | 'score' | 'legal' | 'tech-policy' | 'media-compliance' | 'recommendation';
export type WorkflowDecision = 'hire' | 'hold' | 'reject';

export interface CandidateWorkflowInput {
  candidateId: string;
  candidateName: string;
  position: string;
  resumeScore: number;
  interviewScore: number;
  scoreAgentScore: number;
  legalRisk: RiskLevel;
  techPolicyRisk: RiskLevel;
  mediaComplianceRisk: RiskLevel;
  requiredSkills: string[];
  candidateSkills: string[];
  orgMemoryNotes?: string[];
}

export interface WorkflowStep {
  agent: WorkflowAgent;
  status: 'completed' | 'requires_review';
  score?: number;
  risk?: RiskLevel;
  summary: string;
}

export interface HumanApprovalItem {
  id: string;
  agent: WorkflowAgent;
  priority: 'high' | 'critical';
  reason: string;
}

export interface HumanApprovalGate {
  required: boolean;
  queue: HumanApprovalItem[];
}

export interface WorkflowRecommendation {
  decision: WorkflowDecision;
  confidence: number;
  rationale: string[];
}

export interface CandidateWorkflow {
  candidateId: string;
  candidateName: string;
  position: string;
  steps: WorkflowStep[];
  reviewGate: HumanApprovalGate;
  recommendation: WorkflowRecommendation;
}

export interface ScenarioSimulationInput {
  teamName: string;
  currentHeadcount: number;
  targetHeadcount: number;
  requiredSkills: string[];
  currentSkills: string[];
  candidateSkills: string[];
  trainingHours: number;
}

export interface OrgMemoryInput {
  teamName: string;
  roleProfile: string;
  historicalFeedback: string[];
  managerPreferences: string[];
}

export interface LlmOpsCall {
  agent: string;
  provider: string;
  tokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'ok' | 'error' | 'fallback';
}

export interface ReadmeCommandSpec {
  command: string;
  required: boolean;
  exitCode: number;
  evidence: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'edited';
export type ApprovalDecision = Exclude<ApprovalStatus, 'pending'>;

export interface ApprovalRecord {
  id: string;
  workflowId: string;
  candidateId: string;
  agent: WorkflowAgent;
  priority: 'high' | 'critical';
  reason: string;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  reviewerId?: string;
  note?: string;
}

export interface ApprovalDecisionInput {
  decision: ApprovalDecision;
  reviewerId: string;
  note: string;
  decidedAt: string;
}

export interface LlmOpsAlertPolicy {
  maxCostUsd: number;
  maxAverageLatencyMs: number;
  maxFallbackRate: number;
  maxErrorRate: number;
}

export interface LlmOpsAlert {
  kind: 'cost' | 'latency' | 'fallback' | 'error';
  severity: 'warning' | 'critical';
  message: string;
  actual: number;
  threshold: number;
}

const RISK_WEIGHT: Record<RiskLevel, number> = {
  low: 0,
  medium: 4,
  high: 30,
  critical: 60,
};

function riskStep(agent: WorkflowAgent, risk: RiskLevel): WorkflowStep {
  return {
    agent,
    risk,
    status: risk === 'high' || risk === 'critical' ? 'requires_review' : 'completed',
    summary: `${agent} risk is ${risk}`,
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function skillCoverage(required: string[], actual: string[]): number {
  const requiredSet = unique(required.map((skill) => skill.toLowerCase()));
  if (requiredSet.length === 0) return 1;
  const actualSet = new Set(unique(actual.map((skill) => skill.toLowerCase())));
  const matched = requiredSet.filter((skill) => actualSet.has(skill)).length;
  return +(matched / requiredSet.length).toFixed(4);
}

export function buildHumanApprovalGate(workflow: Pick<CandidateWorkflow, 'candidateId' | 'steps'>): HumanApprovalGate {
  const queue = workflow.steps
    .filter((step) => step.risk === 'high' || step.risk === 'critical')
    .map((step): HumanApprovalItem => ({
      id: `${workflow.candidateId}:${step.agent}`,
      agent: step.agent,
      priority: step.risk === 'critical' ? 'critical' : 'high',
      reason: `${step.agent} reported ${step.risk} risk`,
    }));
  return { required: queue.length > 0, queue };
}

export function orchestrateCandidateWorkflow(input: CandidateWorkflowInput): CandidateWorkflow {
  const averageScore = clampScore((input.resumeScore + input.interviewScore + input.scoreAgentScore) / 3);
  const risks = [input.legalRisk, input.techPolicyRisk, input.mediaComplianceRisk];
  const totalRiskPenalty = risks.reduce((sum, risk) => sum + RISK_WEIGHT[risk], 0);
  const confidence = clampScore(averageScore - totalRiskPenalty);
  const hasCritical = risks.includes('critical');
  const hasHigh = risks.includes('high');
  const coverage = skillCoverage(input.requiredSkills, input.candidateSkills);

  const steps: WorkflowStep[] = [
    { agent: 'resume', status: 'completed', score: clampScore(input.resumeScore), summary: `Resume score ${clampScore(input.resumeScore)}` },
    { agent: 'interview', status: 'completed', score: clampScore(input.interviewScore), summary: `Interview score ${clampScore(input.interviewScore)}` },
    { agent: 'score', status: 'completed', score: clampScore(input.scoreAgentScore), summary: `Score agent score ${clampScore(input.scoreAgentScore)}` },
    riskStep('legal', input.legalRisk),
    riskStep('tech-policy', input.techPolicyRisk),
    riskStep('media-compliance', input.mediaComplianceRisk),
    { agent: 'recommendation', status: hasCritical || hasHigh ? 'requires_review' : 'completed', score: confidence, summary: `Final confidence ${confidence}` },
  ];

  const draft: CandidateWorkflow = {
    candidateId: input.candidateId,
    candidateName: input.candidateName,
    position: input.position,
    steps,
    reviewGate: { required: false, queue: [] },
    recommendation: {
      decision: hasCritical ? 'reject' : hasHigh ? 'hold' : confidence >= 75 && coverage >= 0.75 ? 'hire' : 'hold',
      confidence,
      rationale: [
        `average score ${averageScore}`,
        `skill coverage ${Math.round(coverage * 100)}%`,
        `risk penalty ${totalRiskPenalty}`,
        ...(hasCritical ? ['critical risk blocks automatic approval'] : []),
        ...(input.orgMemoryNotes?.length ? [`used ${input.orgMemoryNotes.length} org memory notes`] : []),
      ],
    },
  };
  return { ...draft, reviewGate: buildHumanApprovalGate(draft) };
}

export function buildScenarioSimulation(input: ScenarioSimulationInput) {
  const currentSkills = unique(input.currentSkills);
  const afterSkills = unique([...input.currentSkills, ...input.candidateSkills]);
  const skillCoverageBefore = skillCoverage(input.requiredSkills, currentSkills);
  const skillCoverageAfter = skillCoverage(input.requiredSkills, afterSkills);
  const headcountDelta = input.targetHeadcount - input.currentHeadcount;
  const recommendation = skillCoverageAfter > skillCoverageBefore && headcountDelta > 0
    ? 'hire_to_close_gap'
    : input.trainingHours <= 16
      ? 'train_existing_team'
      : 'revisit_scope';
  return {
    teamName: input.teamName,
    headcountDelta,
    skillCoverageBefore,
    skillCoverageAfter,
    addedSkills: afterSkills.filter((skill) => !currentSkills.includes(skill)),
    recommendation,
  };
}

export function buildOrgMemoryContext(input: OrgMemoryInput) {
  const citations = [
    ...input.historicalFeedback.map((_, index) => `org:${input.teamName}:feedback:${index + 1}`),
    ...input.managerPreferences.map((_, index) => `org:${input.teamName}:preference:${index + 1}`),
  ];
  const context = [
    `Team: ${input.teamName}`,
    `Role: ${input.roleProfile}`,
    ...input.historicalFeedback.map((item) => `Feedback: ${item}`),
    ...input.managerPreferences.map((item) => `Preference: ${item}`),
  ].join('\n');
  return {
    context,
    citations,
    summary: `${input.teamName} context built from ${citations.length} memory signals`,
  };
}

export function buildLlmOpsSummary(calls: LlmOpsCall[]) {
  const totalTokens = calls.reduce((sum, call) => sum + call.tokens, 0);
  const totalCostUsd = +calls.reduce((sum, call) => sum + call.costUsd, 0).toFixed(6);
  const averageLatencyMs = calls.length > 0
    ? Math.round(calls.reduce((sum, call) => sum + call.latencyMs, 0) / calls.length)
    : 0;
  const fallbackRate = calls.length > 0
    ? calls.filter((call) => call.status === 'fallback').length / calls.length
    : 0;
  const byAgent = Object.fromEntries(calls.map((call) => [call.agent, call]));
  return { totalTokens, totalCostUsd, averageLatencyMs, fallbackRate, byAgent };
}

export function buildReadmeCommandChecklist(commands: ReadmeCommandSpec[]) {
  const required = commands.filter((command) => command.required);
  const failed = required
    .map((command) => {
      if (command.exitCode !== 0) return { command: command.command, reason: `exit ${command.exitCode}` };
      if (!command.evidence.trim()) return { command: command.command, reason: 'missing evidence' };
      return null;
    })
    .filter((item): item is { command: string; reason: string } => item !== null);
  return {
    deliverable: failed.length === 0,
    failed,
    summary: `${required.length - failed.length}/${required.length} README commands deliverable`,
  };
}

export function applyApprovalDecision(record: ApprovalRecord, input: ApprovalDecisionInput): ApprovalRecord {
  if (record.status !== 'pending') {
    throw new Error(`approval ${record.id} already decided`);
  }
  return {
    ...record,
    status: input.decision,
    reviewerId: input.reviewerId,
    note: input.note,
    updatedAt: input.decidedAt,
  };
}

export function buildApprovalQueueSnapshot(records: ApprovalRecord[]) {
  const byStatus: Record<ApprovalStatus, number> = { pending: 0, approved: 0, rejected: 0, edited: 0 };
  const byPriority: Record<'high' | 'critical', number> = { high: 0, critical: 0 };
  for (const record of records) {
    byStatus[record.status] += 1;
    byPriority[record.priority] += 1;
  }
  return {
    pending: records.filter((record) => record.status === 'pending'),
    byStatus,
    byPriority,
  };
}

export function buildLlmOpsAlerts(calls: LlmOpsCall[], policy: LlmOpsAlertPolicy): LlmOpsAlert[] {
  const summary = buildLlmOpsSummary(calls);
  const errorRate = calls.length > 0 ? calls.filter((call) => call.status === 'error').length / calls.length : 0;
  const alerts: LlmOpsAlert[] = [];
  if (summary.totalCostUsd > policy.maxCostUsd) {
    alerts.push({ kind: 'cost', severity: 'warning', message: 'LLM cost exceeded policy', actual: summary.totalCostUsd, threshold: policy.maxCostUsd });
  }
  if (summary.averageLatencyMs > policy.maxAverageLatencyMs) {
    alerts.push({ kind: 'latency', severity: 'warning', message: 'Average LLM latency exceeded policy', actual: summary.averageLatencyMs, threshold: policy.maxAverageLatencyMs });
  }
  if (summary.fallbackRate > policy.maxFallbackRate) {
    alerts.push({ kind: 'fallback', severity: 'warning', message: 'LLM fallback rate exceeded policy', actual: +summary.fallbackRate.toFixed(4), threshold: policy.maxFallbackRate });
  }
  if (errorRate > policy.maxErrorRate) {
    alerts.push({ kind: 'error', severity: 'critical', message: 'LLM error rate exceeded policy', actual: +errorRate.toFixed(4), threshold: policy.maxErrorRate });
  }
  return alerts;
}
