import { describe, expect, it } from 'vitest';
import {
  applyApprovalDecision,
  buildApprovalQueueSnapshot,
  buildReadmeCommandChecklist,
  buildReleaseHardeningReport,
  buildScenarioBatch,
  OrchestrationOrgMemoryStore,
} from '../src/team-orchestration.js';

function makeStore() {
  const memory = new OrchestrationOrgMemoryStore({ baseDir: `/tmp/ai-team-org-memory-${Math.random().toString(36).slice(2)}` });
  return memory;
}

describe('V45 Org Memory Store', () => {
  it('saves and reads team memory entries with citation ids', async () => {
    const store = makeStore();
    await store.upsert({
      team: 'Growth',
      roleProfile: 'Experimentation engineer',
      feedback: ['ownership matters'],
      preferences: ['async updates'],
      updatedBy: 'u-1',
    });
    const entries = await store.list('Growth');
    expect(entries).toHaveLength(1);
    expect(entries[0].team).toBe('Growth');
    expect(entries[0].citations.length).toBeGreaterThan(0);
    expect(entries[0].citations[0]).toMatch(/^org:Growth:/);
  });

  it('merges new feedback and preferences into an existing record', async () => {
    const store = makeStore();
    await store.upsert({ team: 'Growth', roleProfile: 'Experimenter', feedback: ['x'], preferences: ['y'], updatedBy: 'u-1' });
    const merged = await store.upsert({ team: 'Growth', roleProfile: 'Experimenter', feedback: ['z'], preferences: [], updatedBy: 'u-2' });
    expect(merged.feedback).toEqual(['x', 'z']);
    expect(merged.preferences).toEqual(['y']);
    expect(merged.updatedBy).toBe('u-2');
  });

  it('returns empty list for unknown team', async () => {
    const store = makeStore();
    expect(await store.list('missing')).toEqual([]);
  });

  it('builds context from persisted memory with citations', async () => {
    const store = makeStore();
    await store.upsert({ team: 'Growth', roleProfile: 'Experimenter', feedback: ['retention matters'], preferences: ['async'], updatedBy: 'u-1' });
    const context = await store.buildContext('Growth', ['pipeline-latency']);
    expect(context.citations).toEqual(expect.arrayContaining(['context:Growth:query:1']));
    expect(context.summary).toContain('Growth');
  });
});

describe('V46 Scenario Batch Runner', () => {
  it('ranks candidates by combined score and skill coverage delta', () => {
    const result = buildScenarioBatch({
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
      ranking: 'coverage_then_score',
    });

    expect(result.results).toHaveLength(3);
    expect(result.results[0].id).toBe('c1');
    expect(result.results[0].rankingScore).toBeGreaterThan(result.results[1].rankingScore);
    expect(result.winners).toEqual(['c1']);
    expect(result.droppedIds).toEqual(['c3']);
  });

  it('falls back to score-only ranking when coverage ties', () => {
    const result = buildScenarioBatch({
      teamName: 'Platform',
      currentHeadcount: 6,
      targetHeadcount: 6,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [
        { id: 'c1', name: 'Ada', candidateSkills: ['React'], trainingHours: 10 },
        { id: 'c2', name: 'Ben', candidateSkills: ['React'], trainingHours: 10 },
      ],
      ranking: 'coverage_then_score',
    });

    expect(result.winners).toEqual(['c1', 'c2']);
  });
});

