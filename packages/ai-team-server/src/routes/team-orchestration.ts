import { Router } from 'express';
import {
  OrchestrationOrgMemoryStore,
  applyApprovalDecision,
  buildApprovalQueueSnapshot,
  buildLlmOpsAlerts,
  buildLlmOpsSummary,
  buildOrgMemoryContext,
  buildReadmeCommandChecklist,
  buildReleaseHardeningReport,
  buildCockpitServerRecord,
  buildCiArtifactUploadBridge,
  buildDeliveryEvidenceSummary,
  buildProposalAuditReplaySmokeGate,
  buildReleaseOperationsServerRecord,
  buildScenarioBatch,
  buildScenarioSimulation,
  orchestrateCandidateWorkflow,
  type ApprovalRecord,
  type ApprovalDecisionInput,
  type BatchCandidate,
  type BatchRunnerInput,
  type CandidateWorkflowInput,
  type LlmOpsAlertPolicy,
  type LlmOpsCall,
  type OrgMemoryInput,
  type ProposalExecutionAuditEvent,
  type ReadmeCommandSpec,
  type ReleaseCommandStatus,
  type ReleaseCoverageStatus,
  type ReleaseDocsStatus,
  type ReleaseHardeningInput,
  type RiskLevel,
  type ScenarioSimulationInput,
} from '@ai-team/core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RISK_LEVELS = new Set<RiskLevel>(['low', 'medium', 'high', 'critical']);
const PROPOSAL_STATUSES = new Set(['intake', 'clarifying', 'prd_pending_confirmation', 'approved_for_dev', 'in_dev', 'in_test_acceptance', 'accepted', 'deployed', 'delivered']);

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRisk(value: unknown): value is RiskLevel {
  return typeof value === 'string' && RISK_LEVELS.has(value as RiskLevel);
}

function isProposalStatus(value: unknown): value is ProposalExecutionAuditEvent['status'] {
  return typeof value === 'string' && PROPOSAL_STATUSES.has(value);
}

function parseAuditEvents(value: unknown): ProposalExecutionAuditEvent[] | null {
  if (!Array.isArray(value)) return null;
  const events: ProposalExecutionAuditEvent[] = [];
  for (const raw of value) {
    const event = raw as Partial<ProposalExecutionAuditEvent>;
    if (!isString(event.at) || !isProposalStatus(event.status) || !isString(event.command) || typeof event.ok !== 'boolean') return null;
    events.push({ at: event.at, status: event.status, command: event.command, ok: event.ok, note: typeof event.note === 'string' ? event.note : undefined });
  }
  return events;
}

function parseWorkflow(body: Record<string, unknown>): CandidateWorkflowInput | null {
  if (!isString(body.candidateId) || !isString(body.candidateName) || !isString(body.position)) return null;
  if (!isNumber(body.resumeScore) || !isNumber(body.interviewScore) || !isNumber(body.scoreAgentScore)) return null;
  if (!isRisk(body.legalRisk) || !isRisk(body.techPolicyRisk) || !isRisk(body.mediaComplianceRisk)) return null;
  if (!isStringArray(body.requiredSkills) || !isStringArray(body.candidateSkills)) return null;
  if (body.orgMemoryNotes !== undefined && !isStringArray(body.orgMemoryNotes)) return null;
  return body as unknown as CandidateWorkflowInput;
}

function parseSimulation(body: Record<string, unknown>): ScenarioSimulationInput | null {
  if (!isString(body.teamName)) return null;
  if (!isNumber(body.currentHeadcount) || !isNumber(body.targetHeadcount) || !isNumber(body.trainingHours)) return null;
  if (!isStringArray(body.requiredSkills) || !isStringArray(body.currentSkills) || !isStringArray(body.candidateSkills)) return null;
  return body as unknown as ScenarioSimulationInput;
}

