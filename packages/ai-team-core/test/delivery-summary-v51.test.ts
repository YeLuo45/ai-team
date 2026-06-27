// V51-V52: delivery summary evidence contract
import { describe, expect, it } from 'vitest';
import {
  buildDeliveryEvidenceSummary,
  buildDeliveryEvidenceInputFromReports,
  buildDeliveryReportMarkdown,
  buildDeliveryReportIndex,
  buildReleaseEvidenceDownload,
  buildProposalSyncPlan,
  filterDeliveryReportEntries,
  parseReleaseEvidenceJson,
  buildProposalDeliveryWizard,
  buildReleaseReadinessDashboard,
  buildGateFailureHints,
  classifyChangedFiles,
  buildBrowserEvidenceDownloadIntent,
  executeProposalDryRun,
  buildCockpitPersistenceSnapshot,
  buildDiffOwnershipAudit,
  parseVersionedReleaseEvidenceJson,
  buildProposalDeliveryChecklist,
  planProposalExecuteWithConfirm,
  buildCockpitServerRecord,
  migrateReleaseEvidencePayload,
} from '../src/team-orchestration.js';
import {
  buildProposalExecutionPlan,
  buildCockpitWebRestoreModel,
  auditReleaseEvidenceBatch,
  buildReleaseEvidenceQualityGate,
  generateNextDeliveryDirections,
  buildUnattendedDeliveryBatchPlan,
  buildUnattendedBatchRunner,
  planProposalStatusRecovery,
  buildEvidenceTrendDashboard,
  buildReleaseSideEffectGuard,
  buildReleaseSideEffectVisualization,
  buildProposalAutoDeliveryExecution,
  buildCiArtifactEvidenceInput,
  buildReleaseOperationsPanelModel,
  buildCiArtifactImportCommandPlan,
  buildProposalExecutionAuditLedger,
  buildReleaseOperationsPersistenceSnapshot,
  buildCiArtifactIngestionExecution,
  filterProposalExecutionAuditTimeline,
  buildReleaseOperationsServerRecord,
  buildCiArtifactUploadBridge,
  buildProposalAuditReplaySmokeGate,
  buildReleaseOperationsHistorySnapshot,
  buildCiArtifactProvenance,
  buildProposalReplayVisualDiff,
} from '../src/delivery-summary.js';

describe('V51 delivery evidence summary', () => {
  it('marks delivery as ready when all gates pass', () => {
    const summary = buildDeliveryEvidenceSummary({
      version: 'V51',
      tests: { passed: 1094, total: 1101, skipped: 7 },
      coverage: { strictPassed: 10, strictTotal: 10, averageBranchPct: 98.16, thresholdPct: 95 },
      readme: { passed: 9, total: 9 },
      build: { passed: true },
      blockers: [],
    });

    expect(summary.ready).toBe(true);
    expect(summary.testPassRatePct).toBe(100);
    expect(summary.coverageStatus).toBe('pass');
    expect(summary.readmeStatus).toBe('pass');
    expect(summary.headline).toContain('V51 ready');
  });

  it('surfaces blockers when tests, coverage, README, or build fail', () => {
    const summary = buildDeliveryEvidenceSummary({
      version: 'V51',
      tests: { passed: 12, total: 13, skipped: 0 },
      coverage: { strictPassed: 9, strictTotal: 10, averageBranchPct: 94.5, thresholdPct: 95 },
      readme: { passed: 8, total: 9 },
      build: { passed: false, reason: 'tsc failed' },
      blockers: ['proposal MCP blocked'],
    });

    expect(summary.ready).toBe(false);
    expect(summary.testPassRatePct).toBeLessThan(100);
    expect(summary.blockers).toEqual([
      'test pass rate 92.31% below 100%',
      'coverage strict layers 9/10 below 95%',
      'README checks 8/9 passed',
      'build failed: tsc failed',
      'proposal MCP blocked',
    ]);
  });

  it('handles zero executable tests and unspecified build failure reason', () => {
    const summary = buildDeliveryEvidenceSummary({
      version: 'V51',
      tests: { passed: 0, total: 7, skipped: 7 },
      coverage: { strictPassed: 10, strictTotal: 10, averageBranchPct: 94.99, thresholdPct: 95 },
      readme: { passed: 11, total: 11 },
      build: { passed: false },
      blockers: [],
    });

    expect(summary.ready).toBe(false);
    expect(summary.testPassRatePct).toBe(0);
    expect(summary.coverageStatus).toBe('fail');
    expect(summary.readmeStatus).toBe('pass');
    expect(summary.blockers).toEqual([
      'test pass rate 0% below 100%',
      'coverage strict layers 10/10 below 95%',
      'build failed: unspecified',
    ]);
  });
});

describe('V52 dynamic delivery evidence input', () => {
  it('extracts test counts, strict coverage, and README counts from real report text', () => {
    const coverageFinal = {
      '/repo/packages/ai-team-core/src/delivery-summary.ts': {
        s: { '0': 1, '1': 1 },
        b: { '0': [1, 1], '1': [1, 1] },
        f: { '0': 1 },
      },
      '/repo/packages/ai-team-core/src/agent-config.ts': {
        s: { '0': 1 },
        b: { '0': [1, 1] },
        f: { '0': 1 },
      },
    };

    const input = buildDeliveryEvidenceInputFromReports({
      version: 'V52',
      rootDir: '/repo',
      testOutput: 'Test Files  84 passed (84)\nTests  1097 passed | 7 skipped (1104)',
      readmeOutput: 'README command checks: 11/11 passed',
      buildOutput: '✓ built in 5.26s',
      coverageFinal,
      strictLayers: {
        'v51/delivery-summary': /^packages\/ai-team-core\/src\/delivery-summary\.ts$/,
        'v32/core-agent-config': /^packages\/ai-team-core\/src\/agent-config\.ts$/,
      },
      thresholdPct: 95,
      blockers: [],
    });

    expect(input).toEqual({
      version: 'V52',
      tests: { passed: 1097, total: 1104, skipped: 7 },
      coverage: { strictPassed: 2, strictTotal: 2, averageBranchPct: 100, thresholdPct: 95 },
      readme: { passed: 11, total: 11 },
      build: { passed: true },
      blockers: [],
    });
  });

  it('reports failed gates when output is missing or coverage layer is below threshold', () => {
    const input = buildDeliveryEvidenceInputFromReports({
      version: 'V52',
      rootDir: '/repo',
      testOutput: 'Tests  5 failed | 12 passed | 1 skipped (18)',
      readmeOutput: 'README command checks: 10/11 passed',
      buildOutput: 'error TS1234',
      coverageFinal: {
        '/repo/packages/ai-team-core/src/delivery-summary.ts': {
          s: { '0': 1, '1': 0 },
          b: { '0': [1, 0] },
          f: { '0': 1 },
        },
      },
      strictLayers: { 'v52/delivery-summary': /^packages\/ai-team-core\/src\/delivery-summary\.ts$/ },
      thresholdPct: 95,
      blockers: ['proposal MCP unavailable'],
    });

    const summary = buildDeliveryEvidenceSummary(input);

    expect(input.tests).toEqual({ passed: 12, total: 18, skipped: 1 });
    expect(input.coverage.strictPassed).toBe(0);
    expect(input.readme).toEqual({ passed: 10, total: 11 });
    expect(input.build).toEqual({ passed: false, reason: 'missing build success marker' });
    expect(summary.ready).toBe(false);
    expect(summary.blockers).toContain('proposal MCP unavailable');
  });

  it('counts numeric statement and branch counters when coverage entries are scalar', () => {
    const input = buildDeliveryEvidenceInputFromReports({
      version: 'V52',
      rootDir: '/repo/',
      testOutput: 'Tests  2 passed (2)',
      readmeOutput: 'README command checks: 1/1 passed',
      buildOutput: 'tsc -b complete',
      coverageFinal: {
        'packages/ai-team-core/src/delivery-summary.ts': {
          s: { '0': 1 },
          b: { '0': 1, '1': 0 },
          f: { '0': 1 },
        },
      },
      strictLayers: { 'v52/delivery-summary': /^packages\/ai-team-core\/src\/delivery-summary\.ts$/ },
      thresholdPct: 95,
      blockers: [],
    });

    expect(input.coverage).toEqual({
      strictPassed: 0,
      strictTotal: 1,
      averageBranchPct: 50,
      thresholdPct: 95,
    });
  });

  it('falls back to zero counts when report text and strict layers are absent', () => {
    const input = buildDeliveryEvidenceInputFromReports({
      version: 'V52',
      rootDir: '/repo',
      testOutput: 'no vitest summary yet',
      readmeOutput: 'readme verifier did not run',
      buildOutput: 'compiled nothing',
      coverageFinal: {},
      strictLayers: {},
      thresholdPct: 95,
      blockers: [],
    });

    expect(input.tests).toEqual({ passed: 0, total: 0, skipped: 0 });
    expect(input.readme).toEqual({ passed: 0, total: 0 });
    expect(input.coverage).toEqual({
      strictPassed: 0,
      strictTotal: 0,
      averageBranchPct: 0,
      thresholdPct: 95,
    });
  });
});