describe('V47 Release Hardening', () => {
  it('reports missing/changed commands and stale coverage deltas', () => {
    const report = buildReleaseHardeningReport({
      packageVersion: '0.1.0',
      commands: [
        { name: 'build', status: 'pass' },
        { name: 'test', status: 'pass' },
        { name: 'verify:readme', status: 'fail', reason: 'missing expected output' },
        { name: 'lint', status: 'missing' },
      ],
      coverage: { incrementalBranchPct: 96.4, thresholdPct: 95 },
      docs: { documented: ['build', 'test', 'verify:readme'], missing: ['lint'] },
    });

    expect(report.ready).toBe(false);
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        'verify:readme failed: missing expected output',
        'lint not run',
        'lint not documented',
      ]),
    );
    expect(report.coverageStatus).toBe('pass');
    expect(report.summary).toContain('2/4 commands pass');
  });

  it('reports ready when all checks pass', () => {
    const report = buildReleaseHardeningReport({
      packageVersion: '0.1.0',
      commands: [
        { name: 'build', status: 'pass' },
        { name: 'test', status: 'pass' },
        { name: 'verify:readme', status: 'pass' },
      ],
      coverage: { incrementalBranchPct: 96.4, thresholdPct: 95 },
      docs: { documented: ['build', 'test', 'verify:readme'], missing: [] },
    });

    expect(report.ready).toBe(true);
    expect(report.blockers).toEqual([]);
  });

  it('adds coverage blocker when threshold not met', () => {
    const report = buildReleaseHardeningReport({
      packageVersion: '0.1.0',
      commands: [{ name: 'build', status: 'pass' }],
      coverage: { incrementalBranchPct: 80, thresholdPct: 95 },
      docs: { documented: ['build'], missing: [] },
    });

    expect(report.coverageStatus).toBe('fail');
    expect(report.blockers.some((block) => block.includes('below threshold'))).toBe(true);
  });

  it('ranks empty candidate list without crashing', () => {
    const result = buildScenarioBatch({
      teamName: 'Platform',
      currentHeadcount: 6,
      targetHeadcount: 8,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [],
    });
    expect(result.results).toEqual([]);
    expect(result.winners).toEqual([]);
    expect(result.droppedIds).toEqual([]);
  });

  it('marks fit_existing_role when no slots but positive delta', () => {
    const result = buildScenarioBatch({
      teamName: 'Platform',
      currentHeadcount: 8,
      targetHeadcount: 8,
      requiredSkills: ['React', 'Security'],
      currentSkills: ['React'],
      candidates: [{ id: 'c1', name: 'Ada', candidateSkills: ['Security'], trainingHours: 6 }],
    });
    expect(result.results[0].recommendation).toBe('fit_existing_role');
    expect(result.winners).toEqual(['c1']);
  });

  it('marks revisit_scope when no delta and high training hours', () => {
    const result = buildScenarioBatch({
      teamName: 'Platform',
      currentHeadcount: 6,
      targetHeadcount: 7,
      requiredSkills: ['React'],
      currentSkills: ['React'],
      candidates: [{ id: 'c1', name: 'Ada', candidateSkills: ['React'], trainingHours: 40 }],
    });
    expect(result.results[0].recommendation).toBe('revisit_scope');
    expect(result.winners).toEqual([]);
  });

  it('breaks ties in batch ranking by candidate id', () => {
    // When winnerCount=1 and two candidates tie, sort falls through to id asc
    const result = buildScenarioBatch({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 5,
      requiredSkills: ['React', 'Security'],
      currentSkills: ['React'],
      candidates: [
        { id: 'c-z', name: 'Zed', candidateSkills: ['Security'], trainingHours: 4 },
        { id: 'c-a', name: 'Ada', candidateSkills: ['Security'], trainingHours: 4 },
      ],
    });
    expect(result.results.map((entry) => entry.id)).toEqual(['c-a', 'c-z']);
  });

  it('reports unspecified reason when release command fails', () => {
    const report = buildReleaseHardeningReport({
      packageVersion: '0.1.0',
      commands: [{ name: 'lint', status: 'fail' }],
      coverage: { incrementalBranchPct: 96, thresholdPct: 95 },
      docs: { documented: ['lint'], missing: [] },
    });
    expect(report.blockers[0]).toBe('lint failed: unspecified');
  });

  it('covers all four batch recommendations in one run', () => {
    const result = buildScenarioBatch({
      teamName: 'Platform',
      currentHeadcount: 5,
      targetHeadcount: 8,
      requiredSkills: ['React', 'Security', 'Testing', 'DevOps'],
      currentSkills: ['React'],
      candidates: [
        { id: 'hire', name: 'Hire', candidateSkills: ['Security', 'Testing', 'DevOps'], trainingHours: 4 },
        { id: 'fit', name: 'Fit', candidateSkills: ['Security'], trainingHours: 4 },
        { id: 'train', name: 'Train', candidateSkills: ['React'], trainingHours: 6 },
        { id: 'revisit', name: 'Revisit', candidateSkills: ['React'], trainingHours: 40 },
      ],
    });
    const recommendations = Object.fromEntries(result.results.map((entry) => [entry.id, entry.recommendation]));
    expect(recommendations.hire).toBe('hire_to_close_gap');
    expect(recommendations.train).toBe('train_existing_team');
    expect(recommendations.revisit).toBe('revisit_scope');
  });

  it('builds empty org memory context when no entry exists', async () => {
    const store = makeStore();
    const context = await store.buildContext('Ghost', ['x']);
    expect(context.context).toContain('Role: (unconfigured)');
    expect(context.citations).toEqual(['context:Ghost:query:1']);
    expect(context.summary).toContain('no persisted memory');
  });

  it('buildApprovalQueueSnapshot returns empty pending for clean input', () => {
    const snapshot = buildApprovalQueueSnapshot([
      { id: 'ap-1', workflowId: 'wf', candidateId: 'ct', agent: 'legal', priority: 'high', reason: 'r', status: 'approved', createdAt: 't', updatedAt: 't' },
    ]);
    expect(snapshot.pending).toEqual([]);
    expect(snapshot.byStatus.approved).toBe(1);
    expect(snapshot.byPriority.high).toBe(1);
  });

  it('applyApprovalDecision edits records when edited status chosen', () => {
    const record = {
      id: 'ap-1',
      workflowId: 'wf',
      candidateId: 'ct',
      agent: 'legal' as const,
      priority: 'high' as const,
      reason: 'r',
      status: 'pending' as const,
      createdAt: 't',
      updatedAt: 't',
    };
    const edited = applyApprovalDecision(record, {
      decision: 'edited',
      reviewerId: 'u-1',
      note: 'edit note',
      decidedAt: '2026-01-02T00:00:00Z',
    });
    expect(edited.status).toBe('edited');
  });

  it('buildReadmeCommandChecklist with empty commands produces empty failed', () => {
    const checklist = buildReadmeCommandChecklist([]);
    expect(checklist.deliverable).toBe(true);
    expect(checklist.failed).toEqual([]);
    expect(checklist.summary).toBe('0/0 README commands deliverable');
  });

  it('normalize covers missing-field defaults from disk', async () => {
    const { promises: fs } = await import('node:fs');
    const dir = `/tmp/ai-team-org-memory-corrupt-${Math.random().toString(36).slice(2)}`;
    const store = new OrchestrationOrgMemoryStore({ baseDir: dir });
    await fs.mkdir(`${dir}/org-memory`, { recursive: true });
    await fs.writeFile(`${dir}/org-memory/Corrupt.json`, JSON.stringify({ team: 'Corrupt' }));
    const entry = await store.read('Corrupt');
    expect(entry).not.toBeNull();
    expect(entry?.feedback).toEqual([]);
    expect(entry?.preferences).toEqual([]);
    expect(entry?.roleProfile).toBe('');
    expect(entry?.updatedBy).toBe('system');
    expect(entry?.updatedAt).toBe(new Date(0).toISOString());
    expect(entry?.id).toBe('org_Corrupt_seed');
  });

  it('read returns null when stored file has no team field', async () => {
    const { promises: fs } = await import('node:fs');
    const dir = `/tmp/ai-team-org-memory-noteam-${Math.random().toString(36).slice(2)}`;
    const store = new OrchestrationOrgMemoryStore({ baseDir: dir });
    await fs.mkdir(`${dir}/org-memory`, { recursive: true });
    await fs.writeFile(`${dir}/org-memory/Orphan.json`, JSON.stringify({ feedback: ['x'] }));
    expect(await store.read('Orphan')).toBeNull();
  });

  it('buildContext shows empty-citations path when entry has only role', async () => {
    const store = makeStore();
    await store.upsert({ team: 'Silent', roleProfile: 'r', feedback: [], preferences: [], updatedBy: 'u-1' });
    const context = await store.buildContext('Silent', ['nudge']);
    expect(context.citations).toContain('context:Silent:query:1');
    expect(context.context).toContain('Role: r');
    expect(context.summary).toContain('0 memory signals');
  });
});