function parseMemory(body: Record<string, unknown>): OrgMemoryInput | null {
  if (!isString(body.teamName) || !isString(body.roleProfile)) return null;
  if (!isStringArray(body.historicalFeedback) || !isStringArray(body.managerPreferences)) return null;
  return body as unknown as OrgMemoryInput;
}

function parseOpsCalls(body: Record<string, unknown>): LlmOpsCall[] | null {
  if (!Array.isArray(body.calls)) return null;
  const calls = body.calls;
  for (const call of calls) {
    const row = call as Partial<LlmOpsCall>;
    if (!isString(row.agent) || !isString(row.provider)) return null;
    if (!isNumber(row.tokens) || !isNumber(row.costUsd) || !isNumber(row.latencyMs)) return null;
    if (row.status !== 'ok' && row.status !== 'error' && row.status !== 'fallback') return null;
  }
  return calls as LlmOpsCall[];
}

function parseReadmeCommands(body: Record<string, unknown>): ReadmeCommandSpec[] | null {
  if (!Array.isArray(body.commands)) return null;
  const commands = body.commands;
  for (const command of commands) {
    const row = command as Partial<ReadmeCommandSpec>;
    if (!isString(row.command) || typeof row.required !== 'boolean') return null;
    if (!isNumber(row.exitCode) || typeof row.evidence !== 'string') return null;
  }
  return commands as ReadmeCommandSpec[];
}

function parseApprovalCreate(body: Record<string, unknown>): Omit<ApprovalRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'> | null {
  if (!isString(body.workflowId) || !isString(body.candidateId) || !isString(body.reason)) return null;
  if (body.agent !== 'legal' && body.agent !== 'tech-policy' && body.agent !== 'media-compliance') return null;
  if (body.priority !== 'high' && body.priority !== 'critical') return null;
  return body as unknown as Omit<ApprovalRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
}

function parseApprovalDecision(body: Record<string, unknown>): ApprovalDecisionInput | null {
  if (body.decision !== 'approved' && body.decision !== 'rejected' && body.decision !== 'edited') return null;
  if (!isString(body.reviewerId) || typeof body.note !== 'string') return null;
  return { decision: body.decision, reviewerId: body.reviewerId, note: body.note, decidedAt: new Date().toISOString() };
}

function parseAlertPolicy(body: Record<string, unknown>): LlmOpsAlertPolicy | null {
  if (!isNumber(body.maxCostUsd) || !isNumber(body.maxAverageLatencyMs)) return null;
  if (!isNumber(body.maxFallbackRate) || !isNumber(body.maxErrorRate)) return null;
  return body as unknown as LlmOpsAlertPolicy;
}

