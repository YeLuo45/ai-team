// V51-V52: delivery summary evidence contract
import { describe, expect, it } from 'vitest';
import {
  buildDeliveryEvidenceSummary,
  buildDeliveryEvidenceInputFromReports,
  buildDeliveryReportMarkdown,
  buildDeliveryReportIndex,
  buildReleaseEvidenceDownload,
  buildProposalSyncPlan,
} from '../src/team-orchestration.js';

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
