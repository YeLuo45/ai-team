export interface DeliveryEvidenceInput {
  version: string;
  tests: { passed: number; total: number; skipped: number };
  coverage: { strictPassed: number; strictTotal: number; averageBranchPct: number; thresholdPct: number };
  readme: { passed: number; total: number };
  build: { passed: boolean; reason?: string };
  blockers: string[];
}

export interface DeliveryEvidenceSummary {
  ready: boolean;
  headline: string;
  testPassRatePct: number;
  coverageStatus: 'pass' | 'fail';
  readmeStatus: 'pass' | 'fail';
  buildStatus: 'pass' | 'fail';
  blockers: string[];
}

type CoverageCounter = Record<string, number | number[]>;

interface CoverageFileEntry {
  s: CoverageCounter;
  b: CoverageCounter;
  f: CoverageCounter;
}

export interface DynamicDeliveryEvidenceInput {
  version: string;
  rootDir: string;
  testOutput: string;
  readmeOutput: string;
  buildOutput: string;
  coverageFinal: Record<string, CoverageFileEntry>;
  strictLayers: Record<string, RegExp>;
  thresholdPct: number;
  blockers: string[];
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function countHits(map: CoverageCounter): { hit: number; total: number } {
  let hit = 0;
  let total = 0;
  for (const value of Object.values(map)) {
    if (Array.isArray(value)) {
      total += value.length;
      hit += value.filter((entry) => entry > 0).length;
    } else {
      total += 1;
      if (value > 0) hit += 1;
    }
  }
  return { hit, total };
}

function normalizePath(path: string, rootDir: string): string {
  const prefix = rootDir.endsWith('/') ? rootDir : `${rootDir}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function extractTests(output: string): DeliveryEvidenceInput['tests'] {
  const match = output.match(/Tests\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?\s+\((\d+)\)/);
  if (!match) return { passed: 0, total: 0, skipped: 0 };
  return {
    passed: Number(match[2]),
    total: Number(match[4]),
    skipped: Number(match[3] ?? 0),
  };
}

function extractReadme(output: string): DeliveryEvidenceInput['readme'] {
  const match = output.match(/README command checks:\s+(\d+)\/(\d+)\s+passed/);
  if (!match) return { passed: 0, total: 0 };
  return { passed: Number(match[1]), total: Number(match[2]) };
}

function extractBuild(output: string): DeliveryEvidenceInput['build'] {
  return /built|tsc|vite/i.test(output)
    ? { passed: true }
    : { passed: false, reason: 'missing build success marker' };
}

function strictCoverage(input: DynamicDeliveryEvidenceInput): DeliveryEvidenceInput['coverage'] {
  const layerStats = new Map<string, { hit: number; total: number }>();
  for (const layer of Object.keys(input.strictLayers)) layerStats.set(layer, { hit: 0, total: 0 });

  for (const [file, entry] of Object.entries(input.coverageFinal)) {
    const rel = normalizePath(file, input.rootDir);
    for (const [layer, pattern] of Object.entries(input.strictLayers)) {
      if (!pattern.test(rel)) continue;
      const branchHits = countHits(entry.b);
      const current = layerStats.get(layer)!;
      current.hit += branchHits.hit;
      current.total += branchHits.total;
    }
  }

  const branchPcts = Array.from(layerStats.values()).map((stats) => percent(stats.hit, stats.total));
  const strictPassed = branchPcts.filter((pct) => pct >= input.thresholdPct).length;
  const averageBranchPct = branchPcts.length === 0
    ? 0
    : Math.round((branchPcts.reduce((sum, pct) => sum + pct, 0) / branchPcts.length) * 100) / 100;
  return {
    strictPassed,
    strictTotal: branchPcts.length,
    averageBranchPct,
    thresholdPct: input.thresholdPct,
  };
}

export function buildDeliveryEvidenceInputFromReports(input: DynamicDeliveryEvidenceInput): DeliveryEvidenceInput {
  return {
    version: input.version,
    tests: extractTests(input.testOutput),
    coverage: strictCoverage(input),
    readme: extractReadme(input.readmeOutput),
    build: extractBuild(input.buildOutput),
    blockers: input.blockers,
  };
}

export function buildDeliveryEvidenceSummary(input: DeliveryEvidenceInput): DeliveryEvidenceSummary {
  const testPassRatePct = percent(input.tests.passed, input.tests.total - input.tests.skipped);
  const coverageStatus: 'pass' | 'fail' = input.coverage.strictPassed === input.coverage.strictTotal
    && input.coverage.averageBranchPct >= input.coverage.thresholdPct
    ? 'pass'
    : 'fail';
  const readmeStatus: 'pass' | 'fail' = input.readme.passed === input.readme.total ? 'pass' : 'fail';
  const buildStatus: 'pass' | 'fail' = input.build.passed ? 'pass' : 'fail';
  const blockers = [
    ...(testPassRatePct === 100 ? [] : [`test pass rate ${testPassRatePct}% below 100%`]),
    ...(coverageStatus === 'pass' ? [] : [`coverage strict layers ${input.coverage.strictPassed}/${input.coverage.strictTotal} below ${input.coverage.thresholdPct}%`]),
    ...(readmeStatus === 'pass' ? [] : [`README checks ${input.readme.passed}/${input.readme.total} passed`]),
    ...(buildStatus === 'pass' ? [] : [`build failed: ${input.build.reason ?? 'unspecified'}`]),
    ...input.blockers,
  ];
  const ready = blockers.length === 0;
  return {
    ready,
    headline: `${input.version} ${ready ? 'ready' : 'blocked'} — tests ${testPassRatePct}%, coverage ${input.coverage.averageBranchPct}%, README ${input.readme.passed}/${input.readme.total}`,
    testPassRatePct,
    coverageStatus,
    readmeStatus,
    buildStatus,
    blockers,
  };
}

export interface DeliveryReportInput {
  project: string;
  proposalId?: string;
  commit?: string;
  summary: DeliveryEvidenceSummary;
  changedFiles: string[];
  validationCommands: Array<{ command: string; result: string }>;
  nextDirections: string[];
}

export interface DeliveryReportIndexEntry {
  version: string;
  path: string;
  summary: DeliveryEvidenceSummary;
  updatedAt: string;
}

export interface DeliveryReportIndex {
  total: number;
  ready: number;
  latest?: DeliveryReportIndexEntry;
  entries: DeliveryReportIndexEntry[];
  markdown: string;
}

export interface ReleaseEvidenceDownloadInput {
  version: string;
  reportMarkdown: string;
  indexMarkdown: string;
  summary: DeliveryEvidenceSummary;
}

export interface ReleaseEvidenceDownload {
  filename: string;
  mimeType: 'application/json';
  payload: {
    version: string;
    generatedAt: string;
    summary: DeliveryEvidenceSummary;
    reportMarkdown: string;
    indexMarkdown: string;
  };
  serialized: string;
}

export type ProposalSyncStatus = 'intake' | 'clarifying' | 'prd_pending_confirmation' | 'approved_for_dev' | 'in_dev' | 'in_test_acceptance' | 'accepted' | 'deployed' | 'delivered';

export interface ProposalSyncPlanInput {
  proposalId: string;
  projectPath: string;
  deploymentUrl: string;
  reportPath: string;
  currentStatus: ProposalSyncStatus;
  targetStatus: ProposalSyncStatus;
  evidenceNote: string;
}

export interface ProposalSyncPlan {
  proposalId: string;
  statusPath: ProposalSyncStatus[];
  fieldArgs: string[];
  notes: string;
}

export function buildDeliveryReportMarkdown(input: DeliveryReportInput): string {
  const proposalLine = input.proposalId ? `**Proposal**: ${input.proposalId}` : '';
  const commitLine = input.commit ? `**Commit**: ${input.commit}` : '';
  const blockers = input.summary.blockers.length > 0
    ? input.summary.blockers.map((blocker) => `- ${blocker}`).join('\n')
    : '- none';
  const changedFiles = input.changedFiles.length > 0
    ? input.changedFiles.map((file) => `- ${file}`).join('\n')
    : '- none';
  const validations = input.validationCommands.length > 0
    ? input.validationCommands.map((item) => `- \`${item.command}\` — ${item.result}`).join('\n')
    : '- none';
  const directions = input.nextDirections.length > 0
    ? input.nextDirections.map((direction, index) => `${index + 1}. ${direction}`).join('\n')
    : '1. none';
  return [
    `# Delivery Report — ${input.project}`,
    '',
    `**Ready**: ${input.summary.ready ? 'yes' : 'no'}`,
    `**Headline**: ${input.summary.headline}`,
    proposalLine,
    commitLine,
    '',
    '## Validation',
    validations,
    '',
    '## Changed Files',
    changedFiles,
    '',
    '## Blockers',
    blockers,
    '',
    '## Next Directions',
    directions,
  ].filter((line, index, lines) => line.length > 0 || lines[index - 1] !== '').join('\n');
}