describe('V55 delivery report markdown', () => {
  it('renders validation evidence, changed files, blockers, and next directions', () => {
    const summary = buildDeliveryEvidenceSummary({
      version: 'V55',
      tests: { passed: 1109, total: 1116, skipped: 7 },
      coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.54, thresholdPct: 95 },
      readme: { passed: 11, total: 11 },
      build: { passed: true },
      blockers: [],
    });

    const report = buildDeliveryReportMarkdown({
      project: 'ai-team',
      proposalId: 'P-20260623-003',
      commit: 'abc1234',
      summary,
      changedFiles: ['packages/ai-team-core/src/delivery-summary.ts', 'scripts/delivery-summary.mjs'],
      validationCommands: [
        { command: 'npm test', result: '1109 passed | 7 skipped' },
        { command: 'npm run verify:readme', result: '11/11 passed' },
      ],
      nextDirections: ['V56 persistent org memory UI', 'V57 release gate automation'],
    });

    expect(report).toContain('# Delivery Report — ai-team');
    expect(report).toContain('**Ready**: yes');
    expect(report).toContain('**Proposal**: P-20260623-003');
    expect(report).toContain('`npm test` — 1109 passed | 7 skipped');
    expect(report).toContain('- packages/ai-team-core/src/delivery-summary.ts');
    expect(report).toContain('- none');
    expect(report).toContain('1. V56 persistent org memory UI');
  });

  it('renders safe empty sections for draft reports', () => {
    const report = buildDeliveryReportMarkdown({
      project: 'ai-team',
      summary: {
        ready: false,
        headline: 'V55 blocked — tests 0%, coverage 0%, README 0/0',
        testPassRatePct: 0,
        coverageStatus: 'fail',
        readmeStatus: 'fail',
        buildStatus: 'fail',
        blockers: ['missing evidence'],
      },
      changedFiles: [],
      validationCommands: [],
      nextDirections: [],
    });

    expect(report).toContain('**Ready**: no');
    expect(report).toContain('## Validation\n- none');
    expect(report).toContain('## Changed Files\n- none');
    expect(report).toContain('## Blockers\n- missing evidence');
    expect(report).toContain('## Next Directions\n1. none');
  });
});

describe('V61-V65 delivery automation helpers', () => {
  const readySummary = buildDeliveryEvidenceSummary({
    version: 'V60',
    tests: { passed: 1112, total: 1119, skipped: 7 },
    coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.54, thresholdPct: 95 },
    readme: { passed: 12, total: 12 },
    build: { passed: true },
    blockers: [],
  });

  it('builds a sorted delivery report index with latest ready report first', () => {
    const index = buildDeliveryReportIndex([
      { version: 'V59', path: 'docs/delivery/v59-delivery-report.md', summary: { ...readySummary, headline: 'V59 ready' }, updatedAt: '2026-06-22T10:00:00Z' },
      { version: 'V60', path: 'docs/delivery/v60-delivery-report.md', summary: readySummary, updatedAt: '2026-06-23T10:00:00Z' },
    ]);

    expect(index.total).toBe(2);
    expect(index.ready).toBe(2);
    expect(index.latest?.version).toBe('V60');
    expect(index.markdown).toContain('| V60 | ready | 100% | 98.54% | 12/12 | `docs/delivery/v60-delivery-report.md` |');
  });

  it('uses semantic version order for latest even when older report files were touched later', () => {
    const index = buildDeliveryReportIndex([
      { version: 'V65', path: 'docs/delivery/v65-delivery-report.md', summary: { ...readySummary, headline: 'V65 ready' }, updatedAt: '2026-06-23T10:00:00Z' },
      { version: 'V55', path: 'docs/delivery/v55-delivery-report.md', summary: { ...readySummary, headline: 'V55 ready' }, updatedAt: '2026-06-23T12:00:00Z' },
      { version: 'V60', path: 'docs/delivery/v60-delivery-report.md', summary: { ...readySummary, headline: 'V60 ready' }, updatedAt: '2026-06-23T11:00:00Z' },
    ]);

    expect(index.latest?.version).toBe('V65');
    expect(index.entries.map((entry) => entry.version)).toEqual(['V65', 'V60', 'V55']);
    expect(index.markdown).toContain('Latest: V65');
  });

  it('creates browser-safe release evidence downloads', () => {
    const download = buildReleaseEvidenceDownload({
      version: 'V65',
      reportMarkdown: '# Delivery Report — ai-team',
      indexMarkdown: '# Delivery Reports Index',
      summary: readySummary,
    });

    expect(download.filename).toBe('ai-team-v65-release-evidence.json');
    expect(download.mimeType).toBe('application/json');
    expect(download.payload.summary.ready).toBe(true);
    expect(download.serialized).toContain('Delivery Reports Index');
  });

  it('plans safe forward proposal sync commands without mutating MCP state', () => {
    const plan = buildProposalSyncPlan({
      proposalId: 'P-20260623-015',
      projectPath: '/home/hermes/projects/ai-team',
      deploymentUrl: 'https://yeluo45.github.io/ai-team/',
      reportPath: 'docs/delivery/v65-delivery-report.md',
      currentStatus: 'in_dev',
      targetStatus: 'delivered',
      evidenceNote: 'tests 1112/1112 pass',
    });

    expect(plan.statusPath).toEqual(['in_test_acceptance', 'accepted', 'deployed', 'delivered']);
    expect(plan.fieldArgs).toContain('--project-path');
    expect(plan.notes).toContain('docs/delivery/v65-delivery-report.md');
  });

  it('covers empty, blocked, and no-op delivery automation branches', () => {
    const empty = buildDeliveryReportIndex([]);
    expect(empty.latest).toBeUndefined();
    expect(empty.markdown).toContain('Latest: none');

    const blockedSummary = buildDeliveryEvidenceSummary({
      version: 'V61',
      tests: { passed: 1, total: 2, skipped: 0 },
      coverage: { strictPassed: 0, strictTotal: 1, averageBranchPct: 0, thresholdPct: 95 },
      readme: { passed: 0, total: 1 },
      build: { passed: false },
      blockers: [],
    });
    const blocked = buildDeliveryReportIndex([
      { version: 'V61', path: 'docs/delivery/v61.md', summary: { ...blockedSummary, headline: 'missing evidence' }, updatedAt: '2026-06-23T01:00:00Z' },
    ]);
    expect(blocked.markdown).toContain('| V61 | blocked | 50% | 0% | 0/0 | `docs/delivery/v61.md` |');

    const noOp = buildProposalSyncPlan({
      proposalId: 'P-20260623-015',
      projectPath: '/home/hermes/projects/ai-team',
      deploymentUrl: 'https://yeluo45.github.io/ai-team/',
      reportPath: 'docs/delivery/v65-delivery-report.md',
      currentStatus: 'delivered',
      targetStatus: 'delivered',
      evidenceNote: 'already delivered',
    });
    expect(noOp.statusPath).toEqual([]);
  });
});

