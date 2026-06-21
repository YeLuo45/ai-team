import { describe, expect, it } from 'vitest';
import {
  buildHumanApprovalGate,
  buildLlmOpsSummary,
  buildOrgMemoryContext,
  buildReadmeCommandChecklist,
  buildScenarioSimulation,
  orchestrateCandidateWorkflow,
  type CandidateWorkflowInput,
  type ReadmeCommandSpec,
} from '../src/team-orchestration.js';

function baseInput(overrides: Partial<CandidateWorkflowInput> = {}): CandidateWorkflowInput {
  return {
    candidateId: 'ct-1',
    candidateName: 'Ada Chen',
    position: 'Senior Frontend Engineer',
    resumeScore: 86,
    interviewScore: 82,
    scoreAgentScore: 88,
    legalRisk: 'low',
    techPolicyRisk: 'medium',
    mediaComplianceRisk: 'low',
    requiredSkills: ['React', 'TypeScript', 'Testing'],
    candidateSkills: ['React', 'TypeScript', 'Testing', 'Design Systems'],
    orgMemoryNotes: ['frontend team values test-first delivery', 'design system experience is a plus'],
    ...overrides,
  };
}

describe('team orchestration V36-V41', () => {
  it('orchestrates resume, interview, score, compliance and recommendation steps', () => {
    const workflow = orchestrateCandidateWorkflow(baseInput());

    expect(workflow.candidateId).toBe('ct-1');
    expect(workflow.steps.map((step) => step.agent)).toEqual([
      'resume',
      'interview',
      'score',
      'legal',
      'tech-policy',
      'media-compliance',
      'recommendation',
    ]);
    expect(workflow.recommendation.decision).toBe('hire');
    expect(workflow.recommendation.confidence).toBeGreaterThanOrEqual(80);
    expect(workflow.reviewGate.required).toBe(false);
  });

  it('requires human approval when any compliance agent reports high risk', () => {
    const workflow = orchestrateCandidateWorkflow(baseInput({ legalRisk: 'high' }));
    const gate = buildHumanApprovalGate(workflow);

    expect(gate.required).toBe(true);
    expect(gate.queue).toHaveLength(1);
    expect(gate.queue[0].reason).toContain('legal');
    expect(gate.queue[0].priority).toBe('high');
    expect(workflow.recommendation.decision).toBe('hold');
  });

  it('blocks automatic recommendation for critical risks', () => {
    const workflow = orchestrateCandidateWorkflow(baseInput({ techPolicyRisk: 'critical' }));

    expect(workflow.reviewGate.required).toBe(true);
    expect(workflow.reviewGate.queue[0].priority).toBe('critical');
    expect(workflow.recommendation.decision).toBe('reject');
    expect(workflow.recommendation.rationale.join(' ')).toContain('critical');
  });

  it('simulates team impact from candidate skill coverage and headcount', () => {
    const simulation = buildScenarioSimulation({
      teamName: 'Platform',
      currentHeadcount: 6,
      targetHeadcount: 8,
      requiredSkills: ['React', 'TypeScript', 'Testing', 'Security'],
      currentSkills: ['React', 'TypeScript'],
      candidateSkills: ['Testing', 'Security'],
      trainingHours: 24,
    });

    expect(simulation.teamName).toBe('Platform');
    expect(simulation.headcountDelta).toBe(2);
    expect(simulation.skillCoverageBefore).toBe(0.5);
    expect(simulation.skillCoverageAfter).toBe(1);
    expect(simulation.recommendation).toBe('hire_to_close_gap');
  });

  it('builds shared organization memory context with stable citations', () => {
    const memory = buildOrgMemoryContext({
      teamName: 'Growth',
      roleProfile: 'Full-stack engineer for experimentation platform',
      historicalFeedback: ['strong ownership correlates with retention', 'backend fluency reduces onboarding time'],
      managerPreferences: ['clear async updates', 'test-first delivery'],
    });

    expect(memory.context).toContain('Growth');
    expect(memory.citations).toEqual(['org:Growth:feedback:1', 'org:Growth:feedback:2', 'org:Growth:preference:1', 'org:Growth:preference:2']);
    expect(memory.summary).toContain('4 memory signals');
  });

  it('summarizes LLM operations cost, latency and fallback health', () => {
    const ops = buildLlmOpsSummary([
      { agent: 'resume', provider: 'mock', tokens: 1000, costUsd: 0, latencyMs: 20, status: 'ok' },
      { agent: 'interview', provider: 'openai', tokens: 2000, costUsd: 0.01, latencyMs: 600, status: 'ok' },
      { agent: 'legal', provider: 'openai', tokens: 500, costUsd: 0.003, latencyMs: 900, status: 'fallback' },
    ]);

    expect(ops.totalTokens).toBe(3500);
    expect(ops.totalCostUsd).toBe(0.013);
    expect(ops.averageLatencyMs).toBe(507);
    expect(ops.fallbackRate).toBeCloseTo(1 / 3, 4);
    expect(ops.byAgent.legal.status).toBe('fallback');
  });

  it('marks README commands deliverable only when every command passes with evidence', () => {
    const commands: ReadmeCommandSpec[] = [
      { command: 'npm run build', required: true, exitCode: 0, evidence: 'built all packages' },
      { command: 'npm test', required: true, exitCode: 0, evidence: 'all tests passed' },
      { command: 'npm run dev', required: true, exitCode: 0, evidence: 'health endpoint 200' },
    ];

    const checklist = buildReadmeCommandChecklist(commands);

    expect(checklist.deliverable).toBe(true);
    expect(checklist.failed).toHaveLength(0);
    expect(checklist.summary).toBe('3/3 README commands deliverable');
  });

  it('surfaces missing README command evidence as non-deliverable', () => {
    const checklist = buildReadmeCommandChecklist([
      { command: 'npm run build', required: true, exitCode: 0, evidence: 'built' },
      { command: 'npm run dev', required: true, exitCode: 0, evidence: '' },
    ]);

    expect(checklist.deliverable).toBe(false);
    expect(checklist.failed[0].command).toBe('npm run dev');
    expect(checklist.failed[0].reason).toBe('missing evidence');
  });
});
