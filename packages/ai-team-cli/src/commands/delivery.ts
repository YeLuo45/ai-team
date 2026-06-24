import type { Command } from 'commander';
import {
  auditReleaseEvidenceBatch,
  buildCiArtifactImportCommandPlan,
  buildCiArtifactIngestionExecution,
  buildCiArtifactProvenance,
  buildCiArtifactUploadBridge,
  buildProposalDeliveryWizard,
  buildProposalExecutionPlan,
  buildProposalReplayVisualDiff,
  buildReleaseOperationsHistorySnapshot,
  executeProposalDryRun,
  migrateReleaseEvidencePayload,
  type ProposalSyncStatus,
} from '@ai-team/core';
import { c } from '../utils.js';

export function registerDeliveryCommands(program: Command): void {
  const cmd = program
    .command('delivery')
    .description('Delivery evidence utilities');

  cmd
    .command('evidence-migrate')
    .description('Migrate release evidence JSON to the latest schema')
    .option('-f, --file <path>', 'release evidence JSON path (default stdin)')
    .option('--dry-run', 'print migration result without writing', false)
    .action(async (opts) => {
      const fs = await import('node:fs/promises');
      const raw = opts.file ? await fs.readFile(opts.file, 'utf-8') : await readStdin();
      const result = migrateReleaseEvidencePayload(raw);
      if (result.issues.length > 0) {
        console.error(c.err(result.issues.join('; ')));
        process.exit(1);
      }
      if (opts.file && !opts.dryRun) await fs.writeFile(opts.file, `${result.serialized}\n`, 'utf-8');
      console.log(c.ok(`evidence schema v${result.fromSchemaVersion ?? 'unknown'} → v${result.evidence?.schemaVersion ?? 'unknown'} changed=${result.changed} dryRun=${opts.dryRun}`));
    });

  cmd
    .command('evidence-audit')
    .description('Audit release evidence JSON files in a directory')
    .requiredOption('--dir <path>', 'directory containing release evidence JSON files')
    .action(async (opts) => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const names = (await fs.readdir(opts.dir)).filter((name) => name.endsWith('.json')).sort();
      const entries = await Promise.all(names.map(async (name) => ({
        path: path.join(opts.dir, name),
        text: await fs.readFile(path.join(opts.dir, name), 'utf-8'),
      })));
      const audit = auditReleaseEvidenceBatch(entries);
      console.log(c.ok(`evidence audit total=${audit.total} migrated=${audit.migrated} current=${audit.current} invalid=${audit.invalid}`));
      for (const item of audit.items) console.log(`${item.status}\t${item.path}`);
    });

  cmd
    .command('ci-artifact-import-plan')
    .description('Print the deterministic CI artifact import command')
    .requiredOption('--artifact <path>', 'CI artifact JSON path')
    .requiredOption('--version <version>', 'delivery version such as V94')
    .requiredOption('--output <path>', 'output release evidence JSON path')
    .option('--dry-run', 'append --dry-run to the generated command', false)
    .action((opts) => {
      const plan = buildCiArtifactImportCommandPlan({
        artifactPath: opts.artifact,
        version: opts.version,
        outputPath: opts.output,
        dryRun: opts.dryRun,
      });
      console.log(plan.ready ? c.ok(`ci artifact import ready commands=${plan.commands.length}`) : c.err(`ci artifact import blocked issues=${plan.issues.length}`));
      for (const issue of plan.issues) console.log(c.warn(issue));
      for (const command of plan.commands) console.log(command);
    });

  cmd
    .command('ci-artifact-ingest')
    .description('Validate and optionally write CI artifact evidence JSON')
    .requiredOption('--artifact <path>', 'CI artifact JSON path')
    .requiredOption('--version <version>', 'delivery version such as V97')
    .requiredOption('--output <path>', 'output release evidence JSON path')
    .option('--dry-run', 'validate without writing', false)
    .action(async (opts) => {
      const fs = await import('node:fs/promises');
      const artifactText = await fs.readFile(opts.artifact, 'utf-8');
      const result = buildCiArtifactIngestionExecution({
        artifactPath: opts.artifact,
        artifactText,
        version: opts.version,
        outputPath: opts.output,
        dryRun: opts.dryRun,
      });
      console.log(result.ready ? c.ok(`ci artifact ingestion ready dryRun=${opts.dryRun}`) : c.err(`ci artifact ingestion blocked issues=${result.issues.length}`));
      for (const issue of result.issues) console.log(c.warn(issue));
      if (result.write) await fs.writeFile(result.write.path, `${result.write.content}\n`, 'utf-8');
      if (result.write) console.log(c.ok(`wrote ${result.write.path}`));
    });

  cmd
    .command('ci-artifact-upload-bridge')
    .description('Validate CI artifact evidence and print the upload bridge command')
    .requiredOption('--artifact <path>', 'CI artifact JSON path')
    .requiredOption('--version <version>', 'delivery version such as V100')
    .requiredOption('--output <path>', 'output release evidence JSON path')
    .requiredOption('--target <target>', 'local-evidence | github-actions-artifact | release-asset')
    .option('--dry-run', 'validate without writing', false)
    .action(async (opts) => {
      const fs = await import('node:fs/promises');
      const artifactText = await fs.readFile(opts.artifact, 'utf-8');
      const target = opts.target as 'local-evidence' | 'github-actions-artifact' | 'release-asset';
      const result = buildCiArtifactUploadBridge({ artifactPath: opts.artifact, artifactText, version: opts.version, outputPath: opts.output, dryRun: opts.dryRun, uploadTarget: target });
      console.log(result.ready ? c.ok(`ci artifact upload bridge ready target=${result.uploadTarget}`) : c.err(`ci artifact upload bridge blocked issues=${result.issues.length}`));
      for (const issue of result.issues) console.log(c.warn(issue));
      for (const command of result.commands) console.log(command);
    });

  cmd
    .command('release-operations-history')
    .description('Build a release operations history snapshot from evidence JSON files')
    .requiredOption('--dir <path>', 'directory containing release evidence JSON files')
    .action(async (opts) => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const names = (await fs.readdir(opts.dir)).filter((name) => name.endsWith('-release-evidence.json')).sort();
      const entries = await Promise.all(names.map(async (name) => {
        const fullPath = path.join(opts.dir, name);
        const raw = JSON.parse(await fs.readFile(fullPath, 'utf-8')) as { version?: string; summary?: { ready?: boolean; headline?: string }; generatedAt?: string; reportMarkdown?: string };
        const proposalId = raw.reportMarkdown?.match(/\*\*Proposal\*\*:\s+(P-\d{8}-\d{3})/)?.[1] ?? 'UNKNOWN';
        return { version: raw.version ?? name, proposalId, updatedAt: raw.generatedAt ?? '1970-01-01T00:00:00Z', ready: raw.summary?.ready === true, summary: raw.summary?.headline ?? name, evidencePath: fullPath };
      }));
      const history = buildReleaseOperationsHistorySnapshot(entries);
      console.log(c.ok(`release operations history latest=${history.latestVersion} ready=${history.readyCount} blocked=${history.blockedCount}`));
      console.log(history.serialized);
    });

  cmd
    .command('ci-artifact-provenance')
    .description('Build a signed provenance model for a CI artifact')
    .requiredOption('--version <version>', 'delivery version such as V102')
    .requiredOption('--artifact-name <name>', 'artifact file name')
    .requiredOption('--sha256 <digest>', 'artifact sha256 digest')
    .requiredOption('--commit <sha>', 'git commit sha')
    .requiredOption('--workflow-run-id <id>', 'GitHub Actions workflow run id')
    .requiredOption('--signer <name>', 'signer identity')
    .option('--generated-at <iso>', 'generated timestamp', new Date().toISOString())
    .action((opts) => {
      const provenance = buildCiArtifactProvenance({ version: opts.version, artifactName: opts.artifactName, artifactSha256: opts.sha256, commit: opts.commit, workflowRunId: opts.workflowRunId, signer: opts.signer, generatedAt: opts.generatedAt });
      console.log(provenance.ready ? c.ok(`provenance ready subject=${provenance.subject}`) : c.err(`provenance blocked issues=${provenance.issues.length}`));
      for (const issue of provenance.issues) console.log(c.warn(issue));
      console.log(provenance.markdown);
    });

  cmd
    .command('proposal-replay-diff')
    .description('Render a visual diff between proposal replay status paths')
    .requiredOption('--proposal-id <id>', 'proposal id')
    .requiredOption('--before <statuses>', 'comma-separated status path before replay')
    .requiredOption('--after <statuses>', 'comma-separated status path after replay')
    .action((opts) => {
      const before = String(opts.before).split(',').filter(Boolean) as ProposalSyncStatus[];
      const after = String(opts.after).split(',').filter(Boolean) as ProposalSyncStatus[];
      const diff = buildProposalReplayVisualDiff({ proposalId: opts.proposalId, before, after });
      console.log(c.ok(`proposal replay diff changed=${diff.changed} added=${diff.added.length} removed=${diff.removed.length}`));
      console.log(diff.markdown);
    });

  cmd
    .command('proposal-execute-plan')
    .description('Print guarded MCP delivery commands after exact confirmation')
    .requiredOption('--proposal-id <id>', 'proposal id')
    .requiredOption('--project-path <path>', 'project path')
    .requiredOption('--deployment-url <url>', 'deployment URL')
    .requiredOption('--report-path <path>', 'delivery report path')
    .requiredOption('--evidence-note <text>', 'evidence note')
    .requiredOption('--current-status <status>', 'current proposal status')
    .option('--target-status <status>', 'target proposal status', 'delivered')
    .requiredOption('--confirm <phrase>', 'must be EXECUTE <proposal-id>')
    .action((opts) => {
      const wizard = buildProposalDeliveryWizard({
        proposalId: opts.proposalId,
        projectPath: opts.projectPath,
        deploymentUrl: opts.deploymentUrl,
        reportPath: opts.reportPath,
        evidenceNote: opts.evidenceNote,
        currentStatus: opts.currentStatus as ProposalSyncStatus,
        targetStatus: opts.targetStatus as ProposalSyncStatus,
      });
      const plan = buildProposalExecutionPlan({ dryRun: executeProposalDryRun(wizard), confirmText: opts.confirm });
      console.log(c.ok(`proposal execute plan ready=${plan.ready} required="${plan.requiredPhrase}" commands=${plan.commands.length}`));
      for (const command of plan.commands) console.log(command.command);
      for (const warning of plan.warnings) console.log(c.warn(warning));
    });
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