function deliveryVersionNumber(version: string): number {
  const match = version.match(/^V(\d+)$/i);
  return match ? Number(match[1]) : -1;
}

export function buildDeliveryReportIndex(entries: DeliveryReportIndexEntry[]): DeliveryReportIndex {
  const sorted = [...entries].sort((left, right) => {
    const byVersion = deliveryVersionNumber(right.version) - deliveryVersionNumber(left.version);
    return byVersion !== 0 ? byVersion : right.updatedAt.localeCompare(left.updatedAt);
  });
  const latest = sorted[0];
  const ready = sorted.filter((entry) => entry.summary.ready).length;
  const rows = sorted.map((entry) => [
    entry.version,
    entry.summary.ready ? 'ready' : 'blocked',
    `${entry.summary.testPassRatePct}%`,
    `${entry.summary.coverageStatus === 'pass' ? entry.summary.headline.match(/coverage ([\d.]+)%/)?.[1] ?? '0' : '0'}%`,
    entry.summary.headline.match(/README (\d+\/\d+)/)?.[1] ?? '0/0',
    `\`${entry.path}\``,
  ]);
  const markdown = [
    '# Delivery Reports Index',
    '',
    `Total: ${sorted.length}`,
    `Ready: ${ready}`,
    latest ? `Latest: ${latest.version}` : 'Latest: none',
    '',
    '| Version | Status | Tests | Coverage | README | Path |',
    '|---|---|---:|---:|---:|---|',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
  return { total: sorted.length, ready, latest, entries: sorted, markdown };
}

export function buildReleaseEvidenceDownload(input: ReleaseEvidenceDownloadInput): ReleaseEvidenceDownload {
  const versionSlug = input.version.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const payload = {
    version: input.version,
    generatedAt: '1970-01-01T00:00:00.000Z',
    summary: input.summary,
    reportMarkdown: input.reportMarkdown,
    indexMarkdown: input.indexMarkdown,
  };
  return {
    filename: `ai-team-${versionSlug}-release-evidence.json`,
    mimeType: 'application/json',
    payload,
    serialized: JSON.stringify(payload, null, 2),
  };
}

export function buildProposalSyncPlan(input: ProposalSyncPlanInput): ProposalSyncPlan {
  const statuses: ProposalSyncStatus[] = ['intake', 'clarifying', 'prd_pending_confirmation', 'approved_for_dev', 'in_dev', 'in_test_acceptance', 'accepted', 'deployed', 'delivered'];
  const currentIndex = statuses.indexOf(input.currentStatus);
  const targetIndex = statuses.indexOf(input.targetStatus);
  const statusPath = targetIndex > currentIndex ? statuses.slice(currentIndex + 1, targetIndex + 1) : [];
  const notes = `${input.evidenceNote}; report: ${input.reportPath}`;
  return {
    proposalId: input.proposalId,
    statusPath,
    fieldArgs: [
      '--proposal-id', input.proposalId,
      '--project-path', input.projectPath,
      '--deployment-url', input.deploymentUrl,
      '--notes', notes,
    ],
    notes,
  };
}
