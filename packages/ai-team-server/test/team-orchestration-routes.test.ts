import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTeamOrchestrationRouter } from '../src/routes/team-orchestration.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/team-orchestration', createTeamOrchestrationRouter());
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
  ])('rejects invalid payload for %s', async (path, body) => {
    const app = makeApp();
    const response = await request(app).post(`/api/team-orchestration${path}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });
});
