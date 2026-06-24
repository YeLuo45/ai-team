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

export type DeliveryGateKind = 'build' | 'tests' | 'coverage' | 'readme' | 'release';

export interface DeliveryReportFilter {
  versionText?: string;
  status?: 'ready' | 'blocked' | 'all';
  from?: string;
  to?: string;
  gate?: DeliveryGateKind;
}

export interface ParsedReleaseEvidence {
  version: string;
  summary: DeliveryEvidenceSummary;
  reportMarkdown: string;
  indexMarkdown: string;
}

export interface ReleaseEvidenceParseResult {
  evidence?: ParsedReleaseEvidence;
  issues: string[];
}

export interface ProposalDeliveryWizardInput extends ProposalSyncPlanInput {}

export interface ProposalDeliveryWizard {
  warning: string;
  commands: string[];
}

export interface ReleaseDashboardCard {
  label: 'Build' | 'Tests' | 'Coverage' | 'README' | 'Release';
  status: 'ready' | 'blocked';
  detail: string;
}

export interface ReleaseReadinessDashboard {
  total: number;
  readyCount: number;
  blockedCount: number;
  cards: ReleaseDashboardCard[];
  latest?: DeliveryReportIndexEntry;
}

export interface ChangedFileClassification {
  source: string[];
  tests: string[];
  docs: string[];
  generated: string[];
  scripts: string[];
  other: string[];
}

export interface ReleaseSideEffectGuardInput {
  command: string;
  before: string[];
  after: string[];
  allowedGlobs: string[];
}

export interface ReleaseSideEffectGuard {
  ready: boolean;
  command: string;
  allowed: string[];
  unexpected: string[];
  summary: string;
}

export interface ReleaseSideEffectVisualizationRow {
  kind: 'allowed' | 'blocked';
  path: string;
}

export interface ReleaseSideEffectVisualization {
  status: 'clean' | 'allowed' | 'blocked';
  rows: ReleaseSideEffectVisualizationRow[];
  markdown: string;
}

export interface ProposalAutoDeliveryExecutionInput {
  proposalId: string;
  currentStatus: ProposalSyncStatus;
  reportPath: string;
  gates: Record<'build' | 'tests' | 'coverage' | 'readme' | 'release', boolean>;
  dryRun: boolean;
}

export interface ProposalAutoDeliveryCommand {
  status: ProposalSyncStatus;
  command: string;
  mutates: boolean;
}

export interface ProposalAutoDeliveryExecution {
  ready: boolean;
  commands: ProposalAutoDeliveryCommand[];
  summary: string;
}

export interface CiArtifactEvidenceInput {
  version: string;
  artifactName: string;
  jsonText: string;
}

