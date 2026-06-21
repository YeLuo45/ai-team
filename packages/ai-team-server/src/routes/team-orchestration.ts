import { Router } from 'express';
import {
  buildLlmOpsSummary,
  buildOrgMemoryContext,
  buildReadmeCommandChecklist,
  buildScenarioSimulation,
  orchestrateCandidateWorkflow,
  type CandidateWorkflowInput,
  type LlmOpsCall,
  type OrgMemoryInput,
  type ReadmeCommandSpec,
  type RiskLevel,
  type ScenarioSimulationInput,
} from '@ai-team/core';

const RISK_LEVELS = new Set<RiskLevel>(['low', 'medium', 'high', 'critical']);

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

export function createTeamOrchestrationRouter(): Router {
  const router = Router();

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

  router.post('/readme-checklist', (req, res) => {
    const commands = parseReadmeCommands(req.body as Record<string, unknown>);
    if (!commands) return res.status(400).json({ error: 'validation_error' });
    return res.json({ checklist: buildReadmeCommandChecklist(commands) });
  });

  return router;
}
