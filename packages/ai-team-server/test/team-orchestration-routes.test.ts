import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTeamOrchestrationRouter } from '../src/routes/team-orchestration.js';

function makeApp(opts: { memoryStore?: { upsert: (i: unknown) => Promise<unknown>; list: (t: string) => Promise<unknown>; buildContext: (t: string, q: string[]) => Promise<unknown>; read: (t: string) => Promise<unknown> } } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/team-orchestration', createTeamOrchestrationRouter(opts.memoryStore ? { memoryStore: opts.memoryStore as never } : {}));
  return app;
}

describe('V36-V41 team orchestration routes', () => {
  it('runs the full candidate workflow via REST', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/workflow').send({
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
      candidateSkills: ['React', 'TypeScript', 'Testing'],
    });

    expect(response.status).toBe(200);
    expect(response.body.workflow.recommendation.decision).toBe('hire');
    expect(response.body.workflow.steps).toHaveLength(7);
  });

  it('rejects invalid workflow payloads', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/workflow').send({ candidateId: 'ct-1' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('runs what-if simulation via REST', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate').send({
      teamName: 'Platform',
      currentHeadcount: 6,
      targetHeadcount: 8,
      requiredSkills: ['React', 'Security'],
      currentSkills: ['React'],
      candidateSkills: ['Security'],
      trainingHours: 24,
    });

    expect(response.status).toBe(200);
    expect(response.body.simulation.recommendation).toBe('hire_to_close_gap');
  });

  it('builds org memory and llmops summaries via REST', async () => {
    const app = makeApp();
    const memory = await request(app).post('/api/team-orchestration/org-memory').send({
      teamName: 'Growth',
      roleProfile: 'Experimentation engineer',
      historicalFeedback: ['ownership matters'],
      managerPreferences: ['async updates'],
    });
    const ops = await request(app).post('/api/team-orchestration/llmops').send({
      calls: [{ agent: 'resume', provider: 'mock', tokens: 10, costUsd: 0, latencyMs: 5, status: 'ok' }],
    });

    expect(memory.status).toBe(200);
    expect(memory.body.memory.citations).toHaveLength(2);
    expect(ops.status).toBe(200);
    expect(ops.body.ops.totalTokens).toBe(10);
  });

  it('validates README command checklists via REST', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/readme-checklist').send({
      commands: [
        { command: 'npm run build', required: true, exitCode: 0, evidence: 'built' },
        { command: 'npm test', required: true, exitCode: 1, evidence: 'failed' },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.checklist.deliverable).toBe(false);
    expect(response.body.checklist.failed[0].command).toBe('npm test');
  });

  it('persists approval queue records and decisions via REST', async () => {
    const app = makeApp();
    const create = await request(app).post('/api/team-orchestration/approvals').send({
      workflowId: 'wf-1',
      candidateId: 'ct-1',
      agent: 'legal',
      priority: 'high',
      reason: 'legal reported high risk',
    });
    const list = await request(app).get('/api/team-orchestration/approvals');
    const decision = await request(app).post(`/api/team-orchestration/approvals/${create.body.approval.id}/decision`).send({
      decision: 'approved',
      reviewerId: 'u-1',
      note: 'accepted with mitigation',
    });

    expect(create.status).toBe(201);
    expect(list.body.snapshot.pending).toHaveLength(1);
    expect(decision.status).toBe(200);
    expect(decision.body.approval.status).toBe('approved');
  });

  it('returns LLMOps alerts via REST', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/llmops/alerts').send({
      policy: { maxCostUsd: 0.02, maxAverageLatencyMs: 800, maxFallbackRate: 0.2, maxErrorRate: 0.1 },
      calls: [
        { agent: 'resume', provider: 'openai', tokens: 1000, costUsd: 0.03, latencyMs: 900, status: 'ok' },
        { agent: 'legal', provider: 'openai', tokens: 500, costUsd: 0.01, latencyMs: 1200, status: 'error' },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.alerts.map((alert: { kind: string }) => alert.kind)).toContain('cost');
    expect(response.body.alerts.map((alert: { kind: string }) => alert.kind)).toContain('error');
  });

  it('rejects llmops alerts with invalid policy or calls', async () => {
    const app = makeApp();
    const noPolicy = await request(app).post('/api/team-orchestration/llmops/alerts').send({
      calls: [{ agent: 'resume', provider: 'openai', tokens: 1, costUsd: 0, latencyMs: 1, status: 'ok' }],
    });
    const noCalls = await request(app).post('/api/team-orchestration/llmops/alerts').send({
      policy: { maxCostUsd: 0.02, maxAverageLatencyMs: 800, maxFallbackRate: 0.2, maxErrorRate: 0.1 },
    });

    expect(noPolicy.status).toBe(400);
    expect(noCalls.status).toBe(400);
  });

  it('returns 404 when deciding an unknown approval id', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/approvals/ap-missing/decision').send({
      decision: 'approved',
      reviewerId: 'u-1',
      note: 'orphan',
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('approval_not_found');
  });

  it('returns 409 when deciding an approval twice', async () => {
    const app = makeApp();
    const create = await request(app).post('/api/team-orchestration/approvals').send({
      workflowId: 'wf-1',
      candidateId: 'ct-1',
      agent: 'legal',
      priority: 'critical',
      reason: 'critical risk',
    });
    const first = await request(app).post(`/api/team-orchestration/approvals/${create.body.approval.id}/decision`).send({
      decision: 'approved',
      reviewerId: 'u-1',
      note: 'first',
    });
    const second = await request(app).post(`/api/team-orchestration/approvals/${create.body.approval.id}/decision`).send({
      decision: 'rejected',
      reviewerId: 'u-1',
      note: 'late',
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('approval_already_decided');
  });

  it.each([
    ['/approvals', { workflowId: '', candidateId: 'ct', reason: 'r', agent: 'legal', priority: 'high' }],
    ['/approvals', { workflowId: 'wf', candidateId: 'ct', reason: 'r', agent: 'unknown', priority: 'high' }],
    ['/approvals', { workflowId: 'wf', candidateId: 'ct', reason: 'r', agent: 'legal', priority: 'low' }],
    ['/approvals/ap-1/decision', { decision: 'maybe', reviewerId: 'u-1', note: 'x' }],
    ['/approvals/ap-1/decision', { decision: 'approved', reviewerId: 1, note: 'x' }],
    ['/approvals/ap-1/decision', { decision: 'approved', reviewerId: 'u-1', note: 1 }],
  ])('rejects invalid approval payload for %s', async (path, body) => {
    const app = makeApp();
    const response = await request(app).post(`/api/team-orchestration${path}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('persists org memory via REST and rebuilds context', async () => {
    const app = makeApp();
    const upsert = await request(app).post('/api/team-orchestration/org-memory/Growth').send({
      roleProfile: 'Experimentation engineer',
      feedback: ['retention matters'],
      preferences: ['async updates'],
      updatedBy: 'u-1',
    });
    const context = await request(app).post('/api/team-orchestration/org-memory/Growth/context').send({
      queryTokens: ['pipeline-latency'],
    });
    const list = await request(app).get('/api/team-orchestration/org-memory/Growth');

    expect(upsert.status).toBe(200);
    expect(context.body.context.citations).toEqual(expect.arrayContaining(['context:Growth:query:1']));
    expect(list.body.entries).toHaveLength(1);
  });

  it('ranks candidates via batch scenario REST', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 6,
      targetHeadcount: 8,
      requiredSkills: ['React', 'Security', 'Testing'],
      currentSkills: ['React'],
      candidates: [
        { id: 'c1', name: 'Ada', candidateSkills: ['Security', 'Testing'], trainingHours: 12 },
        { id: 'c2', name: 'Ben', candidateSkills: ['React'], trainingHours: 8 },
        { id: 'c3', name: 'Cee', candidateSkills: ['Security'], trainingHours: 6 },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.batch.winners).toEqual(['c1']);
    expect(response.body.batch.droppedIds).toEqual(['c3']);
  });

  it('returns a release hardening report via REST', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [
        { name: 'build', status: 'pass' },
        { name: 'test', status: 'pass' },
        { name: 'verify:readme', status: 'pass' },
      ],
      coverage: { incrementalBranchPct: 96.4, thresholdPct: 95 },
      docs: { documented: ['build', 'test', 'verify:readme'], missing: [] },
    });

    expect(response.status).toBe(200);
    expect(response.body.report.ready).toBe(true);
    expect(response.body.report.coverageStatus).toBe('pass');
  });

  it.each([
    ['/org-memory/Growth', { feedback: ['x'], preferences: ['y'], updatedBy: 'u-1' }],
    ['/org-memory/Growth/context', { queryTokens: 'not-array' }],
    ['/simulate/batch', { teamName: 'Platform', currentHeadcount: 1, targetHeadcount: 2, requiredSkills: [], currentSkills: [], candidates: 'bad' }],
    ['/release-report', { packageVersion: '', commands: [], coverage: { incrementalBranchPct: 0, thresholdPct: 0 }, docs: { documented: [], missing: [] } }],
  ])('rejects invalid V45-V47 payload for %s', async (path, body) => {
    const app = makeApp();
    const response = await request(app).post(`/api/team-orchestration${path}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('returns 500 when org-memory upsert throws', async () => {
    const memoryStore = {
      upsert: () => Promise.reject(new Error('disk full')),
      list: () => Promise.resolve([]),
      buildContext: () => Promise.resolve({ team: 'X', context: '', citations: [], summary: '' }),
      read: () => Promise.resolve(null),
    };
    const app = makeApp({ memoryStore });
    const response = await request(app).post('/api/team-orchestration/org-memory/Growth').send({
      roleProfile: 'r',
      feedback: ['x'],
      preferences: ['y'],
      updatedBy: 'u-1',
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('org_memory_write_failed');
  });

  it('returns empty batch result for empty candidate list', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.batch.results).toEqual([]);
    expect(response.body.batch.winners).toEqual([]);
  });

  it('accepts training_then_score ranking strategy', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 6,
      requiredSkills: ['React', 'Security'],
      currentSkills: ['React'],
      candidates: [
        { id: 'c1', name: 'Ada', candidateSkills: ['Security'], trainingHours: 4 },
      ],
      ranking: 'training_then_score',
    });
    expect(response.status).toBe(200);
    expect(response.body.batch.winners).toEqual(['c1']);
  });

  it('release-report drops reason when omitted from payload', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'lint', status: 'missing' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['lint'], missing: [] },
    });
    expect(response.status).toBe(200);
    expect(response.body.report.commandResults[0]).not.toHaveProperty('reason');
  });

  it('release-report marks missing command without failing command path', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [
        { name: 'build', status: 'pass' },
        { name: 'lint', status: 'missing' },
      ],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['build', 'lint'], missing: [] },
    });
    expect(response.status).toBe(200);
    expect(response.body.report.ready).toBe(false);
    expect(response.body.report.blockers.some((b: string) => b.includes('lint not run'))).toBe(true);
  });

  it('release-report with reason string preserves it on failed command', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'test', status: 'fail', reason: 'mock failure' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['test'], missing: [] },
    });
    expect(response.status).toBe(200);
    expect(response.body.report.commandResults[0].reason).toBe('mock failure');
  });

  it('release-report with numeric reason is silently dropped', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'test', status: 'fail', reason: 7 }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['test'], missing: [] },
    });
    expect(response.status).toBe(200);
    expect(response.body.report.commandResults[0]).not.toHaveProperty('reason');
  });

  it('org-memory GET returns the persisted entry', async () => {
    const app = makeApp();
    await request(app).post('/api/team-orchestration/org-memory/ReadTeam').send({
      roleProfile: 'r',
      feedback: ['a', 'b'],
      preferences: ['x'],
      updatedBy: 'u-1',
    });
    const response = await request(app).get('/api/team-orchestration/org-memory/ReadTeam');
    expect(response.status).toBe(200);
    expect(response.body.entries[0].team).toBe('ReadTeam');
  });

  it('org-memory context returns citations when team has no entry', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/org-memory/Phantom/context').send({
      queryTokens: ['hiring', 'retention'],
    });
    expect(response.status).toBe(200);
    expect(response.body.context.citations).toEqual([
      'context:Phantom:query:1',
      'context:Phantom:query:2',
    ]);
  });

  it('release-report rejects when coverage object is missing', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'build', status: 'pass' }],
      docs: { documented: ['build'], missing: [] },
    });
    expect(response.status).toBe(400);
  });

  it('batch rejects candidate without id', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [{ name: 'NoId', candidateSkills: ['React'], trainingHours: 6 }],
    });
    expect(response.status).toBe(400);
  });

  it('batch rejects candidate without name', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [{ id: 'c1', candidateSkills: ['React'], trainingHours: 6 }],
    });
    expect(response.status).toBe(400);
  });

  it('batch rejects candidate with non-array skills', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [{ id: 'c1', name: 'Ada', candidateSkills: 'React', trainingHours: 6 }],
    });
    expect(response.status).toBe(400);
  });

  it('batch rejects candidate with non-number trainingHours', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [{ id: 'c1', name: 'Ada', candidateSkills: ['React'], trainingHours: 'six' }],
    });
    expect(response.status).toBe(400);
  });

  it('release-report keeps explicit reason for missing command', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'lint', status: 'missing', reason: 'runner offline' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['lint'], missing: [] },
    });
    expect(response.status).toBe(200);
    expect(response.body.report.commandResults[0].reason).toBe('runner offline');
  });

  it('release-report rejects command with invalid status string', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'lint', status: 'unsupported' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['lint'], missing: [] },
    });
    expect(response.status).toBe(400);
  });

  it('release-report rejects when docs.missing is not array', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'build', status: 'pass' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['build'], missing: 'not-array' },
    });
    expect(response.status).toBe(400);
  });

  it('release-report rejects when coverage.thresholdPct is not a number', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ name: 'build', status: 'pass' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 'high' },
      docs: { documented: ['build'], missing: [] },
    });
    expect(response.status).toBe(400);
  });

  it('batch rejects when teamName is missing', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [{ id: 'c1', name: 'Ada', candidateSkills: ['React'], trainingHours: 6 }],
    });
    expect(response.status).toBe(400);
  });

  it('batch rejects when requiredSkills is missing', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      currentSkills: ['React'],
      candidates: [{ id: 'c1', name: 'Ada', candidateSkills: ['React'], trainingHours: 6 }],
    });
    expect(response.status).toBe(400);
  });

  it('batch rejects when candidates is not an array', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/simulate/batch').send({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: 'not-array',
    });
    expect(response.status).toBe(400);
  });

  it('release-report rejects when commands is missing', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: [], missing: [] },
    });
    expect(response.status).toBe(400);
  });

  it('release-report rejects when packageVersion is missing', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      commands: [{ name: 'build', status: 'pass' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: [], missing: [] },
    });
    expect(response.status).toBe(400);
  });

  it('release-report rejects when command.name is missing', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [{ status: 'pass' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['x'], missing: [] },
    });
    expect(response.status).toBe(400);
  });

  it('release-report marks readiness false when checks fail', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/release-report').send({
      packageVersion: '0.1.0',
      commands: [
        { name: 'build', status: 'fail', reason: 'broken' },
        { name: 'test', status: 'pass' },
      ],
      coverage: { incrementalBranchPct: 60, thresholdPct: 95 },
      docs: { documented: ['build', 'test'], missing: ['build'] },
    });

    expect(response.status).toBe(200);
    expect(response.body.report.ready).toBe(false);
    expect(response.body.report.coverageStatus).toBe('fail');
    expect(response.body.report.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining('build failed'),
        expect.stringContaining('build not documented'),
      ]),
    );
  });

  it('returns delivery summary readiness via REST', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/delivery-summary').send({
      version: 'V54',
      tests: { passed: 1105, total: 1112, skipped: 7 },
      coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.6, thresholdPct: 95 },
      readme: { passed: 11, total: 11 },
      build: { passed: true },
      blockers: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.summary.ready).toBe(true);
    expect(response.body.summary.headline).toContain('V54 ready');
  });

  it.each([
    ['/workflow', { candidateId: '', candidateName: 'Ada', position: 'Eng' }],
    ['/workflow', { candidateId: 'ct', candidateName: 'Ada', position: 'Eng', resumeScore: 'bad', interviewScore: 1, scoreAgentScore: 1 }],
    ['/workflow', { candidateId: 'ct', candidateName: 'Ada', position: 'Eng', resumeScore: 1, interviewScore: 1, scoreAgentScore: 1, legalRisk: 'bad', techPolicyRisk: 'low', mediaComplianceRisk: 'low' }],
    ['/workflow', { candidateId: 'ct', candidateName: 'Ada', position: 'Eng', resumeScore: 1, interviewScore: 1, scoreAgentScore: 1, legalRisk: 'low', techPolicyRisk: 'low', mediaComplianceRisk: 'low', requiredSkills: ['x'], candidateSkills: [1] }],
    ['/workflow', { candidateId: 'ct', candidateName: 'Ada', position: 'Eng', resumeScore: 1, interviewScore: 1, scoreAgentScore: 1, legalRisk: 'low', techPolicyRisk: 'low', mediaComplianceRisk: 'low', requiredSkills: ['x'], candidateSkills: ['x'], orgMemoryNotes: [1] }],
    ['/simulate', { teamName: '', currentHeadcount: 1, targetHeadcount: 2, trainingHours: 1, requiredSkills: [], currentSkills: [], candidateSkills: [] }],
    ['/simulate', { teamName: 'A', currentHeadcount: '1', targetHeadcount: 2, trainingHours: 1, requiredSkills: [], currentSkills: [], candidateSkills: [] }],
    ['/simulate', { teamName: 'A', currentHeadcount: 1, targetHeadcount: 2, trainingHours: 1, requiredSkills: ['x'], currentSkills: [], candidateSkills: [1] }],
    ['/org-memory', { teamName: '', roleProfile: 'x', historicalFeedback: [], managerPreferences: [] }],
    ['/org-memory', { teamName: 'A', roleProfile: 'x', historicalFeedback: ['ok'], managerPreferences: [1] }],
    ['/llmops', { calls: 'bad' }],
    ['/llmops', { calls: [{ agent: '', provider: 'mock', tokens: 1, costUsd: 0, latencyMs: 1, status: 'ok' }] }],
    ['/llmops', { calls: [{ agent: 'a', provider: 'mock', tokens: '1', costUsd: 0, latencyMs: 1, status: 'ok' }] }],
    ['/llmops', { calls: [{ agent: 'a', provider: 'mock', tokens: 1, costUsd: 0, latencyMs: 1, status: 'bad' }] }],
    ['/readme-checklist', { commands: 'bad' }],
    ['/readme-checklist', { commands: [{ command: '', required: true, exitCode: 0, evidence: 'x' }] }],
    ['/readme-checklist', { commands: [{ command: 'npm test', required: 'yes', exitCode: 0, evidence: 'x' }] }],
    ['/readme-checklist', { commands: [{ command: 'npm test', required: true, exitCode: 0, evidence: 1 }] }],
    ['/delivery-summary', { version: 'V54', tests: { passed: 'bad', total: 1, skipped: 0 }, coverage: { strictPassed: 1, strictTotal: 1, averageBranchPct: 100, thresholdPct: 95 }, readme: { passed: 1, total: 1 }, build: { passed: true }, blockers: [] }],
    ['/delivery-summary', { version: 'V54', tests: { passed: 1, total: 1, skipped: 0 }, coverage: { strictPassed: 1, strictTotal: 1, averageBranchPct: 100, thresholdPct: 95 }, readme: { passed: 1, total: 1 }, build: { passed: true }, blockers: 'none' }],
  ])('rejects invalid payload for %s', async (path, body) => {
    const app = makeApp();
    const response = await request(app).post(`/api/team-orchestration${path}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('persists and loads delivery cockpit snapshots via REST', async () => {
    const app = makeApp();
    const payload = {
      userId: 'operator-1',
      snapshot: {
        storageKey: 'ai-team:delivery-cockpit:v1',
        payload: {
          selectedVersion: 'V81',
          filters: { status: 'ready', gate: 'release' },
          importedEvidence: ['V79', 'V80', 'V81'],
          diffText: 'M packages/ai-team-core/src/delivery-summary.ts',
        },
        serialized: '{"selectedVersion":"V81"}',
      },
      now: '2026-06-24T10:00:00.000Z',
    };

    const saved = await request(app).post('/api/team-orchestration/delivery-cockpit').send(payload);
    const loaded = await request(app).get('/api/team-orchestration/delivery-cockpit/operator-1');

    expect(saved.status).toBe(201);
    expect(saved.body.record.id).toBe('cockpit_operator-1_2026-06-24T10:00:00.000Z');
    expect(loaded.status).toBe(200);
    expect(loaded.body.record.snapshot.payload.selectedVersion).toBe('V81');
  });

  it('rejects invalid delivery cockpit snapshot payloads', async () => {
    const app = makeApp();
    const response = await request(app).post('/api/team-orchestration/delivery-cockpit').send({ userId: '', snapshot: {} });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });

  it('persists release operations snapshots and exposes upload bridge + replay smoke via REST', async () => {
    const app = makeApp();
    const releaseSnapshot = {
      storageKey: 'ai-team:release-operations:v1',
      payload: {
        userId: 'operator-2',
        selectedTab: 'audit',
        panel: { ready: true, latestVersion: 'V100', cards: [], markdown: '# panel' },
        auditFilter: { ok: true },
        updatedAt: '2026-06-24T11:00:00Z',
      },
      serialized: '{"userId":"operator-2"}',
    };
    const saved = await request(app).post('/api/team-orchestration/release-operations').send({ userId: 'operator-2', snapshot: releaseSnapshot, now: '2026-06-24T11:00:00Z' });
    const loaded = await request(app).get('/api/team-orchestration/release-operations/operator-2');
    const bridge = await request(app).post('/api/team-orchestration/ci-artifact-upload-bridge').send({
      artifactPath: 'artifacts/release-check.json',
      artifactText: JSON.stringify({ tests: { passed: 1164, total: 1171, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.3, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true } }),
      version: 'V100',
      outputPath: 'docs/delivery/ai-team-v100-release-evidence.json',
      uploadTarget: 'github-actions-artifact',
      dryRun: true,
    });
    const replay = await request(app).post('/api/team-orchestration/audit-replay-smoke').send({
      proposalId: 'P-20260624-024',
      actor: '小墨',
      expectedFinalStatus: 'delivered',
      events: [
        { at: '2026-06-24T11:00:00Z', status: 'accepted', command: 'accept', ok: true },
        { at: '2026-06-24T11:01:00Z', status: 'delivered', command: 'deliver', ok: true },
      ],
    });
    const history = await request(app).post('/api/team-orchestration/release-operations/history').send({
      entries: [
        { version: 'V100', proposalId: 'P-20260624-024', updatedAt: '2026-06-24T11:00:00Z', ready: true, summary: 'V100 ready', evidencePath: 'docs/delivery/ai-team-v100-release-evidence.json' },
        { version: 'V101', proposalId: 'P-20260625-001', updatedAt: '2026-06-25T00:00:00Z', ready: false, summary: 'V101 blocked', evidencePath: 'docs/delivery/ai-team-v101-release-evidence.json' },
      ],
    });
    const provenance = await request(app).post('/api/team-orchestration/ci-artifact-provenance').send({
      version: 'V102',
      artifactName: 'release-check.json',
      artifactSha256: 'a'.repeat(64),
      commit: '7d7cf06',
      workflowRunId: '123456789',
      signer: 'github-actions',
      generatedAt: '2026-06-25T00:00:00Z',
    });
    const replayDiff = await request(app).post('/api/team-orchestration/audit-replay-diff').send({
      proposalId: 'P-20260625-001',
      before: ['accepted'],
      after: ['accepted', 'deployed', 'delivered'],
    });

    expect(saved.status).toBe(201);
    expect(saved.body.record.ready).toBe(true);
    expect(loaded.body.record.snapshot.payload.latestVersion).toBeUndefined();
    expect(loaded.body.record.snapshot.payload.panel.latestVersion).toBe('V100');
    expect(bridge.status).toBe(200);
    expect(bridge.body.bridge.commands.at(-1)).toContain('gh run download');
    expect(replay.status).toBe(200);
    expect(replay.body.gate.ready).toBe(true);
    expect(replay.body.gate.replayedStatuses).toEqual(['accepted', 'delivered']);
    expect(history.status).toBe(200);
    expect(history.body.history.latestVersion).toBe('V101');
    expect(history.body.history.blockedCount).toBe(1);
    expect(provenance.status).toBe(200);
    expect(provenance.body.provenance.ready).toBe(true);
    expect(provenance.body.provenance.subject).toContain('release-check.json@');
    expect(replayDiff.status).toBe(200);
    expect(replayDiff.body.diff.added).toEqual(['deployed', 'delivered']);

    const missingReleaseOps = await request(app).get('/api/team-orchestration/release-operations/missing-user');
    expect(missingReleaseOps.status).toBe(404);

    const defaultNow = await request(app).post('/api/team-orchestration/release-operations').send({ userId: 'operator-3', snapshot: releaseSnapshot });
    expect(defaultNow.status).toBe(201);
    expect(defaultNow.body.record.updatedAt).toMatch(/T/);

    const localBridge = await request(app).post('/api/team-orchestration/ci-artifact-upload-bridge').send({
      artifactPath: 'artifacts/release-check.json',
      artifactText: JSON.stringify({ tests: { passed: 1, total: 1, skipped: 0 }, coverage: { strictPassed: 1, strictTotal: 1, averageBranchPct: 100, thresholdPct: 95 }, readme: { passed: 1, total: 1 }, build: { passed: true } }),
      version: 'V101',
      outputPath: 'docs/delivery/ai-team-v101-release-evidence.json',
      uploadTarget: 'local-evidence',
      dryRun: false,
    });
    expect(localBridge.body.bridge.commands.at(-1)).toContain('cp docs/delivery/ai-team-v101-release-evidence.json');
  });

  it.each([
    ['/release-operations', { userId: '', snapshot: { storageKey: 'bad' } }],
    ['/release-operations', { userId: 'operator', snapshot: { storageKey: 'ai-team:release-operations:v1', payload: 'bad', serialized: '{}' } }],
    ['/release-operations', { userId: 'operator', snapshot: { storageKey: 'ai-team:release-operations:v1', payload: {}, serialized: 1 } }],
    ['/ci-artifact-upload-bridge', { artifactPath: '', artifactText: '{}', version: 'V100', outputPath: 'x', uploadTarget: 'local-evidence' }],
    ['/ci-artifact-upload-bridge', { artifactPath: 'a', artifactText: 1, version: 'V100', outputPath: 'x', uploadTarget: 'local-evidence' }],
    ['/ci-artifact-upload-bridge', { artifactPath: 'a', artifactText: '{}', version: 'V100', outputPath: 'x', uploadTarget: 'bad' }],
    ['/audit-replay-smoke', { proposalId: 1, actor: '小墨', expectedFinalStatus: 'delivered', events: [] }],
    ['/audit-replay-smoke', { proposalId: 'P', actor: '', expectedFinalStatus: 'delivered', events: [] }],
    ['/audit-replay-smoke', { proposalId: 'P', actor: '小墨', expectedFinalStatus: 'delivered', events: [{ at: 'x', status: 'bad', command: 'c', ok: true }] }],
    ['/audit-replay-smoke', { proposalId: 'P', actor: '小墨', expectedFinalStatus: 'bad', events: [] }],
    ['/release-operations/history', { entries: 'bad' }],
    ['/release-operations/history', { entries: [{ version: 'V101' }] }],
    ['/release-operations/history', { entries: [{ version: 'V101', proposalId: 'P-20260625-001', updatedAt: '2026-06-25T00:00:00Z', ready: 'yes', summary: 'x', evidencePath: 'x' }] }],
    ['/release-operations/history', { entries: [{ version: 'V101', proposalId: 'P-20260625-001', updatedAt: '2026-06-25T00:00:00Z', ready: true, summary: 1, evidencePath: 'x' }] }],
    ['/ci-artifact-provenance', { version: 'V102', artifactName: 'release-check.json' }],
    ['/ci-artifact-provenance', { version: 'V102', artifactName: 'release-check.json', artifactSha256: 'a'.repeat(64), commit: '7d7cf06', workflowRunId: '123', signer: 'github-actions', generatedAt: 1 }],
    ['/audit-replay-diff', { proposalId: 123, before: ['accepted'], after: ['delivered'] }],
    ['/audit-replay-diff', { proposalId: 'P', before: 'accepted', after: ['delivered'] }],
    ['/audit-replay-diff', { proposalId: 'P', before: ['accepted'], after: ['bad'] }],
  ])('rejects invalid V98-V103 payload for %s', async (path, body) => {
    const app = makeApp();
    const response = await request(app).post(`/api/team-orchestration${path}`).send(body);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });
});