export interface CiArtifactEvidenceResult {
  artifactName: string;
  summary: DeliveryEvidenceSummary;
  evidence: DeliveryEvidenceInput;
  issues: string[];
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

function cleanStatusPath(line: string): string {
  return line.replace(/^..\s+/, '').trim();
}

function globAllows(path: string, glob: string): boolean {
  if (glob.endsWith('/**')) return path.startsWith(glob.slice(0, -3));
  if (glob.endsWith('*')) return path.startsWith(glob.slice(0, -1));
  return path === glob;
}

export function buildReleaseSideEffectGuard(input: ReleaseSideEffectGuardInput): ReleaseSideEffectGuard {
  const before = new Set(input.before.map(cleanStatusPath).filter(Boolean));
  const newPaths = input.after
    .map(cleanStatusPath)
    .filter((path) => path.length > 0 && !before.has(path));
  const allowed = newPaths.filter((path) => input.allowedGlobs.some((glob) => globAllows(path, glob))).sort();
  const unexpected = newPaths.filter((path) => !input.allowedGlobs.some((glob) => globAllows(path, glob))).sort();
  const summary = unexpected.length > 0
    ? `${input.command}: blocked ${unexpected.length} unexpected side effect(s)`
    : newPaths.length === 0
      ? `${input.command}: no new side effects`
      : `${input.command}: ${allowed.length} allowed side effect(s)`;
  return { ready: unexpected.length === 0, command: input.command, allowed, unexpected, summary };
}

export function buildReleaseSideEffectVisualization(guard: ReleaseSideEffectGuard): ReleaseSideEffectVisualization {
  const rows: ReleaseSideEffectVisualizationRow[] = [
    ...guard.allowed.map((path) => ({ kind: 'allowed' as const, path })),
    ...guard.unexpected.map((path) => ({ kind: 'blocked' as const, path })),
  ];
  const status = guard.unexpected.length > 0 ? 'blocked' : rows.length > 0 ? 'allowed' : 'clean';
  const markdown = rows.length === 0
    ? `# Release Side Effects\n\n${guard.command}: clean`
    : ['# Release Side Effects', '', `Status: ${status}`, '', ...rows.map((row) => `- ${row.kind}: ${row.path}`)].join('\n');
  return { status, rows, markdown };
}

export function buildProposalAutoDeliveryExecution(input: ProposalAutoDeliveryExecutionInput): ProposalAutoDeliveryExecution {
  const failed = Object.entries(input.gates)
    .filter(([, ready]) => !ready)
    .map(([gate]) => `${gate} gate is not green`);
  if (failed.length > 0) return { ready: false, commands: [], summary: failed.join('; ') };
  const recovery = planProposalStatusRecovery({ proposalId: input.proposalId, currentStatus: input.currentStatus, targetStatus: 'delivered' });
  const commands = recovery.statusPath.map((status) => ({
    status,
    command: `mcp_aisp.py update-proposal-status --proposal-id ${input.proposalId} --status ${status}`,
    mutates: !input.dryRun,
  }));
  const mode = input.dryRun ? 'dry-run' : 'will execute';
  return {
    ready: true,
    commands,
    summary: `${mode} ${commands.length} proposal transition(s) after ${input.reportPath}`,
  };
}

function fallbackEvidence(version: string, issue: string): DeliveryEvidenceInput {
  return {
    version,
    tests: { passed: 0, total: 0, skipped: 0 },
    coverage: { strictPassed: 0, strictTotal: 1, averageBranchPct: 0, thresholdPct: 95 },
    readme: { passed: 0, total: 1 },
    build: { passed: false, reason: issue },
    blockers: [issue],
  };
}

export function buildCiArtifactEvidenceInput(input: CiArtifactEvidenceInput): CiArtifactEvidenceResult {
  try {
    const parsed = JSON.parse(input.jsonText) as Partial<DeliveryEvidenceInput>;
    const evidence: DeliveryEvidenceInput = {
      version: input.version,
      tests: parsed.tests ?? { passed: 0, total: 0, skipped: 0 },
      coverage: parsed.coverage ?? { strictPassed: 0, strictTotal: 1, averageBranchPct: 0, thresholdPct: 95 },
      readme: parsed.readme ?? { passed: 0, total: 1 },
      build: parsed.build ?? { passed: false, reason: 'missing build artifact' },
      blockers: parsed.blockers ?? [],
    };
    return { artifactName: input.artifactName, evidence, summary: buildDeliveryEvidenceSummary(evidence), issues: [] };
  } catch (error) {
    const issue = `invalid CI artifact JSON: ${error instanceof Error ? error.message : String(error)}`;
    const evidence = fallbackEvidence(input.version, issue);
    return { artifactName: input.artifactName, evidence, summary: buildDeliveryEvidenceSummary(evidence), issues: [issue] };
  }
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

function gatePasses(summary: DeliveryEvidenceSummary, gate?: DeliveryGateKind): boolean {
  if (!gate) return true;
  if (gate === 'build') return summary.buildStatus === 'pass';
  if (gate === 'tests') return summary.testPassRatePct === 100;
  if (gate === 'coverage') return summary.coverageStatus === 'pass';
  if (gate === 'readme') return summary.readmeStatus === 'pass';
  return summary.ready;
}

export function filterDeliveryReportEntries(entries: DeliveryReportIndexEntry[], filter: DeliveryReportFilter): DeliveryReportIndexEntry[] {
  return entries.filter((entry) => {
    if (filter.versionText && !entry.version.toLowerCase().includes(filter.versionText.toLowerCase())) return false;
    if (filter.status === 'ready' && !entry.summary.ready) return false;
    if (filter.status === 'blocked' && entry.summary.ready) return false;
    if (filter.from && entry.updatedAt < filter.from) return false;
    if (filter.to && entry.updatedAt > filter.to) return false;
    if (!filter.gate) return true;
    const passed = gatePasses(entry.summary, filter.gate);
    return filter.status === 'blocked' ? !passed : passed;
  });
}

function isSummary(value: unknown): value is DeliveryEvidenceSummary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DeliveryEvidenceSummary>;
  return typeof candidate.ready === 'boolean'
    && typeof candidate.headline === 'string'
    && Array.isArray(candidate.blockers);
}

export function parseReleaseEvidenceJson(text: string, source = 'release-evidence.json'): ReleaseEvidenceParseResult {
  try {
    const data = JSON.parse(text) as Partial<ParsedReleaseEvidence>;
    if (typeof data.version !== 'string') return { issues: [`${source}: version must be a string`] };
    if (!isSummary(data.summary)) return { issues: [`${source}: summary is missing ready/headline/blockers`] };
    if (typeof data.reportMarkdown !== 'string') return { issues: [`${source}: reportMarkdown must be a string`] };
    if (typeof data.indexMarkdown !== 'string') return { issues: [`${source}: indexMarkdown must be a string`] };
    return { evidence: { version: data.version, summary: data.summary, reportMarkdown: data.reportMarkdown, indexMarkdown: data.indexMarkdown }, issues: [] };
  } catch (error) {
    return { issues: [`${source}: invalid JSON (${error instanceof Error ? error.message : String(error)})`] };
  }
}

export function buildProposalDeliveryWizard(input: ProposalDeliveryWizardInput): ProposalDeliveryWizard {
  const plan = buildProposalSyncPlan(input);
  const base = 'python3 /home/hermes/superpower-clockless/src/superpower_clockless/templates/skills/prj-proposals-manager/scripts/mcp_aisp.py';
  const fieldCommand = `${base} update-proposal-fields ${plan.fieldArgs.join(' ')}`;
  const statusCommands = plan.statusPath.map((status) => `${base} update-proposal-status --proposal-id ${input.proposalId} --status ${status}`);
  return {
    warning: 'update-proposal-fields can reset status; run field update before final status walk, then verify persisted status.',
    commands: [fieldCommand, `${base} list-proposals --search ${input.proposalId}`, ...statusCommands],
  };
}

export function buildGateFailureHints(summary: DeliveryEvidenceSummary): string[] {
  const hints: string[] = [];
  if (summary.buildStatus === 'fail') hints.push('Run npm run build and inspect TypeScript/Vite output.');
  if (summary.testPassRatePct < 100) hints.push('Run npm test and fix failing tests before release.');
  if (summary.coverageStatus === 'fail') hints.push('Run npm run test:coverage:incremental and inspect strict layer failures.');
  if (summary.readmeStatus === 'fail') hints.push('Run npm run verify:readme and sync expected command evidence.');
  if (!summary.ready) hints.push('Resolve blockers before updating proposal status to delivered.');
  return hints;
}

export function buildReleaseReadinessDashboard(entries: DeliveryReportIndexEntry[]): ReleaseReadinessDashboard {
  const index = buildDeliveryReportIndex(entries);
  const latest = index.latest;
  const summary = latest?.summary;
  const cards: ReleaseDashboardCard[] = [
    { label: 'Build', status: summary?.buildStatus === 'pass' ? 'ready' : 'blocked', detail: summary?.buildStatus ?? 'missing' },
    { label: 'Tests', status: summary && summary.testPassRatePct === 100 ? 'ready' : 'blocked', detail: `${summary?.testPassRatePct ?? 0}%` },
    { label: 'Coverage', status: summary?.coverageStatus === 'pass' ? 'ready' : 'blocked', detail: summary?.coverageStatus ?? 'missing' },
    { label: 'README', status: summary?.readmeStatus === 'pass' ? 'ready' : 'blocked', detail: summary?.readmeStatus ?? 'missing' },
    { label: 'Release', status: summary?.ready ? 'ready' : 'blocked', detail: summary?.headline ?? 'no evidence' },
  ];
  return { total: index.total, readyCount: index.ready, blockedCount: index.total - index.ready, cards, latest };
}

function cleanStatusPrefix(line: string): string {
  return line.replace(/^\s*(?:M|A|D|R|C|\?\?)\s+/, '').trim();
}

export function classifyChangedFiles(lines: string[]): ChangedFileClassification {
  const out: ChangedFileClassification = { source: [], tests: [], docs: [], generated: [], scripts: [], other: [] };
  for (const line of lines) {
    const file = cleanStatusPrefix(line);
    if (file.length === 0) continue;
    if (file.includes('/test/') || file.includes('.test.')) out.tests.push(file);
    else if (file.includes('/public/data/') || file.endsWith('-release-evidence.json')) out.generated.push(file);
    else if (file.startsWith('docs/') || file.startsWith('README')) out.docs.push(file);
    else if (file.startsWith('scripts/')) out.scripts.push(file);
    else if (file.includes('/src/')) out.source.push(file);
    else out.other.push(file);
  }
  return out;
}

export interface BrowserEvidenceDownloadIntent {
  filename: string;
  mimeType: 'application/json';
  serialized: string;
  objectUrl: string;
  revokeAfterClick: boolean;
}

export interface ProposalDryRunStep {
  kind: 'fields' | 'status' | 'verify';
  command: string;
  status?: ProposalSyncStatus;
}

export interface ProposalDryRunResult {
  mutates: false;
  steps: ProposalDryRunStep[];
  riskWarnings: string[];
}

export interface CockpitPersistenceInput {
  selectedVersion?: string;
  filters: DeliveryReportFilter;
  importedEvidence: string[];
  diffText: string;
}

export interface CockpitPersistenceSnapshot {
  storageKey: 'ai-team:delivery-cockpit:v1';
  payload: CockpitPersistenceInput;
  serialized: string;
}

export interface DiffOwnershipAudit {
  total: number;
  classification: ChangedFileClassification;
  safeAddCommands: string[];
  warnings: string[];
}

export interface VersionedReleaseEvidence extends ParsedReleaseEvidence {
  schemaVersion: number;
}

export interface VersionedReleaseEvidenceParseResult {
  evidence?: VersionedReleaseEvidence;
  migrated: boolean;
  issues: string[];
}

export interface ProposalDeliveryChecklistInput {
  proposalId: string;
  reportPath: string;
  gates: Record<'tests' | 'coverage' | 'readme' | 'build', boolean>;
  dryRun: ProposalDryRunResult;
}

export interface ProposalDeliveryChecklistItem {
  label: 'tests' | 'coverage' | 'readme' | 'build' | 'accepted' | 'deployed' | 'delivered';
  done: boolean;
  detail: string;
}

export interface ProposalDeliveryChecklist {
  proposalId: string;
  reportPath: string;
  ready: boolean;
  items: ProposalDeliveryChecklistItem[];
}

export interface ProposalExecuteWithConfirmInput {
  dryRun: ProposalDryRunResult;
  confirmText: string;
}

export interface ProposalExecuteWithConfirmPlan {
  requiredPhrase: string;
  readyToExecute: boolean;
  commands: string[];
  warnings: string[];
}

export interface CockpitServerRecordInput {
  userId: string;
  snapshot: CockpitPersistenceSnapshot;
  now: string;
}

export interface CockpitServerRecord {
  id: string;
  userId: string;
  snapshot: CockpitPersistenceSnapshot;
  updatedAt: string;
}

export interface ReleaseEvidenceMigrationResult {
  evidence?: VersionedReleaseEvidence;
  fromSchemaVersion?: number;
  changed: boolean;
  serialized: string;
  issues: string[];
}

export interface ProposalExecutableCommand {
  kind: ProposalDryRunStep['kind'];
  command: string;
  status?: ProposalSyncStatus;
  mutates: boolean;
}

export interface ProposalExecutionPlan {
  ready: boolean;
  requiredPhrase: string;
  commands: ProposalExecutableCommand[];
  warnings: string[];
}

export interface CockpitWebRestoreModel {
  canRestore: boolean;
  restoreButtonLabel: string;
  selectedVersion?: string;
  filters: DeliveryReportFilter;
  importedEvidence: string[];
  diffText: string;
}

export interface ReleaseEvidenceBatchItem {
  path: string;
  status: 'migrated' | 'current' | 'invalid';
  version?: string;
  schemaVersion?: number;
  issues: string[];
  writeBack?: string;
}

export interface ReleaseEvidenceBatchAudit {
  total: number;
  migrated: number;
  current: number;
  invalid: number;
  items: ReleaseEvidenceBatchItem[];
}

export interface ReleaseEvidenceQualityGateInput {
  expectedProposalId: string;
  expectedReadme: string;
  expectedCoverage: string;
  requireUncommittedLabel?: boolean;
  evidence: VersionedReleaseEvidence;
}

export interface ReleaseEvidenceQualityGate {
  ready: boolean;
  evidence: VersionedReleaseEvidence;
  issues: string[];
}

export interface NextDeliveryDirectionInput {
  latestVersion: string;
  qualityGateReady: boolean;
  audit: DiffOwnershipAudit;
  batchAudit: ReleaseEvidenceBatchAudit;
}

export interface UnattendedDeliveryBatchPlanInput {
  currentVersion: string;
  proposalId: string;
  directions: string[];
  gates: Record<'build' | 'tests' | 'coverage' | 'readme', boolean>;
  dirtyFiles: string[];
}

export interface UnattendedDeliveryBatchPlan {
  proposalId: string;
  ready: boolean;
  versionRange: string;
  nextProposalTitle: string;
  requiredGates: Array<'build' | 'tests' | 'coverage' | 'readme'>;
  safeAddCommands: string[];
  blockers: string[];
}

export interface UnattendedBatchRunnerInput {
  proposalId: string;
  versionRange: string;
  gates: Record<'build' | 'tests' | 'coverage' | 'readme', boolean>;
  reportPath: string;
}

export interface UnattendedBatchRunnerStep {
  kind: 'build' | 'tests' | 'coverage' | 'readme' | 'report' | 'proposal';
  command: string;
  ready: boolean;
}

export interface UnattendedBatchRunner {
  ready: boolean;
  steps: UnattendedBatchRunnerStep[];
  blockers: string[];
}

export interface ProposalStatusRecoveryInput {
  proposalId: string;
  currentStatus: ProposalSyncStatus;
  targetStatus: ProposalSyncStatus;
}

export interface ProposalStatusRecoveryPlan {
  recoverable: boolean;
  statusPath: ProposalSyncStatus[];
  commands: string[];
}

export interface EvidenceTrendDashboard {
  latestVersion: string;
  previousVersion?: string;
  coverageDelta: number;
  readmeStable: boolean;
  recommendation: string;
}

export interface ReleaseOperationsPanelCard {
  label: 'Latest' | 'Side Effects' | 'Auto Delivery' | 'CI Artifact';
  status: 'ready' | 'blocked';
  detail: string;
}

export interface ReleaseOperationsPanelInput {
  entries: DeliveryReportIndexEntry[];
  sideEffect: ReleaseSideEffectVisualization;
  autoDelivery: ProposalAutoDeliveryExecution;
  ciArtifact: CiArtifactEvidenceResult;
}

export interface ReleaseOperationsPanelModel {
  ready: boolean;
  latestVersion: string;
  cards: ReleaseOperationsPanelCard[];
  markdown: string;
}

export interface CiArtifactImportCommandPlanInput {
  artifactPath: string;
  version: string;
  outputPath: string;
  dryRun: boolean;
}

export interface CiArtifactImportCommandPlan {
  ready: boolean;
  commands: string[];
  issues: string[];
}

export interface ProposalExecutionAuditEvent {
  at: string;
  status: ProposalSyncStatus;
  command: string;
  ok: boolean;
  note?: string;
}

export interface ProposalExecutionAuditLedgerInput {
  proposalId: string;
  actor: string;
  events: ProposalExecutionAuditEvent[];
}

export interface ProposalExecutionAuditLedger {
  ready: boolean;
  proposalId: string;
  actor: string;
  okCount: number;
  total: number;
  statusPath: ProposalSyncStatus[];
  summary: string;
  markdown: string;
}

export interface ReleaseOperationsAuditFilter {
  status?: ProposalSyncStatus;
  ok?: boolean;
  query?: string;
}

export interface ReleaseOperationsPersistenceInput {
  userId: string;
  selectedTab: 'overview' | 'artifacts' | 'audit';
  panel: ReleaseOperationsPanelModel;
  auditFilter: ReleaseOperationsAuditFilter;
  now: string;
}

export interface ReleaseOperationsPersistenceSnapshot {
  storageKey: 'ai-team:release-operations:v1';
  payload: {
    userId: string;
    selectedTab: 'overview' | 'artifacts' | 'audit';
    panel: ReleaseOperationsPanelModel;
    auditFilter: ReleaseOperationsAuditFilter;
    updatedAt: string;
  };
  serialized: string;
}

export interface CiArtifactIngestionExecutionInput extends CiArtifactImportCommandPlanInput {
  artifactText: string;
}

export interface CiArtifactIngestionExecution {
  ready: boolean;
  plan: CiArtifactImportCommandPlan;
  evidence: CiArtifactEvidenceResult;
  write?: { path: string; content: string };
  issues: string[];
}

export interface ProposalExecutionAuditTimeline {
  total: number;
  events: ProposalExecutionAuditEvent[];
  markdown: string;
}

export function buildBrowserEvidenceDownloadIntent(download: ReleaseEvidenceDownload, options: { objectUrl: string }): BrowserEvidenceDownloadIntent {
  const parsed = JSON.parse(download.serialized) as Record<string, unknown>;
  const serialized = JSON.stringify({ schemaVersion: 2, ...parsed }, null, 2);
  return {
    filename: download.filename,
    mimeType: download.mimeType,
    serialized,
    objectUrl: options.objectUrl,
    revokeAfterClick: true,
  };
}

export function executeProposalDryRun(wizard: ProposalDeliveryWizard): ProposalDryRunResult {
  const steps = wizard.commands
    .map((command): ProposalDryRunStep | undefined => {
      const status = command.match(/--status\s+(\w+)/)?.[1] as ProposalSyncStatus | undefined;
      if (command.includes('update-proposal-fields')) return { kind: 'fields', command };
      if (status) return { kind: 'status', command, status };
      return undefined;
    })
    .filter((step): step is ProposalDryRunStep => Boolean(step));
  return {
    mutates: false,
    steps,
    riskWarnings: ['DRY RUN ONLY: commands are not executed.', wizard.warning],
  };
}

export function buildCockpitPersistenceSnapshot(input: CockpitPersistenceInput): CockpitPersistenceSnapshot {
  const payload: CockpitPersistenceInput = {
    ...input,
    importedEvidence: input.importedEvidence.slice(-3),
  };
  return {
    storageKey: 'ai-team:delivery-cockpit:v1',
    payload,
    serialized: JSON.stringify(payload),
  };
}

function buildGitAddCommand(files: string[]): string | undefined {
  return files.length > 0 ? `git add ${files.join(' ')}` : undefined;
}

export function buildDiffOwnershipAudit(lines: string[]): DiffOwnershipAudit {
  const classification = classifyChangedFiles(lines);
  const sourceAndTests = [...classification.source, ...classification.tests];
  const docsAndGenerated = [...classification.docs, ...classification.generated];
  const safeAddCommands = [buildGitAddCommand(sourceAndTests), buildGitAddCommand(docsAndGenerated), buildGitAddCommand(classification.scripts)]
    .filter((command): command is string => Boolean(command));
  const warnings = classification.other.length > 0 ? [`Review ${classification.other.length} other file(s) before staging.`] : [];
  return { total: lines.filter((line) => cleanStatusPrefix(line).length > 0).length, classification, safeAddCommands, warnings };
}

export function parseVersionedReleaseEvidenceJson(text: string, source = 'release-evidence.json'): VersionedReleaseEvidenceParseResult {
  try {
    const raw = JSON.parse(text) as Partial<VersionedReleaseEvidence>;
    const schemaVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
    const parsed = parseReleaseEvidenceJson(JSON.stringify(raw), source);
    if (!parsed.evidence) return { migrated: false, issues: parsed.issues };
    return {
      evidence: { schemaVersion, ...parsed.evidence },
      migrated: schemaVersion === 1 && raw.schemaVersion === undefined,
      issues: [],
    };
  } catch (error) {
    return { migrated: false, issues: [`${source}: invalid JSON (${error instanceof Error ? error.message : String(error)})`] };
  }
}

export function buildProposalDeliveryChecklist(input: ProposalDeliveryChecklistInput): ProposalDeliveryChecklist {
  const statusSet = new Set(input.dryRun.steps.map((step) => step.status).filter((status): status is ProposalSyncStatus => Boolean(status)));
  const items: ProposalDeliveryChecklistItem[] = [
    { label: 'tests', done: input.gates.tests, detail: 'npm test must pass 100%' },
    { label: 'coverage', done: input.gates.coverage, detail: 'incremental coverage strict layers must pass' },
    { label: 'readme', done: input.gates.readme, detail: 'README verifier must pass' },
    { label: 'build', done: input.gates.build, detail: 'build must pass' },
    { label: 'accepted', done: statusSet.has('accepted'), detail: 'proposal status walk includes accepted' },
    { label: 'deployed', done: statusSet.has('deployed'), detail: 'proposal status walk includes deployed' },
    { label: 'delivered', done: statusSet.has('delivered'), detail: 'proposal status walk includes delivered' },
  ];
  return { proposalId: input.proposalId, reportPath: input.reportPath, ready: items.every((item) => item.done), items };
}

function proposalIdFromDryRun(dryRun: ProposalDryRunResult): string {
  const command = dryRun.steps[0]?.command ?? '';
  return command.match(/--proposal-id\s+(P-\d{8}-\d{3})/)?.[1] ?? 'UNKNOWN';
}

export function planProposalExecuteWithConfirm(input: ProposalExecuteWithConfirmInput): ProposalExecuteWithConfirmPlan {
  const proposalId = proposalIdFromDryRun(input.dryRun);
  const requiredPhrase = `EXECUTE ${proposalId}`;
  const readyToExecute = input.confirmText === requiredPhrase;
  return {
    requiredPhrase,
    readyToExecute,
    commands: readyToExecute ? input.dryRun.steps.map((step) => step.command) : [],
    warnings: readyToExecute ? input.dryRun.riskWarnings : [`Confirmation phrase must be exactly: ${requiredPhrase}`],
  };
}

export function buildCockpitServerRecord(input: CockpitServerRecordInput): CockpitServerRecord {
  return {
    id: `cockpit_${input.userId}_${input.now}`,
    userId: input.userId,
    snapshot: input.snapshot,
    updatedAt: input.now,
  };
}

export function migrateReleaseEvidencePayload(text: string): ReleaseEvidenceMigrationResult {
  const parsed = parseVersionedReleaseEvidenceJson(text, 'release-evidence-migration');
  if (!parsed.evidence) return { changed: false, serialized: '', issues: parsed.issues };
  const fromSchemaVersion = parsed.evidence.schemaVersion;
  const evidence: VersionedReleaseEvidence = { ...parsed.evidence, schemaVersion: 2 };
  return {
    evidence,
    fromSchemaVersion,
    changed: fromSchemaVersion !== 2,
    serialized: JSON.stringify(evidence, null, 2),
    issues: [],
  };
}

export function buildProposalExecutionPlan(input: ProposalExecuteWithConfirmInput): ProposalExecutionPlan {
  const gated = planProposalExecuteWithConfirm(input);
  return {
    ready: gated.readyToExecute,
    requiredPhrase: gated.requiredPhrase,
    warnings: gated.warnings,
    commands: gated.readyToExecute
      ? input.dryRun.steps.map((step) => ({ ...step, mutates: step.kind === 'fields' || step.kind === 'status' }))
      : [],
  };
}

export function buildCockpitWebRestoreModel(input: { records: CockpitServerRecord[]; userId: string }): CockpitWebRestoreModel {
  const record = [...input.records]
    .filter((item) => item.userId === input.userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (!record) {
    return { canRestore: false, restoreButtonLabel: 'No saved cockpit', filters: {}, importedEvidence: [], diffText: '' };
  }
  const payload = record.snapshot.payload;
  return {
    canRestore: true,
    restoreButtonLabel: `Restore ${payload.selectedVersion ?? 'saved'} cockpit`,
    selectedVersion: payload.selectedVersion,
    filters: payload.filters,
    importedEvidence: payload.importedEvidence,
    diffText: payload.diffText,
  };
}

export function auditReleaseEvidenceBatch(entries: Array<{ path: string; text: string }>): ReleaseEvidenceBatchAudit {
  const items = entries.map((entry): ReleaseEvidenceBatchItem => {
    const result = migrateReleaseEvidencePayload(entry.text);
    if (!result.evidence) return { path: entry.path, status: 'invalid', issues: result.issues };
    const status: ReleaseEvidenceBatchItem['status'] = result.changed ? 'migrated' : 'current';
    return {
      path: entry.path,
      status,
      version: result.evidence.version,
      schemaVersion: result.evidence.schemaVersion,
      issues: [],
      ...(result.changed ? { writeBack: result.serialized } : {}),
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
  return {
    total: items.length,
    migrated: items.filter((item) => item.status === 'migrated').length,
    current: items.filter((item) => item.status === 'current').length,
    invalid: items.filter((item) => item.status === 'invalid').length,
    items,
  };
}

export function buildReleaseEvidenceQualityGate(input: ReleaseEvidenceQualityGateInput): ReleaseEvidenceQualityGate {
  const issues: string[] = [];
  if (input.evidence.schemaVersion !== 2) issues.push('schemaVersion must be 2');
  if (!input.evidence.reportMarkdown.includes(input.expectedProposalId)) issues.push(`report missing proposal ${input.expectedProposalId}`);
  if (!input.evidence.reportMarkdown.includes(input.expectedReadme) || !input.evidence.indexMarkdown.includes(input.expectedReadme)) {
    issues.push(`README evidence must include ${input.expectedReadme}`);
  }
  if (!input.evidence.reportMarkdown.includes(input.expectedCoverage) || !input.evidence.indexMarkdown.includes(input.expectedCoverage)) {
    issues.push(`coverage evidence must include ${input.expectedCoverage}`);
  }
  if (input.requireUncommittedLabel && !input.evidence.reportMarkdown.includes('uncommitted (local working tree)')) {
    issues.push('uncommitted delivery report must label local working tree');
  }
  if (!input.evidence.summary.ready) issues.push('summary is not ready');
  return { ready: issues.length === 0, evidence: input.evidence, issues };
}

function nextVersionRange(latestVersion: string, span = 3): string {
  const latest = deliveryVersionNumber(latestVersion);
  if (latest < 0) return 'VNext';
  return `V${latest + 1}-V${latest + span}`;
}

export function buildUnattendedDeliveryBatchPlan(input: UnattendedDeliveryBatchPlanInput): UnattendedDeliveryBatchPlan {
  const requiredGates: UnattendedDeliveryBatchPlan['requiredGates'] = ['build', 'tests', 'coverage', 'readme'];
  const blockers = requiredGates
    .filter((gate) => !input.gates[gate])
    .map((gate) => `${gate} gate is not green`);
  const versions = input.directions
    .map((direction) => direction.match(/\bV(\d+)\b/i)?.[1])
    .filter((version): version is string => Boolean(version))
    .map(Number);
  const first = versions.length > 0 ? Math.min(...versions) : deliveryVersionNumber(input.currentVersion) + 1;
  const last = versions.length > 0 ? Math.max(...versions) : first + input.directions.length - 1;
  const nextStart = last + 1;
  const nextEnd = last + Math.max(1, input.directions.length);
  const audit = buildDiffOwnershipAudit(input.dirtyFiles);
  return {
    proposalId: input.proposalId,
    ready: blockers.length === 0,
    versionRange: first === last ? `V${first}` : `V${first}-V${last}`,
    nextProposalTitle: `ai-team V${nextStart}-V${nextEnd}: unattended next delivery batch`,
    requiredGates,
    safeAddCommands: audit.safeAddCommands,
    blockers,
  };
}

export function buildUnattendedBatchRunner(input: UnattendedBatchRunnerInput): UnattendedBatchRunner {
  const gateSteps: UnattendedBatchRunnerStep[] = [
    { kind: 'build', command: 'npm run build', ready: input.gates.build },
    { kind: 'tests', command: 'npm test', ready: input.gates.tests },
    { kind: 'coverage', command: 'npm run test:coverage:incremental', ready: input.gates.coverage },
    { kind: 'readme', command: 'npm run verify:readme', ready: input.gates.readme },
  ];
  const ready = gateSteps.every((step) => step.ready);
  const blockers = gateSteps.filter((step) => !step.ready).map((step) => `${step.kind} gate is not green`);
  return {
    ready,
    blockers,
    steps: [
      ...gateSteps,
      { kind: 'report', command: `AI_TEAM_DELIVERY_VERSION=${input.versionRange.split('-').at(-1) ?? input.versionRange} npm run delivery:report`, ready },
      { kind: 'proposal', command: `mcp_aisp.py update-proposal-status --proposal-id ${input.proposalId} --status delivered # after ${input.reportPath}`, ready },
    ],
  };
}

export function planProposalStatusRecovery(input: ProposalStatusRecoveryInput): ProposalStatusRecoveryPlan {
  const plan = buildProposalSyncPlan({
    proposalId: input.proposalId,
    projectPath: '',
    deploymentUrl: '',
    reportPath: '',
    evidenceNote: 'status recovery',
    currentStatus: input.currentStatus,
    targetStatus: input.targetStatus,
  });
  const commands = plan.statusPath.map((status) => `mcp_aisp.py update-proposal-status --proposal-id ${input.proposalId} --status ${status}`);
  return { recoverable: commands.length > 0, statusPath: plan.statusPath, commands };
}

function coverageFromHeadline(summary: DeliveryEvidenceSummary): number {
  return Number(summary.headline.match(/coverage ([\d.]+)%/)?.[1] ?? 0);
}

function readmeFromHeadline(summary: DeliveryEvidenceSummary): string {
  return summary.headline.match(/README (\d+\/\d+)/)?.[1] ?? '0/0';
}

export function buildEvidenceTrendDashboard(entries: DeliveryReportIndexEntry[]): EvidenceTrendDashboard {
  const sorted = buildDeliveryReportIndex(entries).entries;
  const latest = sorted[0];
  const previous = sorted[1];
  const latestCoverage = latest ? coverageFromHeadline(latest.summary) : 0;
  const previousCoverage = previous ? coverageFromHeadline(previous.summary) : latestCoverage;
  const coverageDelta = Math.round((latestCoverage - previousCoverage) * 100) / 100;
  const readmeStable = Boolean(latest && previous && readmeFromHeadline(latest.summary) === readmeFromHeadline(previous.summary));
  const recommendation = coverageDelta < 0 ? 'coverage watch: add branch tests before next batch' : 'trend stable: continue unattended batch';
  return {
    latestVersion: latest?.version ?? 'none',
    previousVersion: previous?.version,
    coverageDelta,
    readmeStable,
    recommendation,
  };
}

export function buildReleaseOperationsPanelModel(input: ReleaseOperationsPanelInput): ReleaseOperationsPanelModel {
  const index = buildDeliveryReportIndex(input.entries);
  const latest = index.latest;
  const latestReady = Boolean(latest?.summary.ready);
  const cards: ReleaseOperationsPanelCard[] = [
    { label: 'Latest', status: latestReady ? 'ready' : 'blocked', detail: latest ? latest.summary.headline : 'no delivery report' },
    { label: 'Side Effects', status: input.sideEffect.status === 'blocked' ? 'blocked' : 'ready', detail: input.sideEffect.status },
    { label: 'Auto Delivery', status: input.autoDelivery.ready ? 'ready' : 'blocked', detail: input.autoDelivery.summary },
    { label: 'CI Artifact', status: input.ciArtifact.summary.ready && input.ciArtifact.issues.length === 0 ? 'ready' : 'blocked', detail: input.ciArtifact.artifactName },
  ];
  const ready = cards.every((card) => card.status === 'ready');
  const markdown = [
    '# Release Operations Panel',
    '',
    `Latest: ${latest?.version ?? 'none'}`,
    `Ready: ${ready ? 'yes' : 'no'}`,
    '',
    ...cards.map((card) => `- ${card.label}: ${card.status} — ${card.detail}`),
  ].join('\n');
  return { ready, latestVersion: latest?.version ?? 'none', cards, markdown };
}

export function buildCiArtifactImportCommandPlan(input: CiArtifactImportCommandPlanInput): CiArtifactImportCommandPlan {
  const issues = [
    ...(input.artifactPath.trim() ? [] : ['artifactPath is required']),
    ...(input.version.trim() ? [] : ['version is required']),
    ...(input.outputPath.trim() ? [] : ['outputPath is required']),
  ];
  if (issues.length > 0) return { ready: false, commands: [], issues };
  const dryRun = input.dryRun ? ' --dry-run' : '';
  return {
    ready: true,
    issues: [],
    commands: [`node scripts/import-ci-artifact.mjs --version ${input.version} --artifact ${input.artifactPath} --output ${input.outputPath}${dryRun}`],
  };
}

export function buildProposalExecutionAuditLedger(input: ProposalExecutionAuditLedgerInput): ProposalExecutionAuditLedger {
  const total = input.events.length;
  const okCount = input.events.filter((event) => event.ok).length;
  const statusPath = input.events.map((event) => event.status);
  const ready = total > 0 && okCount === total;
  const summary = total === 0
    ? `${input.proposalId}: no audit events`
    : `${input.proposalId}: ${okCount}/${total} ok by ${input.actor}`;
  const markdown = [
    `# Proposal Execution Audit — ${input.proposalId}`,
    '',
    `Actor: ${input.actor}`,
    `Ready: ${ready ? 'yes' : 'no'}`,
    `Summary: ${summary}`,
    '',
    '| Time | Status | OK | Command | Note |',
    '|---|---|---:|---|---|',
    ...input.events.map((event) => `| ${event.at} | ${event.status} | ${event.ok ? 'yes' : 'no'} | \`${event.command}\` | ${event.note ?? ''} |`),
  ].join('\n');
  return { ready, proposalId: input.proposalId, actor: input.actor, okCount, total, statusPath, summary, markdown };
}

export function buildReleaseOperationsPersistenceSnapshot(input: ReleaseOperationsPersistenceInput): ReleaseOperationsPersistenceSnapshot {
  const payload: ReleaseOperationsPersistenceSnapshot['payload'] = {
    userId: input.userId.trim() || 'anonymous',
    selectedTab: input.selectedTab,
    panel: input.panel,
    auditFilter: input.auditFilter,
    updatedAt: input.now,
  };
  return {
    storageKey: 'ai-team:release-operations:v1',
    payload,
    serialized: JSON.stringify(payload),
  };
}

export function buildCiArtifactIngestionExecution(input: CiArtifactIngestionExecutionInput): CiArtifactIngestionExecution {
  const plan = buildCiArtifactImportCommandPlan(input);
  const evidence = buildCiArtifactEvidenceInput({ version: input.version || 'VNext', artifactName: input.artifactPath || 'unknown', jsonText: input.artifactText });
  const issues = [...plan.issues, ...evidence.issues];
  const ready = plan.ready && evidence.summary.ready && issues.length === 0;
  return {
    ready,
    plan,
    evidence,
    issues,
    ...(ready && !input.dryRun ? { write: { path: input.outputPath, content: JSON.stringify(evidence.evidence, null, 2) } } : {}),
  };
}

export function filterProposalExecutionAuditTimeline(ledger: ProposalExecutionAuditLedger, filter: ReleaseOperationsAuditFilter): ProposalExecutionAuditTimeline {
  const rows = ledger.markdown
    .split('\n')
    .filter((line) => line.startsWith('| 20'))
    .map((line): ProposalExecutionAuditEvent => {
      const cells = line.split('|').map((cell) => cell.trim());
      return {
        at: cells[1] ?? '',
        status: (cells[2] ?? 'intake') as ProposalSyncStatus,
        ok: cells[3] === 'yes',
        command: (cells[4] ?? '').replace(/^`|`$/g, ''),
        note: cells[5] || undefined,
      };
    })
    .filter((event) => !filter.status || event.status === filter.status)
    .filter((event) => filter.ok === undefined || event.ok === filter.ok)
    .filter((event) => {
      if (!filter.query) return true;
      const haystack = `${event.at} ${event.status} ${event.command} ${event.note ?? ''}`.toLowerCase();
      return haystack.includes(filter.query.toLowerCase());
    });
  const markdown = rows.length === 0
    ? `# Proposal Audit Timeline\n\nNo matching audit events for ${ledger.proposalId}`
    : ['# Proposal Audit Timeline', '', ...rows.map((event) => `- ${event.at} ${event.status} ${event.ok ? 'ok' : 'failed'} ${event.note ?? event.command}`)].join('\n');
  return { total: rows.length, events: rows, markdown };
}

export function generateNextDeliveryDirections(input: NextDeliveryDirectionInput): string[] {
  const first = nextVersionRange(input.latestVersion);
  const second = nextVersionRange(input.latestVersion, 6).replace(/^V\d+-/, `V${deliveryVersionNumber(input.latestVersion) + 4}-`);
  const third = nextVersionRange(input.latestVersion, 9).replace(/^V\d+-/, `V${deliveryVersionNumber(input.latestVersion) + 7}-`);
  const sourceCount = input.audit.classification.source.length;
  const scriptCount = input.audit.classification.scripts.length;
  const migrationText = input.batchAudit.migrated > 0
    ? `finish batch migration for ${input.batchAudit.migrated}/${input.batchAudit.total} evidence files`
    : `monitor ${input.batchAudit.total} evidence files for schema drift`;
  return [
    `${first}: CI evidence gate — enforce release evidence quality checks in release:check (${input.qualityGateReady ? 'gate baseline ready' : 'gate currently blocked'})`,
    `${second}: Web delivery operations — expose ${sourceCount} source change group(s) and restore persisted cockpit from the main console`,
    `${third}: Evidence batch migration — ${migrationText}; keep ${scriptCount} script gate(s) documented`,
  ];
}