describe('V66-V72 delivery cockpit helpers', () => {
  const ready = buildDeliveryEvidenceSummary({
    version: 'V70',
    tests: { passed: 1200, total: 1207, skipped: 7 },
    coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.8, thresholdPct: 95 },
    readme: { passed: 14, total: 14 },
    build: { passed: true },
    blockers: [],
  });
  const blocked = buildDeliveryEvidenceSummary({
    version: 'V68',
    tests: { passed: 10, total: 12, skipped: 0 },
    coverage: { strictPassed: 14, strictTotal: 16, averageBranchPct: 91.1, thresholdPct: 95 },
    readme: { passed: 12, total: 14 },
    build: { passed: false, reason: 'vite failed' },
    blockers: ['MCP unavailable'],
  });
  const entries = [
    { version: 'V70', path: 'docs/delivery/v70-delivery-report.md', summary: ready, updatedAt: '2026-06-23T10:00:00Z' },
    { version: 'V68', path: 'docs/delivery/v68-delivery-report.md', summary: blocked, updatedAt: '2026-06-23T09:00:00Z' },
  ];

  it('filters delivery history by version, status, date, and gate kind', () => {
    const filtered = filterDeliveryReportEntries(entries, {
      versionText: '70',
      status: 'ready',
      from: '2026-06-23T00:00:00Z',
      gate: 'coverage',
    });

    expect(filtered.map((entry) => entry.version)).toEqual(['V70']);
    expect(filterDeliveryReportEntries(entries, { status: 'blocked', gate: 'readme' })).toHaveLength(1);
  });

  it('imports release evidence JSON and flags schema issues without throwing', () => {
    const imported = parseReleaseEvidenceJson('{"version":"V68","summary":{"ready":false,"headline":"V68 blocked","blockers":["coverage"]},"reportMarkdown":"# R","indexMarkdown":"# I"}', 'evidence.json');
    expect(imported.evidence?.version).toBe('V68');
    expect(imported.issues).toEqual([]);

    const bad = parseReleaseEvidenceJson('{"version":42}', 'bad.json');
    expect(bad.evidence).toBeUndefined();
    expect(bad.issues[0]).toContain('bad.json');
  });

  it('builds guarded proposal delivery wizard steps with field update before final status walk', () => {
    const wizard = buildProposalDeliveryWizard({
      proposalId: 'P-20260623-021',
      projectPath: '/home/hermes/projects/ai-team',
      deploymentUrl: 'https://yeluo45.github.io/ai-team/',
      reportPath: 'docs/delivery/v72-delivery-report.md',
      evidenceNote: 'strict 16/16 pass',
      currentStatus: 'in_dev',
      targetStatus: 'delivered',
    });

    expect(wizard.warning).toContain('update-proposal-fields can reset status');
    expect(wizard.commands[0]).toContain('update-proposal-fields');
    expect(wizard.commands.at(-1)).toContain('--status delivered');
  });

  it('builds release dashboard cards and failure hints from evidence', () => {
    const dashboard = buildReleaseReadinessDashboard(entries);
    expect(dashboard.readyCount).toBe(1);
    expect(dashboard.cards.map((card) => card.label)).toEqual(['Build', 'Tests', 'Coverage', 'README', 'Release']);
    expect(dashboard.cards.find((card) => card.label === 'Release')?.status).toBe('ready');
    expect(buildGateFailureHints(blocked)).toContain('Run npm run test:coverage:incremental and inspect strict layer failures.');
  });

  it('classifies commit-ready diffs into source, tests, docs, generated, and scripts', () => {
    const classified = classifyChangedFiles([
      'M packages/ai-team-core/src/delivery-summary.ts',
      '?? packages/ai-team-core/test/delivery-summary-v72.test.ts',
      'M docs/delivery/index.md',
      'M packages/ai-team-web/public/data/team.json',
      'M scripts/release-check.mjs',
    ]);

    expect(classified.source).toEqual(['packages/ai-team-core/src/delivery-summary.ts']);
    expect(classified.tests).toEqual(['packages/ai-team-core/test/delivery-summary-v72.test.ts']);
    expect(classified.docs).toEqual(['docs/delivery/index.md']);
    expect(classified.generated).toEqual(['packages/ai-team-web/public/data/team.json']);
    expect(classified.scripts).toEqual(['scripts/release-check.mjs']);
  });

  it('covers remaining delivery cockpit edge branches for filters, imports, dashboard, and diff classification', () => {
    expect(filterDeliveryReportEntries(entries, { gate: 'build' })).toHaveLength(1);
    expect(filterDeliveryReportEntries(entries, { gate: 'tests' })).toHaveLength(1);
    expect(filterDeliveryReportEntries(entries, { gate: 'release' })).toHaveLength(1);
    expect(filterDeliveryReportEntries(entries, { versionText: 'missing' })).toEqual([]);
    expect(filterDeliveryReportEntries(entries, { from: '2026-06-23T09:30:00Z', to: '2026-06-23T10:30:00Z' }).map((entry) => entry.version)).toEqual(['V70']);
    expect(filterDeliveryReportEntries(entries, { status: 'ready', gate: 'readme' })).toHaveLength(1);

    expect(parseReleaseEvidenceJson('not-json', 'broken.json').issues[0]).toContain('invalid JSON');
    expect(parseReleaseEvidenceJson('{"version":"V1","summary":{},"reportMarkdown":"# R","indexMarkdown":"# I"}', 'summary.json').issues[0]).toContain('summary');
    expect(parseReleaseEvidenceJson('{"version":"V1","summary":{"ready":true,"headline":"ok","blockers":[]},"reportMarkdown":1,"indexMarkdown":"# I"}', 'report.json').issues[0]).toContain('reportMarkdown');
    expect(parseReleaseEvidenceJson('{"version":"V1","summary":{"ready":true,"headline":"ok","blockers":[]},"reportMarkdown":"# R","indexMarkdown":1}', 'index.json').issues[0]).toContain('indexMarkdown');

    const emptyDashboard = buildReleaseReadinessDashboard([]);
    expect(emptyDashboard.cards.every((card) => card.status === 'blocked')).toBe(true);
    expect(buildGateFailureHints(ready)).toEqual([]);

    const allKinds = classifyChangedFiles(['', 'A package.json', 'M docs/delivery/ai-team-v72-release-evidence.json', 'M README.md']);
    expect(allKinds.generated).toEqual(['docs/delivery/ai-team-v72-release-evidence.json']);
    expect(allKinds.docs).toEqual(['README.md']);
    expect(allKinds.other).toEqual(['package.json']);
  });
});

describe('V73-V78 delivery safety helpers', () => {
  const summary = buildDeliveryEvidenceSummary({
    version: 'V78',
    tests: { passed: 1125, total: 1132, skipped: 7 },
    coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.31, thresholdPct: 95 },
    readme: { passed: 13, total: 13 },
    build: { passed: true },
    blockers: [],
  });

  it('builds a browser-safe download intent without touching Blob, URL, or localStorage', () => {
    const download = buildReleaseEvidenceDownload({
      version: 'V78',
      reportMarkdown: '# V78',
      indexMarkdown: '# Index',
      summary,
    });

    const intent = buildBrowserEvidenceDownloadIntent(download, { objectUrl: 'blob:v78' });

    expect(intent.filename).toBe('ai-team-v78-release-evidence.json');
    expect(intent.mimeType).toBe('application/json');
    expect(intent.objectUrl).toBe('blob:v78');
    expect(intent.revokeAfterClick).toBe(true);
    expect(intent.serialized).toContain('"schemaVersion"');
  });

  it('executes proposal MCP dry-runs as command plans without side effects', () => {
    const wizard = buildProposalDeliveryWizard({
      proposalId: 'P-20260624-003',
      projectPath: '/home/hermes/projects/ai-team',
      deploymentUrl: 'https://yeluo45.github.io/ai-team/',
      reportPath: 'docs/delivery/v78-delivery-report.md',
      evidenceNote: 'strict 15/15 pass',
      currentStatus: 'in_dev',
      targetStatus: 'delivered',
    });

    const dryRun = executeProposalDryRun(wizard);

    expect(dryRun.mutates).toBe(false);
    expect(dryRun.steps).toHaveLength(5);
    expect(dryRun.riskWarnings).toContain('DRY RUN ONLY: commands are not executed.');
    expect(dryRun.steps[0]?.kind).toBe('fields');
    expect(dryRun.steps.at(-1)?.status).toBe('delivered');
  });

  it('builds a delivery cockpit persistence snapshot with bounded recent evidence', () => {
    const snapshot = buildCockpitPersistenceSnapshot({
      selectedVersion: 'V78',
      filters: { status: 'ready', gate: 'coverage', versionText: '78' },
      importedEvidence: ['V76', 'V77', 'V78', 'V79'],
      diffText: 'M packages/ai-team-core/src/delivery-summary.ts',
    });

    expect(snapshot.storageKey).toBe('ai-team:delivery-cockpit:v1');
    expect(snapshot.payload.selectedVersion).toBe('V78');
    expect(snapshot.payload.importedEvidence).toEqual(['V77', 'V78', 'V79']);
    expect(snapshot.serialized).toContain('"gate":"coverage"');
  });

  it('builds a dirty diff ownership audit with safe git add groups', () => {
    const audit = buildDiffOwnershipAudit([
      'M packages/ai-team-core/src/delivery-summary.ts',
      'M packages/ai-team-core/test/delivery-summary-v51.test.ts',
      'M docs/delivery/index.md',
      '?? docs/delivery/ai-team-v78-release-evidence.json',
      'M scripts/verify-readme-commands.mjs',
      'M package.json',
    ]);

    expect(audit.total).toBe(6);
    expect(audit.safeAddCommands).toContain('git add packages/ai-team-core/src/delivery-summary.ts packages/ai-team-core/test/delivery-summary-v51.test.ts');
    expect(audit.safeAddCommands).toContain('git add docs/delivery/index.md docs/delivery/ai-team-v78-release-evidence.json');
    expect(audit.warnings).toContain('Review 1 other file(s) before staging.');
  });

  it('parses versioned release evidence and migrates legacy payloads', () => {
    const current = parseVersionedReleaseEvidenceJson('{"schemaVersion":2,"version":"V78","summary":{"ready":true,"headline":"V78 ready","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}', 'current.json');
    expect(current.evidence?.schemaVersion).toBe(2);
    expect(current.migrated).toBe(false);

    const legacy = parseVersionedReleaseEvidenceJson('{"version":"V72","summary":{"ready":true,"headline":"V72 ready","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}', 'legacy.json');
    expect(legacy.evidence?.schemaVersion).toBe(1);
    expect(legacy.migrated).toBe(true);
  });

  it('builds a proposal delivery checklist from dry-run evidence', () => {
    const checklist = buildProposalDeliveryChecklist({
      proposalId: 'P-20260624-003',
      reportPath: 'docs/delivery/v78-delivery-report.md',
      gates: { tests: true, coverage: true, readme: true, build: true },
      dryRun: executeProposalDryRun(buildProposalDeliveryWizard({
        proposalId: 'P-20260624-003',
        projectPath: '/home/hermes/projects/ai-team',
        deploymentUrl: 'https://yeluo45.github.io/ai-team/',
        reportPath: 'docs/delivery/v78-delivery-report.md',
        evidenceNote: 'strict 15/15 pass',
        currentStatus: 'in_test_acceptance',
        targetStatus: 'delivered',
      })),
    });

    expect(checklist.ready).toBe(true);
    expect(checklist.items.map((item) => item.label)).toEqual(['tests', 'coverage', 'readme', 'build', 'accepted', 'deployed', 'delivered']);
    expect(checklist.items.every((item) => item.done)).toBe(true);
  });

  it('covers blocked checklist, empty diff audit, current schema parse errors, and explicit schema v1', () => {
    const emptyAudit = buildDiffOwnershipAudit(['', '   ']);
    expect(emptyAudit.total).toBe(0);
    expect(emptyAudit.safeAddCommands).toEqual([]);
    expect(emptyAudit.warnings).toEqual([]);

    const invalid = parseVersionedReleaseEvidenceJson('not-json', 'bad-versioned.json');
    expect(invalid.issues[0]).toContain('bad-versioned.json');

    const schemaIssue = parseVersionedReleaseEvidenceJson('{"schemaVersion":2,"version":"V78","summary":{},"reportMarkdown":"# R","indexMarkdown":"# I"}', 'bad-summary.json');
    expect(schemaIssue.evidence).toBeUndefined();
    expect(schemaIssue.migrated).toBe(false);

    const explicitLegacy = parseVersionedReleaseEvidenceJson('{"schemaVersion":1,"version":"V72","summary":{"ready":true,"headline":"V72 ready","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}', 'explicit-v1.json');
    expect(explicitLegacy.evidence?.schemaVersion).toBe(1);
    expect(explicitLegacy.migrated).toBe(false);

    const blocked = buildProposalDeliveryChecklist({
      proposalId: 'P-20260624-003',
      reportPath: 'docs/delivery/v78-delivery-report.md',
      gates: { tests: true, coverage: false, readme: true, build: true },
      dryRun: { mutates: false, steps: [{ kind: 'status', command: 'cmd', status: 'accepted' }], riskWarnings: [] },
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.items.filter((item) => !item.done).map((item) => item.label)).toEqual(['coverage', 'deployed', 'delivered']);
  });
});