export function createTeamOrchestrationRouter(options: { memoryStore?: OrchestrationOrgMemoryStore } = {}): Router {
  const router = Router();
  const approvals: ApprovalRecord[] = [];
  const cockpitRecords = new Map<string, ReturnType<typeof buildCockpitServerRecord>>();
  const releaseOperationsRecords = new Map<string, ReturnType<typeof buildReleaseOperationsServerRecord>>();
  const memoryStore = options.memoryStore ?? new OrchestrationOrgMemoryStore({
    baseDir: process.env.AI_TEAM_ORG_MEMORY_DIR ?? mkdtempSync(path.join(tmpdir(), 'ai-team-org-memory-')),
  });

  router.post('/workflow', (req, res) => {
    const input = parseWorkflow(req.body as Record<string, unknown>);
    if (!input) return res.status(400).json({ error: 'validation_error' });
    return res.json({ workflow: orchestrateCandidateWorkflow(input) });
  });

  router.post('/simulate', (req, res) => {
    const input = parseSimulation(req.body as Record<string, unknown>);
    if (!input) return res.status(400).json({ error: 'validation_error' });
    return res.json({ simulation: buildScenarioSimulation(input) });
  });

  router.post('/org-memory', (req, res) => {
    const input = parseMemory(req.body as Record<string, unknown>);
    if (!input) return res.status(400).json({ error: 'validation_error' });
    return res.json({ memory: buildOrgMemoryContext(input) });
  });

  router.post('/llmops', (req, res) => {
    const calls = parseOpsCalls(req.body as Record<string, unknown>);
    if (!calls) return res.status(400).json({ error: 'validation_error' });
    return res.json({ ops: buildLlmOpsSummary(calls) });
  });

  router.post('/llmops/alerts', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const calls = parseOpsCalls(body);
    const policy = parseAlertPolicy((body.policy ?? {}) as Record<string, unknown>);
    if (!calls || !policy) return res.status(400).json({ error: 'validation_error' });
    return res.json({ alerts: buildLlmOpsAlerts(calls, policy) });
  });

  router.get('/approvals', (_req, res) => {
    return res.json({ approvals, snapshot: buildApprovalQueueSnapshot(approvals) });
  });

  router.post('/approvals', (req, res) => {
    const input = parseApprovalCreate(req.body as Record<string, unknown>);
    if (!input) return res.status(400).json({ error: 'validation_error' });
    const now = new Date().toISOString();
    const approval: ApprovalRecord = {
      id: `ap_${Date.now().toString(36)}_${approvals.length + 1}`,
      ...input,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    approvals.push(approval);
    return res.status(201).json({ approval, snapshot: buildApprovalQueueSnapshot(approvals) });
  });

  router.post('/approvals/:id/decision', (req, res) => {
    const input = parseApprovalDecision(req.body as Record<string, unknown>);
    if (!input) return res.status(400).json({ error: 'validation_error' });
    const index = approvals.findIndex((approval) => approval.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'approval_not_found' });
    try {
      approvals[index] = applyApprovalDecision(approvals[index], input);
    } catch (error) {
      return res.status(409).json({ error: 'approval_already_decided', message: error instanceof Error ? error.message : String(error) });
    }
    return res.json({ approval: approvals[index], snapshot: buildApprovalQueueSnapshot(approvals) });
  });

  router.post('/readme-checklist', (req, res) => {
    const commands = parseReadmeCommands(req.body as Record<string, unknown>);
    if (!commands) return res.status(400).json({ error: 'validation_error' });
    return res.json({ checklist: buildReadmeCommandChecklist(commands) });
  });

  router.post('/org-memory/:team', async (req, res) => {
    const team = req.params.team;
    if (!isString(team)) return res.status(400).json({ error: 'validation_error' });
    const body = req.body as Record<string, unknown>;
    if (!isString(body.roleProfile) || !isString(body.updatedBy)) return res.status(400).json({ error: 'validation_error' });
    if (!isStringArray(body.feedback) || !isStringArray(body.preferences)) return res.status(400).json({ error: 'validation_error' });
    try {
      const entry = await memoryStore.upsert({
        team,
        roleProfile: body.roleProfile,
        feedback: body.feedback,
        preferences: body.preferences,
        updatedBy: body.updatedBy,
      });
      return res.json({ entry });
    } catch (error) {
      return res.status(500).json({ error: 'org_memory_write_failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  router.get('/org-memory/:team', async (req, res) => {
    const team = req.params.team;
    if (!isString(team)) return res.status(400).json({ error: 'validation_error' });
    const entries = await memoryStore.list(team);
    return res.json({ entries });
  });

  router.post('/org-memory/:team/context', async (req, res) => {
    const team = req.params.team;
    const body = req.body as Record<string, unknown>;
    if (!isString(team) || !isStringArray(body.queryTokens)) return res.status(400).json({ error: 'validation_error' });
    const context = await memoryStore.buildContext(team, body.queryTokens);
    return res.json({ context });
  });

  router.post('/simulate/batch', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const input = parseBatch(body);
    if (!input) return res.status(400).json({ error: 'validation_error' });
    return res.json({ batch: buildScenarioBatch(input) });
  });

  router.post('/release-report', (req, res) => {
    const input = parseReleaseReport(req.body as Record<string, unknown>);
    if (!input) return res.status(400).json({ error: 'validation_error' });
    return res.json({ report: buildReleaseHardeningReport(input) });
  });

  router.post('/delivery-summary', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const tests = body.tests as { passed?: unknown; total?: unknown; skipped?: unknown } | undefined;
    const coverage = body.coverage as { strictPassed?: unknown; strictTotal?: unknown; averageBranchPct?: unknown; thresholdPct?: unknown } | undefined;
    const readme = body.readme as { passed?: unknown; total?: unknown } | undefined;
    const build = body.build as { passed?: unknown; reason?: unknown } | undefined;
    if (!isString(body.version) || !tests || !coverage || !readme || !build || !Array.isArray(body.blockers)) return res.status(400).json({ error: 'validation_error' });
    if (!isNumber(tests.passed) || !isNumber(tests.total) || !isNumber(tests.skipped)) return res.status(400).json({ error: 'validation_error' });
    if (!isNumber(coverage.strictPassed) || !isNumber(coverage.strictTotal) || !isNumber(coverage.averageBranchPct) || !isNumber(coverage.thresholdPct)) return res.status(400).json({ error: 'validation_error' });
    if (!isNumber(readme.passed) || !isNumber(readme.total) || typeof build.passed !== 'boolean' || !isStringArray(body.blockers)) return res.status(400).json({ error: 'validation_error' });
    return res.json({
      summary: buildDeliveryEvidenceSummary({
        version: body.version,
        tests: { passed: tests.passed, total: tests.total, skipped: tests.skipped },
        coverage: { strictPassed: coverage.strictPassed, strictTotal: coverage.strictTotal, averageBranchPct: coverage.averageBranchPct, thresholdPct: coverage.thresholdPct },
        readme: { passed: readme.passed, total: readme.total },
        build: { passed: build.passed, reason: typeof build.reason === 'string' ? build.reason : undefined },
        blockers: body.blockers,
      }),
    });
  });

  router.post('/delivery-cockpit', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const snapshot = body.snapshot as { storageKey?: unknown; payload?: unknown; serialized?: unknown } | undefined;
    if (!isString(body.userId) || !snapshot || snapshot.storageKey !== 'ai-team:delivery-cockpit:v1' || typeof snapshot.payload !== 'object' || typeof snapshot.serialized !== 'string') {
      return res.status(400).json({ error: 'validation_error' });
    }
    const record = buildCockpitServerRecord({
      userId: body.userId,
      snapshot: snapshot as Parameters<typeof buildCockpitServerRecord>[0]['snapshot'],
      now: typeof body.now === 'string' ? body.now : new Date().toISOString(),
    });
    cockpitRecords.set(record.userId, record);
    return res.status(201).json({ record });
  });

  router.get('/delivery-cockpit/:userId', (req, res) => {
    const record = cockpitRecords.get(req.params.userId);
    if (!record) return res.status(404).json({ error: 'cockpit_record_not_found' });
    return res.json({ record });
  });

  router.post('/release-operations', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const snapshot = body.snapshot as { storageKey?: unknown; payload?: unknown; serialized?: unknown } | undefined;
    if (!isString(body.userId) || !snapshot || snapshot.storageKey !== 'ai-team:release-operations:v1' || typeof snapshot.payload !== 'object' || typeof snapshot.serialized !== 'string') {
      return res.status(400).json({ error: 'validation_error' });
    }
    const record = buildReleaseOperationsServerRecord({
      userId: body.userId,
      snapshot: snapshot as Parameters<typeof buildReleaseOperationsServerRecord>[0]['snapshot'],
      now: typeof body.now === 'string' ? body.now : new Date().toISOString(),
    });
    releaseOperationsRecords.set(record.userId, record);
    return res.status(201).json({ record });
  });

  router.get('/release-operations/:userId', (req, res) => {
    const record = releaseOperationsRecords.get(req.params.userId);
    if (!record) return res.status(404).json({ error: 'release_operations_record_not_found' });
    return res.json({ record });
  });

  router.post('/ci-artifact-upload-bridge', (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!isString(body.artifactPath) || !isString(body.artifactText) || !isString(body.version) || !isString(body.outputPath)) return res.status(400).json({ error: 'validation_error' });
    if (body.uploadTarget !== 'local-evidence' && body.uploadTarget !== 'github-actions-artifact' && body.uploadTarget !== 'release-asset') return res.status(400).json({ error: 'validation_error' });
    return res.json({ bridge: buildCiArtifactUploadBridge({ artifactPath: body.artifactPath, artifactText: body.artifactText, version: body.version, outputPath: body.outputPath, dryRun: body.dryRun === true, uploadTarget: body.uploadTarget }) });
  });

  router.post('/audit-replay-smoke', (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!isString(body.proposalId) || !isString(body.actor)) return res.status(400).json({ error: 'validation_error' });
    const events = parseAuditEvents(body.events);
    if (!events) return res.status(400).json({ error: 'validation_error' });
    const expectedFinalStatus = body.expectedFinalStatus;
    if (!isProposalStatus(expectedFinalStatus)) return res.status(400).json({ error: 'validation_error' });
    return res.json({ gate: buildProposalAuditReplaySmokeGate({ proposalId: body.proposalId, actor: body.actor, events, expectedFinalStatus }) });
  });

  return router;
}

