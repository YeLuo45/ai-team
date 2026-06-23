// V47: Release Hardening — combine command run status + coverage gate + README presence.
export interface ReleaseCommandStatus {
  name: string;
  status: 'pass' | 'fail' | 'missing';
  reason?: string;
}

export interface ReleaseCoverageStatus {
  incrementalBranchPct: number;
  thresholdPct: number;
}

export interface ReleaseDocsStatus {
  documented: string[];
  missing: string[];
}

export interface ReleaseHardeningInput {
  packageVersion: string;
  commands: ReleaseCommandStatus[];
  coverage: ReleaseCoverageStatus;
  docs: ReleaseDocsStatus;
}

export interface ReleaseHardeningReport {
  ready: boolean;
  blockers: string[];
  coverageStatus: 'pass' | 'fail';
  summary: string;
  packageVersion: string;
  commandResults: ReleaseCommandStatus[];
}

export function buildReleaseHardeningReport(input: ReleaseHardeningInput): ReleaseHardeningReport {
  const blockers: string[] = [];
  const passedCommands = input.commands.filter((command) => command.status === 'pass').length;
  for (const command of input.commands) {
    if (command.status === 'fail') blockers.push(`${command.name} failed: ${command.reason ?? 'unspecified'}`);
    if (command.status === 'missing') blockers.push(`${command.name} not run`);
    if (input.docs.missing.includes(command.name)) blockers.push(`${command.name} not documented`);
  }
  const coverageStatus: 'pass' | 'fail' = input.coverage.incrementalBranchPct >= input.coverage.thresholdPct ? 'pass' : 'fail';
  if (coverageStatus === 'fail') blockers.push(`coverage ${input.coverage.incrementalBranchPct}% below threshold ${input.coverage.thresholdPct}%`);
  return {
    ready: blockers.length === 0,
    blockers,
    coverageStatus,
    summary: `${passedCommands}/${input.commands.length} commands pass, ${input.coverage.incrementalBranchPct}% branch coverage`,
    packageVersion: input.packageVersion,
    commandResults: input.commands,
  };
}