describe('V79-V81 delivery execution and migration helpers', () => {
  it('plans proposal execution only when confirmation phrase matches exactly', () => {
    const dryRun = executeProposalDryRun(buildProposalDeliveryWizard({
      proposalId: 'P-20260624-007',
      projectPath: '/home/hermes/projects/ai-team',
      deploymentUrl: 'https://yeluo45.github.io/ai-team/',
      reportPath: 'docs/delivery/v81-delivery-report.md',
      evidenceNote: 'strict 15/15 pass',
      currentStatus: 'in_dev',
      targetStatus: 'delivered',
    }));

    const blocked = planProposalExecuteWithConfirm({ dryRun, confirmText: 'yes' });
    expect(blocked.readyToExecute).toBe(false);
    expect(blocked.commands).toEqual([]);
    expect(blocked.requiredPhrase).toBe('EXECUTE P-20260624-007');

    const ready = planProposalExecuteWithConfirm({ dryRun, confirmText: 'EXECUTE P-20260624-007' });
    expect(ready.readyToExecute).toBe(true);
    expect(ready.commands.length).toBe(dryRun.steps.length);
    expect(ready.commands[0]).toContain('update-proposal-fields');
  });

  it('builds a server persistence record for delivery cockpit snapshots', () => {
    const record = buildCockpitServerRecord({
      userId: 'operator-1',
      snapshot: buildCockpitPersistenceSnapshot({
        selectedVersion: 'V81',
        filters: { status: 'ready', gate: 'release' },
        importedEvidence: ['V79', 'V80', 'V81'],
        diffText: 'M packages/ai-team-core/src/delivery-summary.ts',
      }),
      now: '2026-06-24T10:00:00.000Z',
    });

    expect(record.id).toBe('cockpit_operator-1_2026-06-24T10:00:00.000Z');
    expect(record.userId).toBe('operator-1');
    expect(record.snapshot.payload.selectedVersion).toBe('V81');
    expect(record.updatedAt).toBe('2026-06-24T10:00:00.000Z');
  });

  it('migrates release evidence payloads to schema v2 and preserves current payloads', () => {
    const legacy = migrateReleaseEvidencePayload('{"version":"V72","summary":{"ready":true,"headline":"V72 ready","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}');
    expect(legacy.evidence?.schemaVersion).toBe(2);
    expect(legacy.fromSchemaVersion).toBe(1);
    expect(legacy.changed).toBe(true);
    expect(legacy.serialized).toContain('"schemaVersion": 2');

    const current = migrateReleaseEvidencePayload('{"schemaVersion":2,"version":"V81","summary":{"ready":true,"headline":"V81 ready","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}');
    expect(current.evidence?.schemaVersion).toBe(2);
    expect(current.changed).toBe(false);
  });
});