function parseBatch(body: Record<string, unknown>): BatchRunnerInput | null {
  if (!isString(body.teamName)) return null;
  if (!isNumber(body.currentHeadcount) || !isNumber(body.targetHeadcount)) return null;
  if (!isStringArray(body.requiredSkills) || !isStringArray(body.currentSkills)) return null;
  if (!Array.isArray(body.candidates)) return null;
  const candidates: BatchCandidate[] = [];
  for (const raw of body.candidates) {
    const candidate = raw as Partial<BatchCandidate>;
    if (!isString(candidate.id) || !isString(candidate.name)) return null;
    if (!isStringArray(candidate.candidateSkills) || !isNumber(candidate.trainingHours)) return null;
    candidates.push({ id: candidate.id, name: candidate.name, candidateSkills: candidate.candidateSkills, trainingHours: candidate.trainingHours });
  }
  const ranking = body.ranking === 'training_then_score' ? 'training_then_score' : 'coverage_then_score';
  return {
    teamName: body.teamName,
    currentHeadcount: body.currentHeadcount,
    targetHeadcount: body.targetHeadcount,
    requiredSkills: body.requiredSkills,
    currentSkills: body.currentSkills,
    candidates,
    ranking,
  };
}

function parseReleaseReport(body: Record<string, unknown>): ReleaseHardeningInput | null {
  if (!isString(body.packageVersion)) return null;
  if (!Array.isArray(body.commands)) return null;
  const commands: ReleaseCommandStatus[] = [];
  for (const raw of body.commands) {
    const command = raw as Partial<ReleaseCommandStatus>;
    if (!isString(command.name)) return null;
    if (command.status !== 'pass' && command.status !== 'fail' && command.status !== 'missing') return null;
    commands.push({ name: command.name, status: command.status, reason: typeof command.reason === 'string' ? command.reason : undefined });
  }
  const coverage = body.coverage as Partial<ReleaseCoverageStatus> | undefined;
  const docs = body.docs as Partial<ReleaseDocsStatus> | undefined;
  if (!coverage || !isNumber(coverage.incrementalBranchPct) || !isNumber(coverage.thresholdPct)) return null;
  if (!docs || !isStringArray(docs.documented) || !isStringArray(docs.missing)) return null;
  return {
    packageVersion: body.packageVersion,
    commands,
    coverage: { incrementalBranchPct: coverage.incrementalBranchPct, thresholdPct: coverage.thresholdPct },
    docs: { documented: docs.documented, missing: docs.missing },
  };
}