describe('V82-V96 delivery automation closed loop helpers', () => {
  it('converts a confirmed proposal plan into executable command specs with mutation guard', () => {
    const dryRun = executeProposalDryRun(buildProposalDeliveryWizard({
      proposalId: 'P-20260624-010',
      projectPath: '/home/hermes/projects/ai-team',
      deploymentUrl: 'https://yeluo45.github.io/ai-team/',
      reportPath: 'docs/delivery/v96-delivery-report.md',
      evidenceNote: 'strict 16/16 pass',
      currentStatus: 'in_dev',
      targetStatus: 'delivered',
    }));

    const plan = buildProposalExecutionPlan({ dryRun, confirmText: 'EXECUTE P-20260624-010' });
    expect(plan.ready).toBe(true);
    expect(plan.commands[0]?.mutates).toBe(true);
    expect(plan.commands[0]?.kind).toBe('fields');
    expect(plan.commands.at(-1)?.status).toBe('delivered');

    const blocked = buildProposalExecutionPlan({ dryRun, confirmText: 'EXECUTE P-20260624-999' });
    expect(blocked.ready).toBe(false);
    expect(blocked.commands).toHaveLength(0);
  });

  it('builds a web restoration model from persisted cockpit records', () => {
    const snapshot = buildCockpitPersistenceSnapshot({
      selectedVersion: 'V96',
      filters: { status: 'ready', gate: 'coverage', versionText: '96' },
      importedEvidence: ['V94', 'V95', 'V96'],
      diffText: 'M packages/ai-team-core/src/delivery-summary.ts',
    });
    const restored = buildCockpitWebRestoreModel({
      records: [
        buildCockpitServerRecord({ userId: 'operator-1', snapshot, now: '2026-06-24T12:00:00.000Z' }),
      ],
      userId: 'operator-1',
    });

    expect(restored.canRestore).toBe(true);
    expect(restored.selectedVersion).toBe('V96');
    expect(restored.restoreButtonLabel).toBe('Restore V96 cockpit');
    expect(restored.filters.gate).toBe('coverage');
  });

  it('falls back to a saved cockpit label when selected version is absent', () => {
    const snapshot = buildCockpitPersistenceSnapshot({
      filters: { status: 'ready' },
      importedEvidence: [],
      diffText: '',
    });

    const restored = buildCockpitWebRestoreModel({
      records: [buildCockpitServerRecord({ userId: 'operator-1', snapshot, now: '2026-06-24T12:00:00.000Z' })],
      userId: 'operator-1',
    });

    expect(restored.restoreButtonLabel).toBe('Restore saved cockpit');
  });

  it('audits and migrates a batch of release evidence payloads deterministically', () => {
    const batch = auditReleaseEvidenceBatch([
      { path: 'docs/delivery/legacy.json', text: '{"version":"V72","summary":{"ready":true,"headline":"V72 ready","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}' },
      { path: 'docs/delivery/current.json', text: '{"schemaVersion":2,"version":"V81","summary":{"ready":true,"headline":"V81 ready","blockers":[]},"reportMarkdown":"# R","indexMarkdown":"# I"}' },
      { path: 'docs/delivery/bad.json', text: '{bad' },
    ]);

    expect(batch.total).toBe(3);
    expect(batch.migrated).toBe(1);
    expect(batch.current).toBe(1);
    expect(batch.invalid).toBe(1);
    expect(batch.items.map((item) => item.path)).toEqual(['docs/delivery/bad.json', 'docs/delivery/current.json', 'docs/delivery/legacy.json']);
    expect(batch.items[2]?.writeBack).toContain('"schemaVersion": 2');
  });

  it('detects release evidence quality gate issues before delivery', () => {
    const gate = buildReleaseEvidenceQualityGate({
      expectedProposalId: 'P-20260624-010',
      expectedReadme: '14/14',
      expectedCoverage: '98.17',
      requireUncommittedLabel: true,
      evidence: {
        version: 'V96',
        schemaVersion: 2,
        summary: buildDeliveryEvidenceSummary({
          version: 'V96',
          tests: { passed: 1139, total: 1146, skipped: 7 },
          coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.17, thresholdPct: 95 },
          readme: { passed: 14, total: 14 },
          build: { passed: true },
          blockers: [],
        }),
        reportMarkdown: '# Delivery Report\n**Proposal**: P-20260624-010\n**Commit**: uncommitted (local working tree)\n- `npm run verify:readme` — 14/14 passed\n- `npm run test:coverage:incremental` — 16/16 strict layers, 98.17% avg branch',
        indexMarkdown: '| V96 | ready | 100% | 98.17% | 14/14 |',
      },
    });

    expect(gate.ready).toBe(true);
    expect(gate.issues).toEqual([]);

    const badGate = buildReleaseEvidenceQualityGate({
      expectedProposalId: 'P-20260624-010',
      expectedReadme: '14/14',
      expectedCoverage: '98.17',
      requireUncommittedLabel: true,
      evidence: { version: 'V96', schemaVersion: 1, summary: gate.evidence.summary, reportMarkdown: '# no proposal', indexMarkdown: '' },
    });
    expect(badGate.ready).toBe(false);
    expect(badGate.issues).toContain('schemaVersion must be 2');
    expect(badGate.issues).toContain('report missing proposal P-20260624-010');
  });

  it('generates next directions from current delivery evidence and diff ownership', () => {
    const directions = generateNextDeliveryDirections({
      latestVersion: 'V96',
      qualityGateReady: true,
      audit: buildDiffOwnershipAudit([
        ' M packages/ai-team-core/src/delivery-summary.ts',
        ' M packages/ai-team-web/src/pages/TeamOrchestrationConsole.tsx',
        ' M scripts/release-check.mjs',
      ]),
      batchAudit: { total: 6, migrated: 2, current: 4, invalid: 0, items: [] },
    });

    expect(directions[0]).toContain('V97-V99');
    expect(directions[0]).toContain('CI evidence gate');
    expect(directions[1]).toContain('Web delivery operations');
    expect(directions[2]).toContain('batch migration');
  });

  it('plans unattended delivery batches from next directions and gate evidence', () => {
    const batch = buildUnattendedDeliveryBatchPlan({
      currentVersion: 'V81',
      proposalId: 'P-20260624-011',
      directions: [
        'V82 release evidence history filters',
        'V83 one-click proposal delivery wizard',
        'V84 release evidence import viewer',
      ],
      gates: { build: true, tests: true, coverage: true, readme: true },
      dirtyFiles: [
        ' M packages/ai-team-core/src/delivery-summary.ts',
        ' M scripts/verify-readme-commands.mjs',
        '?? docs/delivery/v84-delivery-report.md',
      ],
    });

    expect(batch.ready).toBe(true);
    expect(batch.versionRange).toBe('V82-V84');
    expect(batch.nextProposalTitle).toContain('V85-V87');
    expect(batch.requiredGates).toEqual(['build', 'tests', 'coverage', 'readme']);
    expect(batch.safeAddCommands).toContain('git add packages/ai-team-core/src/delivery-summary.ts');
    expect(batch.safeAddCommands).toContain('git add docs/delivery/v84-delivery-report.md');
  });

  it('builds unattended batch runner steps with delivery gates and proposal handoff', () => {
    const runner = buildUnattendedBatchRunner({
      proposalId: 'P-20260624-012',
      versionRange: 'V85-V87',
      gates: { build: true, tests: true, coverage: true, readme: true },
      reportPath: 'docs/delivery/v87-delivery-report.md',
    });

    expect(runner.ready).toBe(true);
    expect(runner.steps.map((step) => step.kind)).toEqual(['build', 'tests', 'coverage', 'readme', 'report', 'proposal']);
    expect(runner.steps.at(-1)?.command).toContain('P-20260624-012');
  });

  it('plans status auto-recovery from stuck proposal states without backward transitions', () => {
    const recovery = planProposalStatusRecovery({
      proposalId: 'P-20260624-012',
      currentStatus: 'prd_pending_confirmation',
      targetStatus: 'delivered',
    });

    expect(recovery.recoverable).toBe(true);
    expect(recovery.statusPath).toEqual(['approved_for_dev', 'in_dev', 'in_test_acceptance', 'accepted', 'deployed', 'delivered']);
    expect(recovery.commands[0]).toContain('--status approved_for_dev');

    const delivered = planProposalStatusRecovery({ proposalId: 'P-20260624-012', currentStatus: 'delivered', targetStatus: 'delivered' });
    expect(delivered.recoverable).toBe(false);
    expect(delivered.commands).toEqual([]);
  });

  it('builds an evidence trend dashboard from delivery report entries', () => {
    const trend = buildEvidenceTrendDashboard([
      { version: 'V81', path: 'docs/delivery/v81.md', updatedAt: '2026-06-24T01:00:00Z', summary: buildDeliveryEvidenceSummary({ version: 'V81', tests: { passed: 1148, total: 1155, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.28, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true }, blockers: [] }) },
      { version: 'V84', path: 'docs/delivery/v84.md', updatedAt: '2026-06-24T02:00:00Z', summary: buildDeliveryEvidenceSummary({ version: 'V84', tests: { passed: 1149, total: 1156, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.2, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true }, blockers: [] }) },
    ]);

    expect(trend.latestVersion).toBe('V84');
    expect(trend.coverageDelta).toBeCloseTo(-0.08, 5);
    expect(trend.readmeStable).toBe(true);
    expect(trend.recommendation).toContain('coverage watch');
  });

  it('covers blocked unattended batch and trend fallback branches', () => {
    const noVersionBatch = buildUnattendedDeliveryBatchPlan({
      currentVersion: 'V87',
      proposalId: 'P-20260624-013',
      directions: ['release hardening only'],
      gates: { build: true, tests: false, coverage: true, readme: false },
      dirtyFiles: [],
    });
    expect(noVersionBatch.ready).toBe(false);
    expect(noVersionBatch.versionRange).toBe('V88');
    expect(noVersionBatch.blockers).toEqual(['tests gate is not green', 'readme gate is not green']);

    const runner = buildUnattendedBatchRunner({
      proposalId: 'P-20260624-013',
      versionRange: 'V88',
      gates: { build: true, tests: true, coverage: false, readme: true },
      reportPath: 'docs/delivery/v88-delivery-report.md',
    });
    expect(runner.ready).toBe(false);
    expect(runner.blockers).toEqual(['coverage gate is not green']);
    expect(runner.steps.find((step) => step.kind === 'report')?.command).toContain('V88');

    const emptyTrend = buildEvidenceTrendDashboard([]);
    expect(emptyTrend.latestVersion).toBe('none');
    expect(emptyTrend.coverageDelta).toBe(0);
    expect(emptyTrend.readmeStable).toBe(false);

    const positiveTrend = buildEvidenceTrendDashboard([
      { version: 'V87', path: 'docs/delivery/v87.md', updatedAt: '2026-06-24T03:00:00Z', summary: buildDeliveryEvidenceSummary({ version: 'V87', tests: { passed: 1152, total: 1159, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.5, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true }, blockers: [] }) },
    ]);
    expect(positiveTrend.recommendation).toContain('trend stable');
  });

  it('covers blocked restore, quality gate, and next-direction fallback branches', () => {
    const emptyRestore = buildCockpitWebRestoreModel({ records: [], userId: 'operator-1' });
    expect(emptyRestore.canRestore).toBe(false);
    expect(emptyRestore.restoreButtonLabel).toBe('No saved cockpit');

    const unnamedRestore = buildCockpitWebRestoreModel({
      userId: 'operator-1',
      records: [buildCockpitServerRecord({
        userId: 'operator-1',
        now: '2026-06-24T12:00:00.000Z',
        snapshot: buildCockpitPersistenceSnapshot({ filters: {}, importedEvidence: [], diffText: '' }),
      })],
    });
    expect(unnamedRestore.restoreButtonLabel).toBe('Restore saved cockpit');

    const blockedSummary = buildDeliveryEvidenceSummary({
      version: 'V96',
      tests: { passed: 1, total: 2, skipped: 0 },
      coverage: { strictPassed: 0, strictTotal: 1, averageBranchPct: 50, thresholdPct: 95 },
      readme: { passed: 0, total: 1 },
      build: { passed: false },
      blockers: ['manual blocker'],
    });
    const gate = buildReleaseEvidenceQualityGate({
      expectedProposalId: 'P-20260624-010',
      expectedReadme: '14/14',
      expectedCoverage: '98.17',
      requireUncommittedLabel: true,
      evidence: { version: 'V96', schemaVersion: 2, summary: blockedSummary, reportMarkdown: '**Proposal**: P-20260624-010', indexMarkdown: '| missing |' },
    });
    expect(gate.issues).toContain('README evidence must include 14/14');
    expect(gate.issues).toContain('coverage evidence must include 98.17');
    expect(gate.issues).toContain('uncommitted delivery report must label local working tree');
    expect(gate.issues).toContain('summary is not ready');

    const directions = generateNextDeliveryDirections({
      latestVersion: 'draft',
      qualityGateReady: false,
      audit: buildDiffOwnershipAudit([]),
      batchAudit: { total: 0, migrated: 0, current: 0, invalid: 0, items: [] },
    });
    expect(directions[0]).toContain('VNext');
    expect(directions[0]).toContain('gate currently blocked');
    expect(directions[2]).toContain('monitor 0 evidence files');
  });

  it('builds release side-effect visualization, proposal execution, and CI artifact evidence inputs', () => {
    const guard = buildReleaseSideEffectGuard({
      command: 'npm run release:check',
      before: [],
      after: [' M docs/delivery/index.md', ' M scripts/release-check.mjs'],
      allowedGlobs: ['docs/delivery/**'],
    });
    const visualization = buildReleaseSideEffectVisualization(guard);
    expect(visualization.status).toBe('blocked');
    expect(visualization.rows.map((row) => row.kind)).toEqual(['allowed', 'blocked']);
    expect(visualization.markdown).toContain('scripts/release-check.mjs');

    const execution = buildProposalAutoDeliveryExecution({
      proposalId: 'P-20260624-018',
      currentStatus: 'in_test_acceptance',
      reportPath: 'docs/delivery/v91-delivery-report.md',
      gates: { build: true, tests: true, coverage: true, readme: true, release: true },
      dryRun: false,
    });
    expect(execution.ready).toBe(true);
    expect(execution.commands.map((command) => command.status)).toEqual(['accepted', 'deployed', 'delivered']);
    expect(execution.summary).toContain('will execute 3 proposal transition(s)');

    const blockedExecution = buildProposalAutoDeliveryExecution({
      proposalId: 'P-20260624-018',
      currentStatus: 'in_dev',
      reportPath: 'docs/delivery/v91-delivery-report.md',
      gates: { build: true, tests: true, coverage: false, readme: true, release: true },
      dryRun: true,
    });
    expect(blockedExecution.ready).toBe(false);
    expect(blockedExecution.commands).toEqual([]);
    expect(blockedExecution.summary).toContain('coverage gate is not green');

    const evidence = buildCiArtifactEvidenceInput({
      version: 'V91',
      artifactName: 'release-check.json',
      jsonText: JSON.stringify({
        tests: { passed: 1154, total: 1161, skipped: 7 },
        coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.23, thresholdPct: 95 },
        readme: { passed: 14, total: 14 },
        build: { passed: true },
      }),
    });
    expect(evidence.summary.ready).toBe(true);
    expect(evidence.artifactName).toBe('release-check.json');
    expect(evidence.issues).toEqual([]);

    const allowedVisualization = buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({
      command: 'npm run delivery:index',
      before: [],
      after: [' M docs/delivery/index.md'],
      allowedGlobs: ['docs/delivery/**'],
    }));
    expect(allowedVisualization.status).toBe('allowed');

    const cleanVisualization = buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({
      command: 'npm run build',
      before: [],
      after: [],
      allowedGlobs: [],
    }));
    expect(cleanVisualization.status).toBe('clean');
    expect(cleanVisualization.markdown).toContain('clean');

    const sparseEvidence = buildCiArtifactEvidenceInput({
      version: 'V91',
      artifactName: 'sparse.json',
      jsonText: '{}',
    });
    expect(sparseEvidence.summary.ready).toBe(false);
    expect(sparseEvidence.evidence.build.reason).toBe('missing build artifact');

    const invalid = buildCiArtifactEvidenceInput({ version: 'V91', artifactName: 'bad.json', jsonText: '{bad' });
    expect(invalid.summary.ready).toBe(false);
    expect(invalid.issues[0]).toContain('invalid CI artifact JSON');
  });

  it('guards release commands from unexpected side effects before delivery', () => {
    const clean = buildReleaseSideEffectGuard({
      command: 'npm run release:check',
      before: [],
      after: [
        ' M docs/delivery/index.md',
        '?? docs/delivery/ai-team-v88-release-evidence.json',
      ],
      allowedGlobs: ['docs/delivery/**'],
    });
    expect(clean.ready).toBe(true);
    expect(clean.unexpected).toEqual([]);
    expect(clean.allowed).toEqual(['docs/delivery/ai-team-v88-release-evidence.json', 'docs/delivery/index.md']);

    const dirty = buildReleaseSideEffectGuard({
      command: 'npm run verify:readme',
      before: [' M README.md'],
      after: [
        ' M README.md',
        ' M scripts/release-check.mjs',
        '?? docs/delivery/v88-delivery-report.md',
      ],
      allowedGlobs: ['docs/delivery/**'],
    });
    expect(dirty.ready).toBe(false);
    expect(dirty.unexpected).toEqual(['scripts/release-check.mjs']);
    expect(dirty.allowed).toEqual(['docs/delivery/v88-delivery-report.md']);
    expect(dirty.summary).toContain('blocked 1 unexpected side effect');

    const prefix = buildReleaseSideEffectGuard({
      command: 'npm run release:check',
      before: [],
      after: [' M scripts/release-check.mjs'],
      allowedGlobs: ['scripts/*'],
    });
    expect(prefix.ready).toBe(true);
    expect(prefix.allowed).toEqual(['scripts/release-check.mjs']);

    const exact = buildReleaseSideEffectGuard({
      command: 'npm run release:check',
      before: [],
      after: [' M README.md'],
      allowedGlobs: ['README.md'],
    });
    expect(exact.ready).toBe(true);
    expect(exact.allowed).toEqual(['README.md']);

    const noChange = buildReleaseSideEffectGuard({ command: 'npm run build', before: [' M README.md'], after: [' M README.md'], allowedGlobs: [] });
    expect(noChange.ready).toBe(true);
    expect(noChange.summary).toContain('no new side effects');
  });

  it('builds V92-V94 release operations panel, CI import plan, and proposal audit ledger', () => {
    const latestSummary = buildDeliveryEvidenceSummary({
      version: 'V94',
      tests: { passed: 1158, total: 1165, skipped: 7 },
      coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.44, thresholdPct: 95 },
      readme: { passed: 15, total: 15 },
      build: { passed: true },
      blockers: [],
    });
    const panel = buildReleaseOperationsPanelModel({
      entries: [
        { version: 'V91', path: 'docs/delivery/v91.md', updatedAt: '2026-06-24T04:00:00Z', summary: buildDeliveryEvidenceSummary({ version: 'V91', tests: { passed: 1155, total: 1162, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.21, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true }, blockers: [] }) },
        { version: 'V94', path: 'docs/delivery/v94.md', updatedAt: '2026-06-24T06:00:00Z', summary: latestSummary },
      ],
      sideEffect: buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({
        command: 'npm run release:check',
        before: [],
        after: [' M docs/delivery/index.md'],
        allowedGlobs: ['docs/delivery/**'],
      })),
      autoDelivery: buildProposalAutoDeliveryExecution({
        proposalId: 'P-20260624-019',
        currentStatus: 'in_test_acceptance',
        reportPath: 'docs/delivery/v94-delivery-report.md',
        gates: { build: true, tests: true, coverage: true, readme: true, release: true },
        dryRun: true,
      }),
      ciArtifact: buildCiArtifactEvidenceInput({
        version: 'V94',
        artifactName: 'release-check.json',
        jsonText: JSON.stringify({ tests: { passed: 1158, total: 1165, skipped: 7 }, coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.44, thresholdPct: 95 }, readme: { passed: 15, total: 15 }, build: { passed: true } }),
      }),
    });

    expect(panel.latestVersion).toBe('V94');
    expect(panel.cards.map((card) => card.label)).toEqual(['Latest', 'Side Effects', 'Auto Delivery', 'CI Artifact']);
    expect(panel.cards.every((card) => card.status === 'ready')).toBe(true);
    expect(panel.markdown).toContain('release-check.json');

    const commandPlan = buildCiArtifactImportCommandPlan({
      artifactPath: 'artifacts/release-check.json',
      version: 'V94',
      outputPath: 'docs/delivery/ai-team-v94-release-evidence.json',
      dryRun: true,
    });
    expect(commandPlan.ready).toBe(true);
    expect(commandPlan.commands).toEqual([
      'node scripts/import-ci-artifact.mjs --version V94 --artifact artifacts/release-check.json --output docs/delivery/ai-team-v94-release-evidence.json --dry-run',
    ]);

    const ledger = buildProposalExecutionAuditLedger({
      proposalId: 'P-20260624-019',
      actor: '小墨',
      events: [
        { at: '2026-06-24T06:00:00Z', status: 'in_test_acceptance', command: 'npm run release:check', ok: true },
        { at: '2026-06-24T06:01:00Z', status: 'accepted', command: 'mcp_aisp.py update-proposal-status --status accepted', ok: true },
        { at: '2026-06-24T06:02:00Z', status: 'delivered', command: 'mcp_aisp.py update-proposal-status --status delivered', ok: false, note: 'network retry required' },
      ],
    });
    expect(ledger.ready).toBe(false);
    expect(ledger.summary).toContain('2/3 ok');
    expect(ledger.markdown).toContain('network retry required');
    expect(ledger.statusPath).toEqual(['in_test_acceptance', 'accepted', 'delivered']);
  });

  it('surfaces blocked operations panel and invalid CI import command plans', () => {
    const panel = buildReleaseOperationsPanelModel({
      entries: [],
      sideEffect: buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({ command: 'npm run verify:readme', before: [], after: [' M README.md'], allowedGlobs: ['docs/delivery/**'] })),
      autoDelivery: buildProposalAutoDeliveryExecution({ proposalId: 'P-20260624-020', currentStatus: 'in_dev', reportPath: 'docs/delivery/v95.md', gates: { build: true, tests: false, coverage: true, readme: true, release: true }, dryRun: true }),
      ciArtifact: buildCiArtifactEvidenceInput({ version: 'V95', artifactName: 'bad.json', jsonText: '{bad' }),
    });
    expect(panel.ready).toBe(false);
    expect(panel.latestVersion).toBe('none');
    expect(panel.cards.filter((card) => card.status === 'blocked')).toHaveLength(4);

    const invalid = buildCiArtifactImportCommandPlan({ artifactPath: '', version: '', outputPath: '', dryRun: false });
    expect(invalid.ready).toBe(false);
    expect(invalid.commands).toEqual([]);
    expect(invalid.issues).toEqual(['artifactPath is required', 'version is required', 'outputPath is required']);

    const emptyLedger = buildProposalExecutionAuditLedger({ proposalId: 'P-20260624-020', actor: '小墨', events: [] });
    expect(emptyLedger.ready).toBe(false);
    expect(emptyLedger.summary).toBe('P-20260624-020: no audit events');
  });

  it('builds V95-V97 persistence snapshots, CI ingestion execution, and audit timeline filters', () => {
    const panel = buildReleaseOperationsPanelModel({
      entries: [{ version: 'V97', path: 'docs/delivery/v97.md', updatedAt: '2026-06-24T08:00:00Z', summary: buildDeliveryEvidenceSummary({ version: 'V97', tests: { passed: 1161, total: 1168, skipped: 7 }, coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.5, thresholdPct: 95 }, readme: { passed: 15, total: 15 }, build: { passed: true }, blockers: [] }) }],
      sideEffect: buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({ command: 'npm run release:check', before: [], after: [], allowedGlobs: [] })),
      autoDelivery: buildProposalAutoDeliveryExecution({ proposalId: 'P-20260624-022', currentStatus: 'in_test_acceptance', reportPath: 'docs/delivery/v97.md', gates: { build: true, tests: true, coverage: true, readme: true, release: true }, dryRun: false }),
      ciArtifact: buildCiArtifactEvidenceInput({ version: 'V97', artifactName: 'release-check.json', jsonText: JSON.stringify({ tests: { passed: 1161, total: 1168, skipped: 7 }, coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.5, thresholdPct: 95 }, readme: { passed: 15, total: 15 }, build: { passed: true } }) }),
    });
    const snapshot = buildReleaseOperationsPersistenceSnapshot({ userId: 'operator-1', selectedTab: 'audit', panel, auditFilter: { status: 'delivered', ok: true }, now: '2026-06-24T08:00:00Z' });
    expect(snapshot.storageKey).toBe('ai-team:release-operations:v1');
    expect(snapshot.payload.selectedTab).toBe('audit');
    expect(snapshot.payload.panel.latestVersion).toBe('V97');
    expect(snapshot.serialized).toContain('operator-1');

    const ingestion = buildCiArtifactIngestionExecution({
      artifactPath: 'artifacts/release-check.json',
      artifactText: JSON.stringify({ tests: { passed: 1161, total: 1168, skipped: 7 }, coverage: { strictPassed: 16, strictTotal: 16, averageBranchPct: 98.5, thresholdPct: 95 }, readme: { passed: 15, total: 15 }, build: { passed: true } }),
      version: 'V97',
      outputPath: 'docs/delivery/ai-team-v97-release-evidence.json',
      dryRun: false,
    });
    expect(ingestion.ready).toBe(true);
    expect(ingestion.plan.commands[0]).not.toContain('--dry-run');
    expect(ingestion.write).toEqual({ path: 'docs/delivery/ai-team-v97-release-evidence.json', content: expect.stringContaining('"version": "V97"') });

    const ledger = buildProposalExecutionAuditLedger({
      proposalId: 'P-20260624-022',
      actor: '小墨',
      events: [
        { at: '2026-06-24T08:00:00Z', status: 'in_test_acceptance', command: 'npm run release:check', ok: true },
        { at: '2026-06-24T08:01:00Z', status: 'accepted', command: 'mcp status accepted', ok: true },
        { at: '2026-06-24T08:02:00Z', status: 'delivered', command: 'mcp status delivered', ok: false, note: 'retry' },
      ],
    });
    const filtered = filterProposalExecutionAuditTimeline(ledger, { status: 'delivered', ok: false, query: 'retry' });
    expect(filtered.total).toBe(1);
    expect(filtered.events[0]?.status).toBe('delivered');
    expect(filtered.markdown).toContain('retry');
  });

  it('covers blocked V95-V97 persistence, ingestion, and timeline branches', () => {
    const blockedIngestion = buildCiArtifactIngestionExecution({ artifactPath: '', artifactText: '{bad', version: '', outputPath: '', dryRun: true });
    expect(blockedIngestion.ready).toBe(false);
    expect(blockedIngestion.write).toBeUndefined();
    expect(blockedIngestion.issues).toContain('version is required');

    const emptySnapshot = buildReleaseOperationsPersistenceSnapshot({ userId: '', selectedTab: 'overview', panel: buildReleaseOperationsPanelModel({ entries: [], sideEffect: buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({ command: 'noop', before: [], after: [], allowedGlobs: [] })), autoDelivery: buildProposalAutoDeliveryExecution({ proposalId: 'P-0', currentStatus: 'delivered', reportPath: 'none', gates: { build: false, tests: false, coverage: false, readme: false, release: false }, dryRun: true }), ciArtifact: buildCiArtifactEvidenceInput({ version: 'VNext', artifactName: 'bad.json', jsonText: '{bad' }) }), auditFilter: {}, now: '2026-06-24T08:00:00Z' });
    expect(emptySnapshot.payload.userId).toBe('anonymous');
    expect(emptySnapshot.payload.selectedTab).toBe('overview');

    const ledger = buildProposalExecutionAuditLedger({ proposalId: 'P-20260624-023', actor: '小墨', events: [{ at: '2026-06-24T08:00:00Z', status: 'accepted', command: 'ok', ok: true }] });
    const none = filterProposalExecutionAuditTimeline(ledger, { status: 'delivered', query: 'missing' });
    expect(none.total).toBe(0);
    expect(none.markdown).toContain('No matching audit events');
  });

  it('covers V95-V97 dry-run ingestion and unfiltered audit timeline branches', () => {
    const dryRun = buildCiArtifactIngestionExecution({
      artifactPath: 'artifacts/release-check.json',
      artifactText: JSON.stringify({ tests: { passed: 3, total: 3, skipped: 0 }, coverage: { strictPassed: 1, strictTotal: 1, averageBranchPct: 100, thresholdPct: 95 }, readme: { passed: 1, total: 1 }, build: { passed: true } }),
      version: 'V98',
      outputPath: 'docs/delivery/ai-team-v98-release-evidence.json',
      dryRun: true,
    });
    expect(dryRun.ready).toBe(true);
    expect(dryRun.write).toBeUndefined();

    const ledger = buildProposalExecutionAuditLedger({
      proposalId: 'P-20260624-024',
      actor: '小墨',
      events: [
        { at: '2026-06-24T09:00:00Z', status: 'accepted', command: 'mcp accepted', ok: true },
        { at: '2026-06-24T09:01:00Z', status: 'deployed', command: 'mcp deployed', ok: true },
      ],
    });
    const all = filterProposalExecutionAuditTimeline(ledger, {});
    expect(all.total).toBe(2);
    expect(all.markdown).toContain('mcp deployed');
  });

  it('builds V98-V100 server records, upload bridges, and replay smoke gates', () => {
    const panel = buildReleaseOperationsPanelModel({
      entries: [{ version: 'V100', path: 'docs/delivery/v100.md', updatedAt: '2026-06-24T10:00:00Z', summary: buildDeliveryEvidenceSummary({ version: 'V100', tests: { passed: 1164, total: 1171, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.3, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true }, blockers: [] }) }],
      sideEffect: buildReleaseSideEffectVisualization(buildReleaseSideEffectGuard({ command: 'npm run release:check', before: [], after: [], allowedGlobs: [] })),
      autoDelivery: buildProposalAutoDeliveryExecution({ proposalId: 'P-20260624-024', currentStatus: 'in_test_acceptance', reportPath: 'docs/delivery/v100.md', gates: { build: true, tests: true, coverage: true, readme: true, release: true }, dryRun: true }),
      ciArtifact: buildCiArtifactEvidenceInput({ version: 'V100', artifactName: 'release-check.json', jsonText: JSON.stringify({ tests: { passed: 1164, total: 1171, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.3, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true } }) }),
    });
    const snapshot = buildReleaseOperationsPersistenceSnapshot({ userId: 'operator-2', selectedTab: 'artifacts', panel, auditFilter: { ok: true }, now: '2026-06-24T10:00:00Z' });
    const record = buildReleaseOperationsServerRecord({ userId: 'operator-2', snapshot, now: '2026-06-24T10:00:00Z' });
    expect(record.id).toBe('release_ops_operator-2_2026-06-24T10:00:00Z');
    expect(record.ready).toBe(true);

    const bridge = buildCiArtifactUploadBridge({
      artifactPath: 'artifacts/release-check.json',
      artifactText: JSON.stringify({ tests: { passed: 1164, total: 1171, skipped: 7 }, coverage: { strictPassed: 15, strictTotal: 15, averageBranchPct: 98.3, thresholdPct: 95 }, readme: { passed: 14, total: 14 }, build: { passed: true } }),
      version: 'V100',
      outputPath: 'docs/delivery/ai-team-v100-release-evidence.json',
      dryRun: false,
      uploadTarget: 'release-asset',
    });
    expect(bridge.ready).toBe(true);
    expect(bridge.commands.at(-1)).toContain('gh release upload v100');

    const gate = buildProposalAuditReplaySmokeGate({
      proposalId: 'P-20260624-024',
      actor: '小墨',
      expectedFinalStatus: 'delivered',
      events: [
        { at: '2026-06-24T10:00:00Z', status: 'in_test_acceptance', command: 'test', ok: true },
        { at: '2026-06-24T10:01:00Z', status: 'accepted', command: 'accept', ok: true },
        { at: '2026-06-24T10:02:00Z', status: 'deployed', command: 'deploy', ok: true },
        { at: '2026-06-24T10:03:00Z', status: 'delivered', command: 'deliver', ok: true },
      ],
    });
    expect(gate.ready).toBe(true);
    expect(gate.replayedStatuses).toEqual(['in_test_acceptance', 'accepted', 'deployed', 'delivered']);
    expect(gate.markdown).toContain('Issues: none');
  });

  it('covers V98-V100 blocked upload and replay branches', () => {
    const blockedBridge = buildCiArtifactUploadBridge({ artifactPath: '', artifactText: '{bad', version: '', outputPath: '', dryRun: true, uploadTarget: 'local-evidence' });
    expect(blockedBridge.ready).toBe(false);
    expect(blockedBridge.commands).toEqual([]);
    expect(blockedBridge.issues).toContain('ingestion execution is not ready');

    const blockedGate = buildProposalAuditReplaySmokeGate({
      proposalId: 'P-20260624-024',
      actor: '小墨',
      expectedFinalStatus: 'delivered',
      events: [{ at: '2026-06-24T10:00:00Z', status: 'accepted', command: 'accept', ok: false, note: 'failed' }],
    });
    expect(blockedGate.ready).toBe(false);
    expect(blockedGate.issues).toEqual(expect.arrayContaining(['audit ledger has 1 failed event(s)', 'expected final status delivered, got accepted']));

    const emptyGate = buildProposalAuditReplaySmokeGate({ proposalId: 'P-empty', actor: '小墨', expectedFinalStatus: 'delivered', events: [] });
    expect(emptyGate.issues).toContain('no audit events to replay');
    expect(emptyGate.timeline.total).toBe(0);
  });

  it('builds V101 release operations history snapshots sorted by newest delivery', () => {
    const history = buildReleaseOperationsHistorySnapshot([
      { version: 'V100', proposalId: 'P-20260624-024', updatedAt: '2026-06-24T10:00:00Z', ready: true, summary: 'V100 ready', evidencePath: 'docs/delivery/ai-team-v100-release-evidence.json' },
      { version: 'V101', proposalId: 'P-20260625-001', updatedAt: '2026-06-25T00:00:00Z', ready: false, summary: 'V101 blocked', evidencePath: 'docs/delivery/ai-team-v101-release-evidence.json' },
    ]);

    expect(history.storageKey).toBe('ai-team:release-operations-history:v1');
    expect(history.latestVersion).toBe('V101');
    expect(history.readyCount).toBe(1);
    expect(history.blockedCount).toBe(1);
    expect(history.entries.map((entry) => entry.version)).toEqual(['V101', 'V100']);
    expect(JSON.parse(history.serialized).latestVersion).toBe('V101');
  });

  it('covers V101 empty release operations history branch', () => {
    const history = buildReleaseOperationsHistorySnapshot([]);
    expect(history.latestVersion).toBe('none');
    expect(history.readyCount).toBe(0);
    expect(history.entries).toEqual([]);
  });

  it('builds V102 signed CI artifact provenance when all fields are valid', () => {
    const provenance = buildCiArtifactProvenance({
      version: 'V102',
      artifactName: 'release-check.json',
      artifactSha256: 'a'.repeat(64),
      commit: '7d7cf06',
      workflowRunId: '123456789',
      signer: 'github-actions',
      generatedAt: '2026-06-25T00:00:00Z',
    });

    expect(provenance.ready).toBe(true);
    expect(provenance.subject).toBe('release-check.json@aaaaaaaaaaaa');
    expect(provenance.issues).toEqual([]);
    expect(provenance.markdown).toContain('Issues: none');
  });

  it('covers V102 blocked provenance validation branches', () => {
    const provenance = buildCiArtifactProvenance({
      version: '',
      artifactName: '',
      artifactSha256: 'bad',
      commit: 'not-a-sha',
      workflowRunId: '',
      signer: '',
      generatedAt: '',
    });

    expect(provenance.ready).toBe(false);
    expect(provenance.subject).toBe('@bad');
    expect(provenance.issues).toEqual([
      'version is required',
      'artifactName is required',
      'artifactSha256 must be a 64-character hex digest',
      'commit must be a 7-40 character hex SHA',
      'workflowRunId is required',
      'signer is required',
      'generatedAt is required',
    ]);
  });

  it('builds V103 proposal replay visual diffs for added and removed statuses', () => {
    const diff = buildProposalReplayVisualDiff({
      proposalId: 'P-20260625-001',
      before: ['in_test_acceptance', 'accepted'],
      after: ['in_test_acceptance', 'accepted', 'deployed', 'delivered'],
    });

    expect(diff.changed).toBe(true);
    expect(diff.added).toEqual(['deployed', 'delivered']);
    expect(diff.removed).toEqual([]);
    expect(diff.steps.at(-1)?.state).toBe('added');
    expect(diff.markdown).toContain('| delivered | no | yes | added |');

    const removed = buildProposalReplayVisualDiff({ proposalId: 'P-20260625-001', before: ['accepted', 'deployed'], after: ['accepted'] });
    expect(removed.removed).toEqual(['deployed']);
    expect(removed.markdown).toContain('| deployed | yes | no | removed |');
  });

  it('covers V103 unchanged and empty replay visual diff branches', () => {
    const unchanged = buildProposalReplayVisualDiff({ proposalId: 'P-20260625-001', before: ['accepted'], after: ['accepted'] });
    expect(unchanged.changed).toBe(false);
    expect(unchanged.steps).toEqual([{ status: 'accepted', before: true, after: true, state: 'unchanged' }]);

    const empty = buildProposalReplayVisualDiff({ proposalId: 'P-empty', before: [], after: [] });
    expect(empty.changed).toBe(false);
    expect(empty.steps).toEqual([]);
    expect(empty.markdown).toContain('Changed: no');
  });
});
